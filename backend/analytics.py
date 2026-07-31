"""Query layer for the dashboards.

Two things live here that the routers should not have to re-derive:

1. Filter semantics. A date range selects an *observation window*: an employee
   is in scope if they were on the books at any point inside it. That is what
   makes "attrition between March and June" mean what a user expects.

2. RBAC enforcement. Every query is built from a `DataScope`, and a manager's
   department constraint is applied from their token — never from a query
   parameter — so scoping cannot be bypassed by editing the URL.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date

import pandas as pd
from fastapi import Query
from sqlalchemy import Select, and_, case, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.deps import DataScope
from backend.etl.transforms import (
    AGE_GROUP_ORDER,
    TENURE_BAND_ORDER,
)
from backend.models import Employee, KpiSnapshot


@dataclass
class EmployeeFilters:
    departments: list[str] = field(default_factory=list)
    job_roles: list[str] = field(default_factory=list)
    age_groups: list[str] = field(default_factory=list)
    tenure_bands: list[str] = field(default_factory=list)
    date_from: date | None = None
    date_to: date | None = None

    @property
    def is_empty(self) -> bool:
        return not any(
            [
                self.departments,
                self.job_roles,
                self.age_groups,
                self.tenure_bands,
                self.date_from,
                self.date_to,
            ]
        )


def filter_params(
    department: list[str] | None = Query(default=None),
    job_role: list[str] | None = Query(default=None),
    age_group: list[str] | None = Query(default=None),
    tenure_band: list[str] | None = Query(default=None),
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
) -> EmployeeFilters:
    """FastAPI dependency turning repeated query params into a filter object."""
    return EmployeeFilters(
        departments=[d for d in (department or []) if d],
        job_roles=[r for r in (job_role or []) if r],
        age_groups=[a for a in (age_group or []) if a],
        tenure_bands=[t for t in (tenure_band or []) if t],
        date_from=date_from,
        date_to=date_to,
    )


def build_conditions(filters: EmployeeFilters, scope: DataScope) -> list:
    """Translate filters + RBAC scope into SQLAlchemy WHERE clauses."""
    conditions = []

    # RBAC first, and unconditionally. A manager's department overrides any
    # department they try to request.
    if scope.department:
        conditions.append(Employee.department == scope.department)
    elif filters.departments:
        conditions.append(Employee.department.in_(filters.departments))

    if filters.job_roles:
        conditions.append(Employee.job_role.in_(filters.job_roles))
    if filters.age_groups:
        conditions.append(Employee.age_group.in_(filters.age_groups))
    if filters.tenure_bands:
        conditions.append(Employee.tenure_band.in_(filters.tenure_bands))

    # Observation-window semantics: employed at some point during [from, to].
    if filters.date_to:
        conditions.append(Employee.hire_date <= filters.date_to)
    if filters.date_from:
        conditions.append(
            or_(Employee.exit_date.is_(None), Employee.exit_date >= filters.date_from)
        )

    return conditions


def apply_filters(
    stmt: Select, filters: EmployeeFilters, scope: DataScope
) -> Select:
    conditions = build_conditions(filters, scope)
    return stmt.where(and_(*conditions)) if conditions else stmt


# --------------------------------------------------------------------------- #
# Aggregate queries
# --------------------------------------------------------------------------- #
_ATTRITION_COUNT = func.sum(case((Employee.attrition.is_(True), 1), else_=0))


async def core_aggregates(
    session: AsyncSession, filters: EmployeeFilters, scope: DataScope
) -> dict[str, float | None]:
    """Single-pass aggregate over the filtered population."""
    stmt = apply_filters(
        select(
            func.count(Employee.id).label("headcount"),
            _ATTRITION_COUNT.label("attrition_count"),
            func.avg(Employee.job_satisfaction).label("avg_job_satisfaction"),
            func.avg(Employee.monthly_income).label("avg_monthly_income"),
            func.avg(Employee.engagement_index).label("avg_engagement_index"),
            func.avg(Employee.years_at_company).label("avg_tenure_years"),
            func.avg(Employee.risk_score).label("avg_risk_score"),
            func.sum(case((Employee.over_time.is_(True), 1), else_=0)).label(
                "overtime_count"
            ),
            func.sum(case((Employee.is_early_attrition.is_(True), 1), else_=0)).label(
                "early_attrition_count"
            ),
            func.sum(case((Employee.risk_band == "High", 1), else_=0)).label(
                "high_risk_count"
            ),
            func.sum(case((Employee.enps_category == "Promoter", 1), else_=0)).label(
                "promoters"
            ),
            func.sum(case((Employee.enps_category == "Detractor", 1), else_=0)).label(
                "detractors"
            ),
            func.sum(case((Employee.attrition.is_(False), 1), else_=0)).label(
                "active_headcount"
            ),
        ),
        filters,
        scope,
    )
    row = (await session.execute(stmt)).one()
    data = dict(row._mapping)
    return {k: (float(v) if v is not None else None) for k, v in data.items()}


async def pay_equity(
    session: AsyncSession, filters: EmployeeFilters, scope: DataScope
) -> dict:
    """Mean pay by gender, plus the gap between them.

    Reported as a signed percentage relative to the male mean: positive means
    women are paid less, negative means women are paid more. In the IBM sample
    the gap is genuinely negative, and the UI says so rather than forcing the
    result into an expected direction.
    """
    stmt = apply_filters(
        select(
            Employee.gender,
            func.count(Employee.id),
            func.avg(Employee.monthly_income),
            func.percentile_cont(0.5).within_group(Employee.monthly_income),
        ).group_by(Employee.gender),
        filters,
        scope,
    )
    rows = (await session.execute(stmt)).all()

    by_gender = {
        str(gender): {
            "headcount": int(count),
            "mean_income": float(mean) if mean is not None else None,
            "median_income": float(median) if median is not None else None,
        }
        for gender, count, mean, median in rows
    }

    male = by_gender.get("Male", {}).get("mean_income")
    female = by_gender.get("Female", {}).get("mean_income")
    gap = None
    if male and female and male > 0:
        gap = round((male - female) / male * 100, 2)

    return {
        "by_gender": by_gender,
        "gap_pct": gap,
        "note": (
            "Gap is the female mean expressed against the male mean. "
            "A negative value means women are paid more on average."
        ),
    }


async def gender_distribution(
    session: AsyncSession, filters: EmployeeFilters, scope: DataScope
) -> list[dict]:
    stmt = apply_filters(
        select(Employee.gender, func.count(Employee.id)).group_by(Employee.gender),
        filters,
        scope,
    ).order_by(func.count(Employee.id).desc())
    return [
        {"name": str(gender), "value": float(count)}
        for gender, count in (await session.execute(stmt)).all()
    ]


async def attrition_by_department(
    session: AsyncSession, filters: EmployeeFilters, scope: DataScope
) -> list[dict]:
    stmt = apply_filters(
        select(
            Employee.department,
            func.count(Employee.id),
            _ATTRITION_COUNT,
        ).group_by(Employee.department),
        filters,
        scope,
    ).order_by(func.count(Employee.id).desc())

    out = []
    for department, headcount, leavers in (await session.execute(stmt)).all():
        headcount = int(headcount)
        leavers = int(leavers or 0)
        out.append(
            {
                "department": str(department),
                "headcount": headcount,
                "attrition_count": leavers,
                "attrition_rate": round(leavers / headcount * 100, 2)
                if headcount
                else 0.0,
            }
        )
    return out


async def attrition_by_age_gender(
    session: AsyncSession, filters: EmployeeFilters, scope: DataScope
) -> list[dict]:
    stmt = apply_filters(
        select(
            Employee.age_group,
            Employee.gender,
            func.count(Employee.id),
            _ATTRITION_COUNT,
        ).group_by(Employee.age_group, Employee.gender),
        filters,
        scope,
    )
    rows = (await session.execute(stmt)).all()

    buckets: dict[str, dict[str, int]] = {}
    for age_group, gender, headcount, leavers in rows:
        bucket = buckets.setdefault(
            str(age_group),
            {
                "male_attrition": 0,
                "female_attrition": 0,
                "male_headcount": 0,
                "female_headcount": 0,
            },
        )
        key = "male" if str(gender).lower().startswith("m") else "female"
        bucket[f"{key}_attrition"] += int(leavers or 0)
        bucket[f"{key}_headcount"] += int(headcount)

    # Present in a fixed demographic order rather than whatever the DB returns.
    return [
        {"age_group": group, **buckets[group]}
        for group in AGE_GROUP_ORDER
        if group in buckets
    ]


async def attrition_trend(
    session: AsyncSession, filters: EmployeeFilters, scope: DataScope
) -> list[dict]:
    """Monthly exits and end-of-month headcount across the observation window.

    Pulled as two date columns and pivoted in pandas: computing a running
    headcount per month in SQL would need a generated date series joined back
    against every employee, which is far more machinery than a workforce-sized
    table justifies.
    """
    stmt = apply_filters(
        select(Employee.hire_date, Employee.exit_date), filters, scope
    )
    rows = (await session.execute(stmt)).all()
    if not rows:
        return []

    frame = pd.DataFrame(rows, columns=["hire_date", "exit_date"])
    frame["hire_date"] = pd.to_datetime(frame["hire_date"])
    frame["exit_date"] = pd.to_datetime(frame["exit_date"])

    exits = frame["exit_date"].dropna()
    if exits.empty:
        return []

    window_start = pd.Timestamp(filters.date_from) if filters.date_from else exits.min()
    window_end = pd.Timestamp(filters.date_to) if filters.date_to else exits.max()
    if window_end < window_start:
        return []

    months = pd.period_range(window_start, window_end, freq="M")
    # Cap the series so a very wide range cannot produce a thousand x-axis ticks.
    if len(months) > 60:
        months = months[-60:]

    out = []
    for period in months:
        month_end = period.to_timestamp(how="end")
        month_start = period.to_timestamp(how="start")

        month_exits = int(
            ((frame["exit_date"] >= month_start) & (frame["exit_date"] <= month_end)).sum()
        )
        headcount = int(
            (
                (frame["hire_date"] <= month_end)
                & (frame["exit_date"].isna() | (frame["exit_date"] > month_end))
            ).sum()
        )
        # Denominator is start-of-month headcount (still-employed + those who
        # left during the month), which is the standard turnover convention.
        base = headcount + month_exits
        out.append(
            {
                "period": str(period),
                "exits": month_exits,
                "headcount": headcount,
                "attrition_rate": round(month_exits / base * 100, 2) if base else 0.0,
            }
        )
    return out


async def scatter_points(
    session: AsyncSession, filters: EmployeeFilters, scope: DataScope, limit: int = 2000
) -> list[dict]:
    stmt = apply_filters(
        select(
            Employee.years_at_company,
            Employee.monthly_income,
            Employee.attrition,
            Employee.job_role,
            Employee.department,
        ),
        filters,
        scope,
    ).limit(limit)
    return [
        {
            "years_at_company": int(years),
            "monthly_income": int(income),
            "attrition": bool(attrition),
            "job_role": str(job_role),
            "department": str(department),
        }
        for years, income, attrition, job_role, department in (
            await session.execute(stmt)
        ).all()
    ]


async def treemap_by_job_role(
    session: AsyncSession, filters: EmployeeFilters, scope: DataScope
) -> list[dict]:
    stmt = apply_filters(
        select(Employee.job_role, func.count(Employee.id), _ATTRITION_COUNT).group_by(
            Employee.job_role
        ),
        filters,
        scope,
    ).order_by(func.count(Employee.id).desc())

    out = []
    for job_role, headcount, leavers in (await session.execute(stmt)).all():
        headcount = int(headcount)
        out.append(
            {
                "name": str(job_role),
                "size": headcount,
                "attrition_rate": round(int(leavers or 0) / headcount * 100, 2)
                if headcount
                else 0.0,
            }
        )
    return out


async def attrition_heatmap(
    session: AsyncSession, filters: EmployeeFilters, scope: DataScope
) -> list[dict]:
    stmt = apply_filters(
        select(
            Employee.department,
            Employee.tenure_band,
            func.count(Employee.id),
            _ATTRITION_COUNT,
        ).group_by(Employee.department, Employee.tenure_band),
        filters,
        scope,
    )
    rows = (await session.execute(stmt)).all()

    cells = []
    for department, tenure_band, headcount, leavers in rows:
        headcount = int(headcount)
        cells.append(
            {
                "department": str(department),
                "tenure_band": str(tenure_band),
                "headcount": headcount,
                "attrition_count": int(leavers or 0),
                "attrition_rate": round(int(leavers or 0) / headcount * 100, 2)
                if headcount
                else 0.0,
            }
        )

    order = {band: i for i, band in enumerate(TENURE_BAND_ORDER)}
    cells.sort(key=lambda c: (c["department"], order.get(c["tenure_band"], 99)))
    return cells


async def high_risk_employees(
    session: AsyncSession,
    filters: EmployeeFilters,
    scope: DataScope,
    limit: int = 50,
) -> list[dict]:
    """Currently-employed people the model ranks most likely to leave.

    Leavers are excluded on purpose: the point of the table is intervention,
    and there is nothing to intervene on for someone already gone.
    """
    stmt = (
        apply_filters(select(Employee), filters, scope)
        .where(Employee.attrition.is_(False))
        .where(Employee.risk_score.isnot(None))
        .order_by(Employee.risk_score.desc())
        .limit(limit)
    )
    employees = (await session.execute(stmt)).scalars().all()

    return [
        {
            "employee_number": emp.employee_number,
            "department": emp.department,
            "job_role": emp.job_role,
            "age": emp.age,
            "years_at_company": emp.years_at_company,
            "monthly_income": emp.monthly_income,
            "over_time": emp.over_time,
            "job_satisfaction": emp.job_satisfaction,
            "years_since_last_promotion": emp.years_since_last_promotion,
            "engagement_index": emp.engagement_index,
            "risk_score": round((emp.risk_score or 0) * 100, 1),
            "risk_band": emp.risk_band or "Unknown",
            "risk_drivers": emp.risk_drivers or [],
        }
        for emp in employees
    ]


async def snapshot_metrics(session: AsyncSession, scope_value: str = "__all__") -> dict:
    """Read pre-aggregated company metrics written at ingest time.

    This is the fast path behind the unfiltered dashboard: it avoids scanning
    the employee table for the view most users land on first.
    """
    stmt = select(KpiSnapshot.metric_key, KpiSnapshot.metric_value).where(
        KpiSnapshot.scope_type == "company", KpiSnapshot.scope_value == scope_value
    )
    return {
        key: float(value) for key, value in (await session.execute(stmt)).all()
    }


async def filter_options(
    session: AsyncSession, scope: DataScope
) -> dict:
    """Distinct values available to this user, for populating filter menus."""
    base = select(Employee.department).distinct()
    if scope.department:
        base = base.where(Employee.department == scope.department)
    departments = sorted(
        str(d) for (d,) in (await session.execute(base)).all() if d
    )

    role_stmt = select(Employee.job_role).distinct()
    if scope.department:
        role_stmt = role_stmt.where(Employee.department == scope.department)
    job_roles = sorted(
        str(r) for (r,) in (await session.execute(role_stmt)).all() if r
    )

    bounds_stmt = select(func.min(Employee.hire_date), func.max(Employee.exit_date))
    if scope.department:
        bounds_stmt = bounds_stmt.where(Employee.department == scope.department)
    earliest, latest = (await session.execute(bounds_stmt)).one()

    return {
        "departments": departments,
        "job_roles": job_roles,
        "age_groups": AGE_GROUP_ORDER,
        "tenure_bands": TENURE_BAND_ORDER,
        "date_range": {"min": earliest, "max": latest},
        "locked_department": scope.department,
    }

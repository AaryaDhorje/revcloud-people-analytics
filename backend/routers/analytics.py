from datetime import datetime, timezone
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Request

from backend import analytics as q
from backend.deps import CurrentUser, ScopeDep, SessionDep, record_audit
from backend.etl.pipeline import get_annual_revenue
from backend.metric_catalog import catalog_with_values, coverage_summary
from backend.ml.score import model_is_available, model_metadata
from backend.schemas import DeepDiveResponse, FilterOptions, KpiCard, OverviewResponse

router = APIRouter(prefix="/api/py/analytics", tags=["analytics"])

FiltersDep = Annotated[q.EmployeeFilters, Depends(q.filter_params)]


@router.get("/filters", response_model=FilterOptions)
async def get_filters(session: SessionDep, scope: ScopeDep) -> Any:
    return await q.filter_options(session, scope)


def _card(
    key: str,
    label: str,
    value: float | None,
    unit: str,
    *,
    caption: str | None = None,
    available: bool = True,
    unavailable_reason: str | None = None,
) -> KpiCard:
    return KpiCard(
        key=key,
        label=label,
        value=round(value, 2) if isinstance(value, (int, float)) else None,
        unit=unit,  # type: ignore[arg-type]
        caption=caption,
        available=available,
        unavailable_reason=unavailable_reason,
    )


@router.get("/overview", response_model=OverviewResponse)
async def overview(
    request: Request,
    session: SessionDep,
    scope: ScopeDep,
    user: CurrentUser,
    filters: FiltersDep,
) -> Any:
    """Page 1 of the dashboard.

    When no filters are applied and the caller sees the whole company, the KPI
    numbers come from `kpi_snapshots` — the aggregates computed once at ingest.
    Any filter or manager scope falls through to a live aggregate over the
    filtered rows.
    """
    used_snapshot = filters.is_empty and not scope.is_scoped

    if used_snapshot:
        metrics = await q.snapshot_metrics(session)
        if not metrics:
            # No snapshot yet (fresh database) — fall back to a live read.
            metrics = await q.core_aggregates(session, filters, scope)
            used_snapshot = False
    else:
        raw = await q.core_aggregates(session, filters, scope)
        headcount = raw.get("headcount") or 0
        metrics = dict(raw)
        if headcount:
            metrics["attrition_rate"] = (raw.get("attrition_count") or 0) / headcount * 100
            metrics["overtime_rate"] = (raw.get("overtime_count") or 0) / headcount * 100
            metrics["early_attrition_rate"] = (
                (raw.get("early_attrition_count") or 0) / headcount * 100
            )
            metrics["enps"] = (
                ((raw.get("promoters") or 0) - (raw.get("detractors") or 0))
                / headcount
                * 100
            )

    kpis = [
        _card(
            "headcount",
            "Total Headcount",
            metrics.get("headcount"),
            "count",
            caption="Employees in the current selection",
        ),
        _card(
            "attrition_rate",
            "Overall Attrition Rate",
            metrics.get("attrition_rate"),
            "percent",
            caption=f"{int(metrics.get('attrition_count') or 0)} recorded leavers",
        ),
        _card(
            "avg_job_satisfaction",
            "Avg Satisfaction Score",
            metrics.get("avg_job_satisfaction"),
            "score",
            caption="Job satisfaction, 1-4 scale",
        ),
        _card(
            "avg_monthly_income",
            "Avg Monthly Income",
            metrics.get("avg_monthly_income"),
            "currency",
            caption="Mean gross monthly pay",
        ),
    ]

    await record_audit(
        session,
        request=request,
        user=user,
        action="analytics.overview",
        resource="dashboard:overview",
        detail={
            "departments": filters.departments or None,
            "job_roles": filters.job_roles or None,
            "scoped_to": scope.department,
        },
    )

    return {
        "kpis": kpis,
        "gender_distribution": await q.gender_distribution(session, filters, scope),
        "attrition_by_department": await q.attrition_by_department(
            session, filters, scope
        ),
        "attrition_by_age_gender": await q.attrition_by_age_gender(
            session, filters, scope
        ),
        "attrition_trend": await q.attrition_trend(session, filters, scope),
        "generated_at": datetime.now(timezone.utc),
        "scope_note": scope.note,
    }


@router.get("/deep-dive", response_model=DeepDiveResponse)
async def deep_dive(
    request: Request,
    session: SessionDep,
    scope: ScopeDep,
    user: CurrentUser,
    filters: FiltersDep,
) -> Any:
    """Page 2 of the dashboard."""
    await record_audit(
        session,
        request=request,
        user=user,
        action="analytics.deep_dive",
        resource="dashboard:talent-retention",
        detail={"scoped_to": scope.department},
    )

    return {
        "scatter": await q.scatter_points(session, filters, scope),
        "treemap": await q.treemap_by_job_role(session, filters, scope),
        "heatmap": await q.attrition_heatmap(session, filters, scope),
        "high_risk": await q.high_risk_employees(session, filters, scope),
        "pay_equity": await q.pay_equity(session, filters, scope),
        "generated_at": datetime.now(timezone.utc),
        "model_available": model_is_available(),
        "scope_note": scope.note,
    }


@router.get("/coverage")
async def coverage(
    session: SessionDep,
    scope: ScopeDep,
    user: CurrentUser,
    filters: FiltersDep,
) -> dict[str, Any]:
    """Which brief metrics this dataset supports, and what the gaps need.

    Powers the Data Coverage panel. Being explicit about the four metrics the
    IBM extract cannot produce is more useful than silently omitting them.
    """
    raw = await q.core_aggregates(session, filters, scope)
    headcount = raw.get("headcount") or 0

    metrics = dict(raw)
    if headcount:
        metrics["attrition_rate"] = (raw.get("attrition_count") or 0) / headcount * 100
        metrics["overtime_rate"] = (raw.get("overtime_count") or 0) / headcount * 100
        metrics["early_attrition_rate"] = (
            (raw.get("early_attrition_count") or 0) / headcount * 100
        )
        metrics["enps"] = (
            ((raw.get("promoters") or 0) - (raw.get("detractors") or 0)) / headcount * 100
        )

    snapshot = await q.snapshot_metrics(session)
    for key in ("internal_mobility_rate", "quality_of_hire", "gender_pay_gap_pct"):
        if key in snapshot and key not in metrics:
            metrics[key] = snapshot[key]

    annual_revenue = await get_annual_revenue(session)
    active = raw.get("active_headcount") or 0
    if annual_revenue and active:
        metrics["revenue_per_employee"] = annual_revenue / active

    equity = await q.pay_equity(session, filters, scope)
    if equity["gap_pct"] is not None:
        metrics["gender_pay_gap_pct"] = equity["gap_pct"]

    entries = catalog_with_values(
        metrics, revenue_configured=bool(annual_revenue)
    )
    return {
        "metrics": entries,
        "summary": coverage_summary(entries),
        "model": model_metadata() if model_is_available() else None,
        "scope_note": scope.note,
    }

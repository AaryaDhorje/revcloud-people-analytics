"""Load and aggregate stages of the ETL pipeline.

Flow: extract (CSV -> DataFrame) -> transform (transforms.py) -> score (ml) ->
load (employees) -> aggregate (kpi_snapshots) -> notify (realtime_state).

The whole thing runs inside the caller's transaction, so a failure part-way
through leaves the previous dataset intact rather than a half-loaded one.
"""

from __future__ import annotations

import io
from datetime import datetime, timezone
from typing import Any

import pandas as pd
from sqlalchemy import delete, func, insert, select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from backend.etl.transforms import (
    TransformError,
    rows_for_insert,
    transform,
)
from backend.ml.score import ModelUnavailable, score_many
from backend.models import Employee, IngestRun, KpiSnapshot, RealtimeState

# Columns the Employee model accepts. Anything else in the frame (helper
# columns, etc.) is filtered out before insert.
_EMPLOYEE_COLUMNS = {c.name for c in Employee.__table__.columns}


def read_csv_bytes(payload: bytes, filename: str) -> pd.DataFrame:
    """Extract stage: bytes -> DataFrame."""
    try:
        # utf-8-sig transparently strips the BOM Excel likes to prepend.
        return pd.read_csv(io.BytesIO(payload), encoding="utf-8-sig")
    except UnicodeDecodeError:
        try:
            return pd.read_csv(io.BytesIO(payload), encoding="latin-1")
        except Exception as exc:
            raise TransformError(f"Could not decode {filename}: {exc}") from exc
    except pd.errors.EmptyDataError as exc:
        raise TransformError(f"{filename} is empty.") from exc
    except pd.errors.ParserError as exc:
        raise TransformError(f"{filename} is not valid CSV: {exc}") from exc


async def load_employees(
    session: AsyncSession, df: pd.DataFrame, ingest_run_id: int | None
) -> int:
    """Replace the employee table with the incoming snapshot.

    Full replace rather than merge: an HRIS extract is a point-in-time snapshot
    of the whole workforce, so rows absent from the new file are genuinely gone
    and should not linger.
    """
    records = rows_for_insert(df, ingest_run_id)
    cleaned = [
        {k: v for k, v in record.items() if k in _EMPLOYEE_COLUMNS}
        for record in records
    ]

    await session.execute(delete(Employee))
    if cleaned:
        # Chunked so a large upload does not build one enormous statement.
        for start in range(0, len(cleaned), 500):
            await session.execute(insert(Employee), cleaned[start : start + 500])
    return len(cleaned)


def apply_risk_scores(df: pd.DataFrame) -> tuple[pd.DataFrame, str | None]:
    """Attach model output. Degrades gracefully if the artefact is missing."""
    try:
        scored = score_many(df.to_dict(orient="records"))
    except ModelUnavailable as exc:
        df["risk_score"] = None
        df["risk_band"] = None
        df["risk_drivers"] = None
        return df, str(exc)

    df["risk_score"] = [s["risk_score"] for s in scored]
    df["risk_band"] = [s["risk_band"] for s in scored]
    df["risk_drivers"] = [s["risk_drivers"] for s in scored]
    return df, None


def compute_kpis(df: pd.DataFrame, annual_revenue: float | None) -> list[dict[str, Any]]:
    """Aggregate the frame into (scope, metric) rows for `kpi_snapshots`."""
    rows: list[dict[str, Any]] = []

    def emit(scope_type: str, scope_value: str, metrics: dict[str, float | None]) -> None:
        for key, value in metrics.items():
            if value is None or pd.isna(value):
                continue
            rows.append(
                {
                    "scope_type": scope_type,
                    "scope_value": scope_value,
                    "metric_key": key,
                    "metric_value": float(value),
                }
            )

    def metrics_for(frame: pd.DataFrame) -> dict[str, float | None]:
        headcount = len(frame)
        if headcount == 0:
            return {}
        leavers = frame[frame["attrition"]]
        active = frame[~frame["attrition"]]

        promoters = (frame["enps_category"] == "Promoter").sum()
        detractors = (frame["enps_category"] == "Detractor").sum()
        enps = (promoters - detractors) / headcount * 100

        # Pay equity: mean income gap between men and women, expressed as the
        # percentage by which the female mean trails the male mean.
        by_gender = frame.groupby("gender")["monthly_income"].mean()
        male = by_gender.get("Male")
        female = by_gender.get("Female")
        pay_gap = None
        if male and female and male > 0:
            pay_gap = (male - female) / male * 100

        out: dict[str, float | None] = {
            "headcount": headcount,
            "active_headcount": len(active),
            "attrition_count": len(leavers),
            "attrition_rate": frame["attrition"].mean() * 100,
            "early_attrition_count": int(frame["is_early_attrition"].sum()),
            "early_attrition_rate": frame["is_early_attrition"].mean() * 100,
            "avg_job_satisfaction": frame["job_satisfaction"].mean(),
            "avg_monthly_income": frame["monthly_income"].mean(),
            "median_monthly_income": frame["monthly_income"].median(),
            "avg_engagement_index": frame["engagement_index"].mean(),
            "enps": enps,
            "avg_tenure_years": frame["years_at_company"].mean(),
            "overtime_rate": frame["over_time"].mean() * 100,
            "avg_performance_rating": frame["performance_rating"].mean(),
            "gender_pay_gap_pct": pay_gap,
            # Proxy for internal mobility: promoted within the last two years.
            "internal_mobility_rate": (frame["years_since_last_promotion"] <= 1).mean()
            * 100,
            # Quality of hire proxy: mean performance rating among people who
            # joined within the last two years.
            "quality_of_hire": (
                frame.loc[frame["years_at_company"] <= 2, "performance_rating"].mean()
                if (frame["years_at_company"] <= 2).any()
                else None
            ),
        }

        if "risk_score" in frame.columns and frame["risk_score"].notna().any():
            out["avg_risk_score"] = frame["risk_score"].mean() * 100
            out["high_risk_count"] = int((frame["risk_band"] == "High").sum())

        if annual_revenue and len(active) > 0:
            out["revenue_per_employee"] = annual_revenue / len(active)

        return out

    emit("company", "__all__", metrics_for(df))

    for department, frame in df.groupby("department"):
        emit("department", str(department), metrics_for(frame))

    for job_role, frame in df.groupby("job_role"):
        emit("job_role", str(job_role), metrics_for(frame))

    return rows


async def store_kpis(session: AsyncSession, rows: list[dict[str, Any]]) -> int:
    """Replace the snapshot table with freshly computed metrics."""
    await session.execute(delete(KpiSnapshot))
    now = datetime.now(timezone.utc)
    for row in rows:
        row["computed_at"] = now
    if rows:
        for start in range(0, len(rows), 500):
            await session.execute(insert(KpiSnapshot), rows[start : start + 500])
    return len(rows)


async def bump_realtime(session: AsyncSession, event: str) -> int:
    """Increment the change counter the SSE stream watches."""
    stmt = (
        pg_insert(RealtimeState)
        .values(id=1, version=1, last_event=event)
        .on_conflict_do_update(
            index_elements=[RealtimeState.id],
            set_={
                "version": RealtimeState.__table__.c.version + 1,
                "last_event": event,
                "updated_at": datetime.now(timezone.utc),
            },
        )
        .returning(RealtimeState.version)
    )
    result = await session.execute(stmt)
    return int(result.scalar_one())


async def get_annual_revenue(session: AsyncSession) -> float | None:
    from backend.models import AppSetting

    setting = await session.get(AppSetting, "annual_revenue")
    if setting and isinstance(setting.value, dict):
        value = setting.value.get("annual_revenue")
        if isinstance(value, (int, float)) and value > 0:
            return float(value)
    return None


async def run_ingest(
    session: AsyncSession,
    *,
    payload: bytes,
    filename: str,
    actor_user_id: int | None,
) -> IngestRun:
    """Execute the full pipeline for one uploaded file.

    Always returns an `IngestRun` row describing what happened — including on
    failure, so the admin console can show the reason rather than a bare 500.
    """
    run = IngestRun(filename=filename, status="running", actor_user_id=actor_user_id)
    session.add(run)
    await session.flush()

    try:
        raw = read_csv_bytes(payload, filename)
        run.rows_received = len(raw)

        df, warnings = transform(raw)
        run.rows_rejected = max(0, len(raw) - len(df))

        df, model_warning = apply_risk_scores(df)
        if model_warning:
            warnings.append(
                f"Attrition risk scores were not applied: {model_warning}"
            )

        loaded = await load_employees(session, df, run.id)

        annual_revenue = await get_annual_revenue(session)
        kpi_rows = compute_kpis(df, annual_revenue)
        await store_kpis(session, kpi_rows)
        if annual_revenue is None:
            warnings.append(
                "Revenue per Employee was not computed — set an annual revenue "
                "figure in Admin > Settings to enable it."
            )

        await bump_realtime(session, "ingest.completed")

        run.rows_loaded = loaded
        run.warnings = warnings
        run.status = "succeeded"
        run.finished_at = datetime.now(timezone.utc)
        await session.flush()
        return run

    except TransformError as exc:
        run.status = "failed"
        run.error = str(exc)
        run.finished_at = datetime.now(timezone.utc)
        await session.flush()
        return run
    except Exception as exc:  # noqa: BLE001 - surfaced to the admin console
        run.status = "failed"
        run.error = f"{type(exc).__name__}: {exc}"
        run.finished_at = datetime.now(timezone.utc)
        await session.flush()
        return run


async def recompute_kpis(session: AsyncSession) -> int:
    """Recalculate snapshots from what is already in `employees`.

    Used when a setting changes (annual revenue) without a new upload.
    """
    result = await session.execute(select(Employee))
    employees = result.scalars().all()
    if not employees:
        return 0

    df = pd.DataFrame(
        [
            {c.name: getattr(emp, c.name) for c in Employee.__table__.columns}
            for emp in employees
        ]
    )
    annual_revenue = await get_annual_revenue(session)
    rows = compute_kpis(df, annual_revenue)
    await store_kpis(session, rows)
    await bump_realtime(session, "kpis.recomputed")
    return len(rows)

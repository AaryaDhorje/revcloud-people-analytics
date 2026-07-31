"""Admin console: data ingestion, user management, settings, audit trail.

Every route here is gated on the `admin` role.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import (
    APIRouter,
    File,
    HTTPException,
    Query,
    Request,
    UploadFile,
    status,
)
from sqlalchemy import desc, func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert

from backend.deps import RequireAdmin, SessionDep, record_audit
from backend.etl.pipeline import bump_realtime, get_annual_revenue, recompute_kpis, run_ingest
from backend.models import AppSetting, AuditLog, DemoRequest, Employee, IngestRun, User
from backend.schemas import (
    AnnualRevenueRequest,
    AuditLogOut,
    IngestRunOut,
    UserOut,
    UserUpdateRequest,
)

router = APIRouter(prefix="/api/py/admin", tags=["admin"])

# Generous enough for a full HRIS extract, small enough that a stray upload
# cannot exhaust the function's memory.
MAX_UPLOAD_BYTES = 25 * 1024 * 1024


@router.post("/ingest", response_model=IngestRunOut)
async def ingest_csv(
    request: Request,
    session: SessionDep,
    admin: RequireAdmin,
    file: UploadFile = File(...),
) -> Any:
    """Upload an HR extract and run the full ETL pipeline over it."""
    if not (file.filename or "").lower().endswith(".csv"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please upload a .csv file.",
        )

    payload = await file.read()
    if len(payload) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds the {MAX_UPLOAD_BYTES // (1024 * 1024)} MB limit.",
        )
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="The uploaded file is empty."
        )

    run = await run_ingest(
        session,
        payload=payload,
        filename=file.filename or "upload.csv",
        actor_user_id=admin.id,
    )

    await record_audit(
        session,
        request=request,
        user=admin,
        action="admin.ingest",
        resource=f"ingest_run:{run.id}",
        detail={
            "filename": run.filename,
            "status": run.status,
            "rows_loaded": run.rows_loaded,
        },
    )
    return run


@router.get("/ingest-runs", response_model=list[IngestRunOut])
async def list_ingest_runs(
    session: SessionDep, admin: RequireAdmin, limit: int = Query(default=10, le=50)
) -> Any:
    rows = (
        await session.execute(
            select(IngestRun).order_by(desc(IngestRun.started_at)).limit(limit)
        )
    ).scalars().all()
    return rows


@router.get("/users", response_model=list[UserOut])
async def list_users(session: SessionDep, admin: RequireAdmin) -> Any:
    rows = (
        await session.execute(select(User).order_by(User.created_at))
    ).scalars().all()
    return rows


@router.patch("/users/{user_id}", response_model=UserOut)
async def update_user(
    user_id: int,
    payload: UserUpdateRequest,
    request: Request,
    session: SessionDep,
    admin: RequireAdmin,
) -> Any:
    user = await session.get(User, user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="No such user."
        )

    if user.id == admin.id and payload.role and payload.role != "admin":
        # Guard against an admin locking themselves (and possibly everyone) out.
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot remove your own admin role.",
        )
    if user.id == admin.id and payload.is_active is False:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot deactivate your own account.",
        )

    changes: dict[str, Any] = {}
    if payload.role is not None and payload.role != user.role:
        changes["role"] = {"from": user.role, "to": payload.role}
        user.role = payload.role
    if payload.department is not None and payload.department != user.department:
        changes["department"] = {"from": user.department, "to": payload.department}
        user.department = payload.department or None
    if payload.is_active is not None and payload.is_active != user.is_active:
        changes["is_active"] = {"from": user.is_active, "to": payload.is_active}
        user.is_active = payload.is_active

    if changes:
        # Any change to role, scope or activation must invalidate live sessions,
        # otherwise a demoted user keeps their old access until the token expires.
        user.token_version += 1
        await record_audit(
            session,
            request=request,
            user=admin,
            action="admin.user_updated",
            resource=f"user:{user.id}",
            detail=changes,
        )
    return user


@router.get("/audit-logs", response_model=list[AuditLogOut])
async def list_audit_logs(
    session: SessionDep,
    admin: RequireAdmin,
    limit: int = Query(default=100, le=500),
    action: str | None = Query(default=None),
) -> Any:
    stmt = select(AuditLog).order_by(desc(AuditLog.created_at)).limit(limit)
    if action:
        stmt = stmt.where(AuditLog.action == action)
    return (await session.execute(stmt)).scalars().all()


@router.get("/demo-requests")
async def list_demo_requests(
    session: SessionDep, admin: RequireAdmin, limit: int = Query(default=50, le=200)
) -> list[dict[str, Any]]:
    rows = (
        await session.execute(
            select(DemoRequest).order_by(desc(DemoRequest.created_at)).limit(limit)
        )
    ).scalars().all()
    return [
        {
            "id": r.id,
            "email": r.email,
            "full_name": r.full_name,
            "company": r.company,
            "message": r.message,
            "created_at": r.created_at,
        }
        for r in rows
    ]


@router.get("/settings")
async def get_settings_values(session: SessionDep, admin: RequireAdmin) -> dict[str, Any]:
    revenue = await get_annual_revenue(session)
    setting = await session.get(AppSetting, "annual_revenue")
    headcount = await session.scalar(
        select(func.count(Employee.id)).where(Employee.attrition.is_(False))
    )
    return {
        "annual_revenue": revenue,
        "currency": (setting.value or {}).get("currency", "USD") if setting else "USD",
        "active_headcount": int(headcount or 0),
        "revenue_per_employee": (revenue / headcount) if revenue and headcount else None,
    }


@router.put("/settings/annual-revenue")
async def set_annual_revenue(
    payload: AnnualRevenueRequest,
    request: Request,
    session: SessionDep,
    admin: RequireAdmin,
) -> dict[str, Any]:
    """Supply the revenue figure that unlocks Revenue-per-Employee."""
    value = {"annual_revenue": payload.annual_revenue, "currency": payload.currency}
    await session.execute(
        pg_insert(AppSetting)
        .values(key="annual_revenue", value=value)
        .on_conflict_do_update(
            index_elements=[AppSetting.key],
            set_={"value": value, "updated_at": datetime.now(timezone.utc)},
        )
    )
    await session.flush()

    # Recompute so the new metric appears without waiting for the next upload.
    recomputed = await recompute_kpis(session)
    await bump_realtime(session, "settings.updated")

    await record_audit(
        session,
        request=request,
        user=admin,
        action="admin.settings_updated",
        resource="setting:annual_revenue",
        detail=value,
    )
    return {
        "annual_revenue": payload.annual_revenue,
        "currency": payload.currency,
        "kpi_rows_recomputed": recomputed,
    }

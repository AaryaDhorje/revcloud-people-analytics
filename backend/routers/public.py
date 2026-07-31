"""Unauthenticated endpoints backing the marketing site."""

from __future__ import annotations

from fastapi import APIRouter, Request, status
from sqlalchemy import func, select

from backend.deps import SessionDep, record_audit
from backend.models import DemoRequest, Employee
from backend.schemas import DemoRequestIn

router = APIRouter(prefix="/api/py/public", tags=["public"])


@router.post("/demo-request", status_code=status.HTTP_201_CREATED)
async def create_demo_request(
    payload: DemoRequestIn, request: Request, session: SessionDep
) -> dict[str, str]:
    session.add(
        DemoRequest(
            email=payload.email.strip().lower(),
            full_name=payload.full_name,
            company=payload.company,
            message=payload.message,
        )
    )
    await record_audit(
        session,
        request=request,
        user=None,
        action="public.demo_requested",
        resource="demo_request",
        detail={"email": payload.email},
    )
    return {
        "message": "Thanks — we'll be in touch shortly to arrange your walkthrough."
    }


@router.get("/stats")
async def public_stats(session: SessionDep) -> dict[str, float | int]:
    """Headline figures for the landing page.

    Aggregate-only and non-identifying, so it is safe to serve unauthenticated.
    """
    row = (
        await session.execute(
            select(
                func.count(Employee.id),
                func.count(func.distinct(Employee.department)),
                func.count(func.distinct(Employee.job_role)),
            )
        )
    ).one()

    return {
        "employees_analyzed": int(row[0] or 0),
        "departments": int(row[1] or 0),
        "job_roles": int(row[2] or 0),
    }

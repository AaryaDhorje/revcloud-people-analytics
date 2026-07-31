from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, or_, select

from backend import analytics as q
from backend.deps import CurrentUser, ScopeDep, SessionDep, record_audit
from backend.models import Employee
from backend.schemas import EmployeeProfile, EmployeeSearchResponse

router = APIRouter(prefix="/api/py/employees", tags=["employees"])

FiltersDep = Annotated[q.EmployeeFilters, Depends(q.filter_params)]


@router.get("", response_model=EmployeeSearchResponse)
async def search_employees(
    session: SessionDep,
    scope: ScopeDep,
    user: CurrentUser,
    filters: FiltersDep,
    search: str | None = Query(default=None, max_length=120),
    risk_band: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
) -> Any:
    """Page 3: employee directory, always inside the caller's data scope."""
    stmt = q.apply_filters(select(Employee), filters, scope)

    if search:
        term = search.strip()
        clauses = [
            Employee.job_role.ilike(f"%{term}%"),
            Employee.department.ilike(f"%{term}%"),
        ]
        # Employees are identified by number in this dataset — there are no
        # names — so a numeric search targets the ID directly.
        if term.isdigit():
            clauses.append(Employee.employee_number == int(term))
        stmt = stmt.where(or_(*clauses))

    if risk_band in {"High", "Medium", "Low"}:
        stmt = stmt.where(Employee.risk_band == risk_band)

    total = await session.scalar(
        select(func.count()).select_from(stmt.subquery())
    )

    rows = (
        await session.execute(
            stmt.order_by(Employee.risk_score.desc().nullslast(), Employee.employee_number)
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
    ).scalars().all()

    return {
        "results": rows,
        "total": int(total or 0),
        "page": page,
        "page_size": page_size,
    }


@router.get("/{employee_number}", response_model=EmployeeProfile)
async def employee_profile(
    employee_number: int,
    request: Request,
    session: SessionDep,
    scope: ScopeDep,
    user: CurrentUser,
) -> Any:
    stmt = select(Employee).where(Employee.employee_number == employee_number)
    if scope.department:
        stmt = stmt.where(Employee.department == scope.department)

    employee = (await session.execute(stmt)).scalar_one_or_none()
    if employee is None:
        # Deliberately identical whether the record is absent or merely out of
        # scope — a manager should not be able to probe for the existence of
        # employees in other departments.
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No employee with that number is available to you.",
        )

    # Opening an individual profile is the most sensitive read in the product,
    # so it is audited per record rather than in aggregate.
    await record_audit(
        session,
        request=request,
        user=user,
        action="employee.profile_viewed",
        resource=f"employee:{employee_number}",
        detail={"department": employee.department},
    )
    return employee

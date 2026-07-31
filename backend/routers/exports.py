"""CSV export of the currently filtered dataset.

Export runs server-side so the RBAC scope is applied to the file itself — a
manager's download physically cannot contain another department's rows. PDF
export is handled client-side instead, where the rendered charts already live.
"""

from __future__ import annotations

import csv
import io
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from sqlalchemy import select

from backend import analytics as q
from backend.deps import CurrentUser, ScopeDep, SessionDep, record_audit
from backend.models import Employee

router = APIRouter(prefix="/api/py/exports", tags=["exports"])

FiltersDep = Annotated[q.EmployeeFilters, Depends(q.filter_params)]

EXPORT_COLUMNS = [
    ("employee_number", "Employee Number"),
    ("department", "Department"),
    ("job_role", "Job Role"),
    ("job_level", "Job Level"),
    ("age", "Age"),
    ("age_group", "Age Group"),
    ("gender", "Gender"),
    ("marital_status", "Marital Status"),
    ("education_field", "Education Field"),
    ("business_travel", "Business Travel"),
    ("over_time", "Overtime"),
    ("monthly_income", "Monthly Income"),
    ("income_band", "Income Band"),
    ("percent_salary_hike", "Last Salary Hike %"),
    ("stock_option_level", "Stock Option Level"),
    ("years_at_company", "Years At Company"),
    ("tenure_band", "Tenure Band"),
    ("years_in_current_role", "Years In Current Role"),
    ("years_since_last_promotion", "Years Since Last Promotion"),
    ("years_with_curr_manager", "Years With Current Manager"),
    ("total_working_years", "Total Working Years"),
    ("num_companies_worked", "Previous Employers"),
    ("job_satisfaction", "Job Satisfaction"),
    ("environment_satisfaction", "Environment Satisfaction"),
    ("relationship_satisfaction", "Relationship Satisfaction"),
    ("job_involvement", "Job Involvement"),
    ("work_life_balance", "Work-Life Balance"),
    ("performance_rating", "Performance Rating"),
    ("training_times_last_year", "Trainings Last Year"),
    ("engagement_index", "Engagement Index"),
    ("enps_category", "eNPS Category"),
    ("hire_date", "Hire Date (derived)"),
    ("exit_date", "Exit Date (derived)"),
    ("attrition", "Attrition"),
    ("risk_score", "Attrition Risk Score"),
    ("risk_band", "Attrition Risk Band"),
]


@router.get("/employees.csv")
async def export_employees_csv(
    request: Request,
    session: SessionDep,
    scope: ScopeDep,
    user: CurrentUser,
    filters: FiltersDep,
) -> StreamingResponse:
    stmt = q.apply_filters(select(Employee), filters, scope).order_by(
        Employee.employee_number
    )
    employees = (await session.execute(stmt)).scalars().all()

    buffer = io.StringIO()
    writer = csv.writer(buffer, lineterminator="\n")
    writer.writerow([label for _, label in EXPORT_COLUMNS])

    for emp in employees:
        row = []
        for attr, _label in EXPORT_COLUMNS:
            value = getattr(emp, attr, None)
            if isinstance(value, bool):
                value = "Yes" if value else "No"
            elif attr == "risk_score" and value is not None:
                value = round(value * 100, 1)
            row.append("" if value is None else value)
        writer.writerow(row)

    await record_audit(
        session,
        request=request,
        user=user,
        action="export.employees_csv",
        resource="export:employees",
        detail={"rows": len(employees), "scoped_to": scope.department},
    )

    stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M")
    suffix = f"-{scope.department.replace(' ', '-').lower()}" if scope.department else ""
    filename = f"revcloud-employees{suffix}-{stamp}.csv"

    buffer.seek(0)
    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )

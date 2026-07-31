from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

Role = Literal["admin", "manager", "viewer"]


# --------------------------------------------------------------------------- #
# Auth
# --------------------------------------------------------------------------- #
class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)
    full_name: str = Field(min_length=1, max_length=160)
    # Self-service signup can only ever produce a viewer. Elevating an account
    # to manager or admin is an admin-only action through /admin/users.
    department: str | None = Field(default=None, max_length=120)

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if not any(c.isalpha() for c in v) or not any(c.isdigit() for c in v):
            raise ValueError("Password must contain both letters and numbers.")
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=72)


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str = Field(min_length=10)
    password: str = Field(min_length=8, max_length=72)

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if not any(c.isalpha() for c in v) or not any(c.isdigit() for c in v):
            raise ValueError("Password must contain both letters and numbers.")
        return v


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: EmailStr
    full_name: str
    role: Role
    department: str | None
    is_active: bool
    created_at: datetime
    last_login_at: datetime | None


class SessionOut(BaseModel):
    user: UserOut
    access_token_expires_in: int
    idle_timeout_minutes: int


# --------------------------------------------------------------------------- #
# Admin
# --------------------------------------------------------------------------- #
class UserUpdateRequest(BaseModel):
    role: Role | None = None
    department: str | None = Field(default=None, max_length=120)
    is_active: bool | None = None


class AnnualRevenueRequest(BaseModel):
    # Enables Revenue-per-Employee, which the source dataset cannot supply.
    annual_revenue: float = Field(ge=0)
    currency: str = Field(default="USD", max_length=8)


# --------------------------------------------------------------------------- #
# Public
# --------------------------------------------------------------------------- #
class DemoRequestIn(BaseModel):
    email: EmailStr
    full_name: str | None = Field(default=None, max_length=160)
    company: str | None = Field(default=None, max_length=160)
    message: str | None = Field(default=None, max_length=2000)


# --------------------------------------------------------------------------- #
# Analytics
# --------------------------------------------------------------------------- #
class FilterOptions(BaseModel):
    departments: list[str]
    job_roles: list[str]
    age_groups: list[str]
    tenure_bands: list[str]
    date_range: dict[str, date | None]
    # Managers see a locked department chip rather than a free chooser.
    locked_department: str | None = None


class KpiCard(BaseModel):
    key: str
    label: str
    value: float | None
    unit: Literal["count", "percent", "currency", "score", "years", "none"]
    # Present only where the dataset genuinely supports a comparison.
    delta: float | None = None
    caption: str | None = None
    available: bool = True
    unavailable_reason: str | None = None


class NamedValue(BaseModel):
    name: str
    value: float


class DepartmentAttrition(BaseModel):
    department: str
    headcount: int
    attrition_count: int
    attrition_rate: float


class AgeGenderAttrition(BaseModel):
    age_group: str
    male_attrition: int
    female_attrition: int
    male_headcount: int
    female_headcount: int


class TrendPoint(BaseModel):
    period: str
    exits: int
    headcount: int
    attrition_rate: float


class OverviewResponse(BaseModel):
    kpis: list[KpiCard]
    gender_distribution: list[NamedValue]
    attrition_by_department: list[DepartmentAttrition]
    attrition_by_age_gender: list[AgeGenderAttrition]
    attrition_trend: list[TrendPoint]
    generated_at: datetime
    scope_note: str | None = None


class ScatterPoint(BaseModel):
    years_at_company: int
    monthly_income: int
    attrition: bool
    job_role: str
    department: str


class TreemapNode(BaseModel):
    name: str
    size: int
    attrition_rate: float


class HeatmapCell(BaseModel):
    department: str
    tenure_band: str
    headcount: int
    attrition_count: int
    attrition_rate: float


class RiskDriver(BaseModel):
    feature: str
    label: str
    contribution: float
    direction: Literal["increases", "decreases"]


class HighRiskEmployee(BaseModel):
    employee_number: int
    department: str
    job_role: str
    age: int
    years_at_company: int
    monthly_income: int
    over_time: bool
    job_satisfaction: int
    years_since_last_promotion: int
    engagement_index: float
    risk_score: float
    risk_band: str
    risk_drivers: list[RiskDriver]


class DeepDiveResponse(BaseModel):
    scatter: list[ScatterPoint]
    treemap: list[TreemapNode]
    heatmap: list[HeatmapCell]
    high_risk: list[HighRiskEmployee]
    pay_equity: dict[str, Any]
    generated_at: datetime
    model_available: bool
    scope_note: str | None = None


# --------------------------------------------------------------------------- #
# Employees
# --------------------------------------------------------------------------- #
class EmployeeSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    employee_number: int
    department: str
    job_role: str
    age: int
    gender: str
    years_at_company: int
    monthly_income: int
    attrition: bool
    risk_score: float | None
    risk_band: str | None


class EmployeeProfile(EmployeeSummary):
    marital_status: str
    education: int
    education_field: str
    distance_from_home: int
    job_level: int
    business_travel: str
    over_time: bool
    monthly_rate: int
    daily_rate: int
    hourly_rate: int
    percent_salary_hike: int
    stock_option_level: int
    job_satisfaction: int
    environment_satisfaction: int
    relationship_satisfaction: int
    job_involvement: int
    work_life_balance: int
    performance_rating: int
    training_times_last_year: int
    total_working_years: int
    num_companies_worked: int
    years_in_current_role: int
    years_since_last_promotion: int
    years_with_curr_manager: int
    age_group: str
    tenure_band: str
    engagement_index: float
    enps_category: str
    hire_date: date
    exit_date: date | None
    risk_drivers: list[RiskDriver] | None


class EmployeeSearchResponse(BaseModel):
    results: list[EmployeeSummary]
    total: int
    page: int
    page_size: int


# --------------------------------------------------------------------------- #
# Ingest
# --------------------------------------------------------------------------- #
class IngestRunOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    filename: str
    status: str
    rows_received: int
    rows_loaded: int
    rows_rejected: int
    error: str | None
    warnings: list[Any] | None
    started_at: datetime
    finished_at: datetime | None


class AuditLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    actor_email: str | None
    action: str
    resource: str
    detail: dict[str, Any] | None
    ip_address: str | None
    created_at: datetime

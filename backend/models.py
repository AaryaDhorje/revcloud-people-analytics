from datetime import date, datetime, timezone

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


ROLES = ("admin", "manager", "viewer")


class User(Base):
    """Platform account.

    `department` is the RBAC scope for managers: a manager may only ever read
    employees whose department matches. It is null for admins and viewers.
    """

    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint(
            "role IN ('admin', 'manager', 'viewer')", name="ck_users_role"
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    full_name: Mapped[str] = mapped_column(String(160))
    role: Mapped[str] = mapped_column(String(20), default="viewer")
    department: Mapped[str | None] = mapped_column(String(120), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    last_login_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    # Bumping this invalidates every refresh token already issued to the user,
    # which is how logout-everywhere and password reset revoke old sessions.
    token_version: Mapped[int] = mapped_column(Integer, default=0)

    reset_tokens: Mapped[list["PasswordResetToken"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )


class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    # Only the hash is stored, so a database leak cannot be replayed as a reset.
    token_hash: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    used_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    user: Mapped[User] = relationship(back_populates="reset_tokens")


class Employee(Base):
    """One row per employee, mapped from the IBM HR Analytics dataset.

    Columns fall into three groups:
      * source columns, carried across verbatim from the CSV
      * derived columns, computed by the ETL transform step
      * model columns, written by the attrition scorer

    The three constant source columns (EmployeeCount=1, Over18='Y',
    StandardHours=80) are dropped during transform — they carry no signal.
    """

    __tablename__ = "employees"
    __table_args__ = (
        Index("ix_employees_department_attrition", "department", "attrition"),
        Index("ix_employees_job_role", "job_role"),
        Index("ix_employees_risk_score", "risk_score"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    employee_number: Mapped[int] = mapped_column(Integer, unique=True, index=True)

    # --- source: demographics -------------------------------------------------
    age: Mapped[int] = mapped_column(Integer)
    gender: Mapped[str] = mapped_column(String(20))
    marital_status: Mapped[str] = mapped_column(String(30))
    education: Mapped[int] = mapped_column(Integer)
    education_field: Mapped[str] = mapped_column(String(60))
    distance_from_home: Mapped[int] = mapped_column(Integer)

    # --- source: role ---------------------------------------------------------
    department: Mapped[str] = mapped_column(String(120), index=True)
    job_role: Mapped[str] = mapped_column(String(120))
    job_level: Mapped[int] = mapped_column(Integer)
    business_travel: Mapped[str] = mapped_column(String(40))
    over_time: Mapped[bool] = mapped_column(Boolean)

    # --- source: compensation -------------------------------------------------
    monthly_income: Mapped[int] = mapped_column(Integer)
    monthly_rate: Mapped[int] = mapped_column(Integer)
    daily_rate: Mapped[int] = mapped_column(Integer)
    hourly_rate: Mapped[int] = mapped_column(Integer)
    percent_salary_hike: Mapped[int] = mapped_column(Integer)
    stock_option_level: Mapped[int] = mapped_column(Integer)

    # --- source: satisfaction / performance (1-4 Likert unless noted) ---------
    job_satisfaction: Mapped[int] = mapped_column(Integer)
    environment_satisfaction: Mapped[int] = mapped_column(Integer)
    relationship_satisfaction: Mapped[int] = mapped_column(Integer)
    job_involvement: Mapped[int] = mapped_column(Integer)
    work_life_balance: Mapped[int] = mapped_column(Integer)
    performance_rating: Mapped[int] = mapped_column(Integer)
    training_times_last_year: Mapped[int] = mapped_column(Integer)

    # --- source: tenure -------------------------------------------------------
    total_working_years: Mapped[int] = mapped_column(Integer)
    num_companies_worked: Mapped[int] = mapped_column(Integer)
    years_at_company: Mapped[int] = mapped_column(Integer)
    years_in_current_role: Mapped[int] = mapped_column(Integer)
    years_since_last_promotion: Mapped[int] = mapped_column(Integer)
    years_with_curr_manager: Mapped[int] = mapped_column(Integer)

    # --- source: outcome ------------------------------------------------------
    attrition: Mapped[bool] = mapped_column(Boolean, index=True)

    # --- derived --------------------------------------------------------------
    age_group: Mapped[str] = mapped_column(String(20))
    tenure_band: Mapped[str] = mapped_column(String(20))
    income_band: Mapped[str] = mapped_column(String(20))
    # 0-100 composite of the five satisfaction/involvement Likert scores.
    engagement_index: Mapped[float] = mapped_column(Float)
    # Promoter / Passive / Detractor, derived from engagement_index.
    enps_category: Mapped[str] = mapped_column(String(20))
    is_early_attrition: Mapped[bool] = mapped_column(Boolean, default=False)
    # Synthesized from YearsAtCompany — the source data has no real dates.
    # Deterministic, so re-ingesting the same CSV yields the same timeline.
    hire_date: Mapped[date] = mapped_column(Date, index=True)
    exit_date: Mapped[date | None] = mapped_column(Date, nullable=True, index=True)

    # --- model output ---------------------------------------------------------
    risk_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    risk_band: Mapped[str | None] = mapped_column(String(20), nullable=True)
    risk_drivers: Mapped[list | None] = mapped_column(JSONB, nullable=True)

    ingest_run_id: Mapped[int | None] = mapped_column(
        ForeignKey("ingest_runs.id", ondelete="SET NULL"), nullable=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=utcnow
    )


class KpiSnapshot(Base):
    """Pre-aggregated metrics, recomputed at the end of every ingest.

    Dashboard cards read from here instead of scanning `employees`, which keeps
    the overview responsive as the employee table grows.
    """

    __tablename__ = "kpi_snapshots"
    __table_args__ = (
        UniqueConstraint(
            "scope_type", "scope_value", "metric_key", name="uq_kpi_scope_metric"
        ),
        Index("ix_kpi_scope", "scope_type", "scope_value"),
        CheckConstraint(
            "scope_type IN ('company', 'department', 'job_role')",
            name="ck_kpi_scope_type",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    scope_type: Mapped[str] = mapped_column(String(20))
    scope_value: Mapped[str] = mapped_column(String(120), default="__all__")
    metric_key: Mapped[str] = mapped_column(String(60))
    metric_value: Mapped[float] = mapped_column(Numeric(18, 4))
    computed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class AuditLog(Base):
    """Who touched which data, and when. Required for the compliance story."""

    __tablename__ = "audit_logs"
    __table_args__ = (Index("ix_audit_created_at", "created_at"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    actor_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    action: Mapped[str] = mapped_column(String(80), index=True)
    resource: Mapped[str] = mapped_column(String(160))
    detail: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(64), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class DemoRequest(Base):
    """Captures the landing page's "Request Demo" form."""

    __tablename__ = "demo_requests"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), index=True)
    full_name: Mapped[str | None] = mapped_column(String(160), nullable=True)
    company: Mapped[str | None] = mapped_column(String(160), nullable=True)
    message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class IngestRun(Base):
    """One CSV upload through the admin console."""

    __tablename__ = "ingest_runs"
    __table_args__ = (
        CheckConstraint(
            "status IN ('running', 'succeeded', 'failed')", name="ck_ingest_status"
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    filename: Mapped[str] = mapped_column(String(255))
    status: Mapped[str] = mapped_column(String(20), default="running")
    rows_received: Mapped[int] = mapped_column(Integer, default=0)
    rows_loaded: Mapped[int] = mapped_column(Integer, default=0)
    rows_rejected: Mapped[int] = mapped_column(Integer, default=0)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    warnings: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    actor_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    finished_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )


class RealtimeState(Base):
    """Single-row table acting as the change counter for the SSE stream.

    Postgres LISTEN/NOTIFY would be the natural fit, but it needs a connection
    held open for the lifetime of the listener — which neither serverless
    functions nor transaction-mode poolers provide. Bumping an integer and
    having the SSE endpoint watch it costs one cheap indexed read per tick and
    works identically on a laptop and on Vercel.
    """

    __tablename__ = "realtime_state"

    id: Mapped[int] = mapped_column(primary_key=True, default=1)
    version: Mapped[int] = mapped_column(BigInteger, default=0)
    last_event: Mapped[str | None] = mapped_column(String(80), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=utcnow
    )


class AppSetting(Base):
    """Admin-editable key/value config.

    Currently holds `annual_revenue`, which is what turns Revenue-per-Employee
    from an unavailable metric into a real one.
    """

    __tablename__ = "app_settings"

    key: Mapped[str] = mapped_column(String(80), primary_key=True)
    value: Mapped[dict] = mapped_column(JSONB)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=utcnow
    )

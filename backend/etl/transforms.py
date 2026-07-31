"""Transform stage of the ETL pipeline.

Everything here is deterministic: re-ingesting the same CSV must produce byte
identical derived columns, otherwise the dashboard would shift under the user
between two uploads of the same file.
"""

from __future__ import annotations

import calendar
import zlib
from datetime import date, timedelta

import numpy as np
import pandas as pd

# The IBM dataset is an undated snapshot. We anchor the synthesized timeline to
# a fixed "as of" date so the attrition trend is stable across ingests.
REFERENCE_DATE = date(2023, 12, 31)

# How far back synthesized exits are spread. Two years gives the trend chart
# enough points to be readable without implying precision we do not have.
EXIT_WINDOW_MONTHS = 24

# Source columns that carry a single constant value for all 1,470 rows. They
# have zero analytical value, so they are dropped rather than stored.
CONSTANT_COLUMNS = {"EmployeeCount", "Over18", "StandardHours"}

# CSV header -> ORM attribute.
COLUMN_MAP: dict[str, str] = {
    "Age": "age",
    "Attrition": "attrition",
    "BusinessTravel": "business_travel",
    "DailyRate": "daily_rate",
    "Department": "department",
    "DistanceFromHome": "distance_from_home",
    "Education": "education",
    "EducationField": "education_field",
    "EmployeeNumber": "employee_number",
    "EnvironmentSatisfaction": "environment_satisfaction",
    "Gender": "gender",
    "HourlyRate": "hourly_rate",
    "JobInvolvement": "job_involvement",
    "JobLevel": "job_level",
    "JobRole": "job_role",
    "JobSatisfaction": "job_satisfaction",
    "MaritalStatus": "marital_status",
    "MonthlyIncome": "monthly_income",
    "MonthlyRate": "monthly_rate",
    "NumCompaniesWorked": "num_companies_worked",
    "OverTime": "over_time",
    "PercentSalaryHike": "percent_salary_hike",
    "PerformanceRating": "performance_rating",
    "RelationshipSatisfaction": "relationship_satisfaction",
    "StockOptionLevel": "stock_option_level",
    "TotalWorkingYears": "total_working_years",
    "TrainingTimesLastYear": "training_times_last_year",
    "WorkLifeBalance": "work_life_balance",
    "YearsAtCompany": "years_at_company",
    "YearsInCurrentRole": "years_in_current_role",
    "YearsSinceLastPromotion": "years_since_last_promotion",
    "YearsWithCurrManager": "years_with_curr_manager",
}

REQUIRED_COLUMNS = set(COLUMN_MAP)

# The five Likert items that compose the engagement index. Each is scored 1-4.
ENGAGEMENT_ITEMS = [
    "job_satisfaction",
    "environment_satisfaction",
    "relationship_satisfaction",
    "job_involvement",
    "work_life_balance",
]

INTEGER_COLUMNS = [
    "age",
    "daily_rate",
    "distance_from_home",
    "education",
    "employee_number",
    "environment_satisfaction",
    "hourly_rate",
    "job_involvement",
    "job_level",
    "job_satisfaction",
    "monthly_income",
    "monthly_rate",
    "num_companies_worked",
    "percent_salary_hike",
    "performance_rating",
    "relationship_satisfaction",
    "stock_option_level",
    "total_working_years",
    "training_times_last_year",
    "work_life_balance",
    "years_at_company",
    "years_in_current_role",
    "years_since_last_promotion",
    "years_with_curr_manager",
]

STRING_COLUMNS = [
    "business_travel",
    "department",
    "education_field",
    "gender",
    "job_role",
    "marital_status",
]


class TransformError(ValueError):
    """Raised when the uploaded file cannot be interpreted as HR data."""


def age_group(age: int) -> str:
    if age < 25:
        return "18-24"
    if age < 35:
        return "25-34"
    if age < 45:
        return "35-44"
    if age < 55:
        return "45-54"
    return "55+"


AGE_GROUP_ORDER = ["18-24", "25-34", "35-44", "45-54", "55+"]


def tenure_band(years: int) -> str:
    if years < 1:
        return "<1 yr"
    if years <= 2:
        return "1-2 yrs"
    if years <= 5:
        return "3-5 yrs"
    if years <= 10:
        return "6-10 yrs"
    return "10+ yrs"


TENURE_BAND_ORDER = ["<1 yr", "1-2 yrs", "3-5 yrs", "6-10 yrs", "10+ yrs"]


def income_band(income: int) -> str:
    if income < 3000:
        return "<3k"
    if income < 6000:
        return "3k-6k"
    if income < 10000:
        return "6k-10k"
    return "10k+"


INCOME_BAND_ORDER = ["<3k", "3k-6k", "6k-10k", "10k+"]


def enps_category(index: float) -> str:
    """Map the 0-100 engagement index onto NPS-style buckets.

    Thresholds correspond to a mean Likert score of >=3.2 (promoter) and <=2.4
    (detractor) on the underlying 1-4 scale. This is a *proxy* — the dataset
    has no actual "how likely are you to recommend" question — and the UI
    labels it as such.
    """
    if index >= 73.33:
        return "Promoter"
    if index <= 46.67:
        return "Detractor"
    return "Passive"


def _stable_offset(employee_number: int, modulo: int, salt: str = "") -> int:
    """Deterministic pseudo-random integer in [0, modulo).

    Uses CRC32 rather than `hash()` because Python randomizes string hashing
    per process, which would make the synthesized dates change on every run.
    """
    key = f"{salt}:{employee_number}".encode("utf-8")
    return int(zlib.crc32(key) % modulo)


def _subtract_months(anchor: date, months: int) -> date:
    total = anchor.year * 12 + (anchor.month - 1) - months
    year, month_index = divmod(total, 12)
    # Clamp the day so e.g. 31 Dec minus 2 months lands on 31 Oct, and a Feb
    # target lands on 28th/29th as the calendar dictates.
    last_day = calendar.monthrange(year, month_index + 1)[1]
    return date(year, month_index + 1, min(anchor.day, last_day))


def synthesize_dates(employee_number: int, years_at_company: int, attrited: bool) -> tuple[date, date | None]:
    """Invent a plausible hire (and exit) date from tenure.

    The source dataset records only `YearsAtCompany`, with no calendar dates,
    so an attrition-over-time chart is impossible without deriving a timeline.
    We spread exits deterministically across the trailing two years and back
    date the hire by the recorded tenure.

    This is clearly labelled as derived in the UI. It is presentation scaffolding,
    not a claim about when anyone actually left.
    """
    day_jitter = _stable_offset(employee_number, 365, salt="hire")

    if attrited:
        months_ago = _stable_offset(employee_number, EXIT_WINDOW_MONTHS, salt="exit")
        exit_date = _subtract_months(REFERENCE_DATE, months_ago)
        exit_date -= timedelta(days=_stable_offset(employee_number, 28, salt="exitday"))
        hire = _subtract_months(exit_date, years_at_company * 12)
        hire -= timedelta(days=day_jitter % 30)
        return hire, exit_date

    hire = _subtract_months(REFERENCE_DATE, years_at_company * 12)
    hire -= timedelta(days=day_jitter % 30)
    return hire, None


def validate_columns(df: pd.DataFrame) -> None:
    missing = REQUIRED_COLUMNS - set(df.columns)
    if missing:
        raise TransformError(
            "The uploaded file is missing required columns: "
            + ", ".join(sorted(missing))
        )


def transform(df: pd.DataFrame) -> tuple[pd.DataFrame, list[str]]:
    """Clean and enrich the raw CSV frame.

    Returns the transformed frame plus human-readable warnings describing any
    repairs that were applied, which the admin console surfaces after upload.
    """
    warnings: list[str] = []

    # Excel exports routinely add a UTF-8 BOM to the first header cell.
    df = df.rename(columns=lambda c: str(c).strip().lstrip("﻿"))
    validate_columns(df)

    dropped = CONSTANT_COLUMNS & set(df.columns)
    if dropped:
        warnings.append(
            f"Dropped {len(dropped)} constant column(s) with no analytical value: "
            + ", ".join(sorted(dropped))
        )

    df = df[list(COLUMN_MAP)].rename(columns=COLUMN_MAP)

    before = len(df)
    df = df.drop_duplicates(subset=["employee_number"], keep="last")
    if len(df) < before:
        warnings.append(
            f"Removed {before - len(df)} duplicate row(s) sharing an EmployeeNumber; "
            "the last occurrence of each was kept."
        )

    # --- type coercion ------------------------------------------------------
    for col in INTEGER_COLUMNS:
        df[col] = pd.to_numeric(df[col], errors="coerce")

    for col in STRING_COLUMNS:
        df[col] = df[col].astype(str).str.strip()

    df["attrition"] = _to_bool(df["attrition"])
    df["over_time"] = _to_bool(df["over_time"])

    # --- missing values -----------------------------------------------------
    null_counts = {c: int(df[c].isna().sum()) for c in INTEGER_COLUMNS}
    filled = {c: n for c, n in null_counts.items() if n}

    # employee_number identifies the row; a null there cannot be repaired.
    unusable = df["employee_number"].isna()
    rejected = int(unusable.sum())
    if rejected:
        warnings.append(
            f"Rejected {rejected} row(s) with a missing EmployeeNumber."
        )
        df = df[~unusable]

    for col, count in filled.items():
        if col == "employee_number":
            continue
        # Median is robust to the long right tail on income-like columns.
        median = df[col].median()
        fill_value = 0 if pd.isna(median) else median
        df[col] = df[col].fillna(fill_value)
        warnings.append(
            f"Filled {count} missing value(s) in '{col}' with the column median "
            f"({fill_value:g})."
        )

    df[INTEGER_COLUMNS] = df[INTEGER_COLUMNS].astype(int)

    # --- derived columns ----------------------------------------------------
    df["age_group"] = df["age"].map(age_group)
    df["tenure_band"] = df["years_at_company"].map(tenure_band)
    df["income_band"] = df["monthly_income"].map(income_band)

    likert_sum = df[ENGAGEMENT_ITEMS].sum(axis=1)
    # Five items scored 1-4 => raw range 5..20, rescaled to 0..100.
    df["engagement_index"] = ((likert_sum - 5) / 15.0 * 100).round(2)
    df["enps_category"] = df["engagement_index"].map(enps_category)

    df["is_early_attrition"] = df["attrition"] & (df["years_at_company"] < 1)

    dates = [
        synthesize_dates(int(num), int(yrs), bool(att))
        for num, yrs, att in zip(
            df["employee_number"], df["years_at_company"], df["attrition"]
        )
    ]
    df["hire_date"] = [d[0] for d in dates]
    df["exit_date"] = [d[1] for d in dates]
    warnings.append(
        "Hire and exit dates are derived from YearsAtCompany against a fixed "
        f"{REFERENCE_DATE.isoformat()} reference — the source dataset contains no "
        "calendar dates. Time-based charts are labelled accordingly."
    )

    return df.reset_index(drop=True), warnings


def _to_bool(series: pd.Series) -> pd.Series:
    truthy = {"yes", "y", "true", "1", "t"}
    return (
        series.astype(str).str.strip().str.lower().isin(truthy)
    )


def rows_for_insert(df: pd.DataFrame, ingest_run_id: int | None) -> list[dict]:
    """Convert the transformed frame into ORM-ready dicts.

    numpy scalars are cast back to Python builtins because asyncpg cannot bind
    `np.int64` / `np.bool_` directly.
    """
    records = df.to_dict(orient="records")
    for record in records:
        for key, value in list(record.items()):
            if isinstance(value, (np.integer,)):
                record[key] = int(value)
            elif isinstance(value, (np.floating,)):
                record[key] = float(value)
            elif isinstance(value, (np.bool_,)):
                record[key] = bool(value)
            elif value is pd.NaT:
                record[key] = None
        record["ingest_run_id"] = ingest_run_id
    return records

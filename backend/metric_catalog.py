"""Which metrics from the product brief this dataset can honestly support.

The brief asks for four metric families. The IBM HR Analytics extract covers
most of Retention, Engagement and Workforce, but contains no requisition,
attendance or finance data at all — so Time-to-Hire, Cost-per-Hire, Offer
Acceptance and Absenteeism have no basis in it.

Rather than invent plausible-looking numbers, the platform declares those
metrics unavailable and names the feed that would light them up. The catalog
below is what drives the Data Coverage panel in the UI.
"""

from __future__ import annotations

from typing import Any

# key -> (label, category, unit, source_status, note)
CATALOG: list[dict[str, Any]] = [
    # --- Talent Acquisition ---------------------------------------------------
    {
        "key": "quality_of_hire",
        "label": "Quality of Hire",
        "category": "Talent Acquisition",
        "unit": "score",
        "available": True,
        "note": "Mean performance rating among employees with under two years' tenure.",
    },
    {
        "key": "early_attrition_rate",
        "label": "Early Attrition (<1 yr)",
        "category": "Talent Acquisition",
        "unit": "percent",
        "available": True,
        "note": "Share of the workforce that left within their first year.",
    },
    {
        "key": "time_to_hire",
        "label": "Time-to-Hire",
        "category": "Talent Acquisition",
        "unit": "days",
        "available": False,
        "note": "Requires requisition open/close timestamps from an ATS "
        "(Greenhouse, Lever, Workday Recruiting).",
    },
    {
        "key": "cost_per_hire",
        "label": "Cost-per-Hire",
        "category": "Talent Acquisition",
        "unit": "currency",
        "available": False,
        "note": "Requires recruiting spend per requisition from finance or the ATS.",
    },
    {
        "key": "offer_acceptance_rate",
        "label": "Offer Acceptance Rate",
        "category": "Talent Acquisition",
        "unit": "percent",
        "available": False,
        "note": "Requires offer extended/accepted events from the ATS.",
    },
    # --- Retention & Stability ------------------------------------------------
    {
        "key": "attrition_rate",
        "label": "Overall Attrition Rate",
        "category": "Retention & Stability",
        "unit": "percent",
        "available": True,
        "note": "Share of the population recorded as having left.",
    },
    {
        "key": "avg_tenure_years",
        "label": "Average Tenure",
        "category": "Retention & Stability",
        "unit": "years",
        "available": True,
        "note": None,
    },
    {
        "key": "internal_mobility_rate",
        "label": "Internal Mobility Rate",
        "category": "Retention & Stability",
        "unit": "percent",
        "available": True,
        "note": "Proxy: share promoted within the last two years, derived from "
        "YearsSinceLastPromotion. True lateral moves are not recorded.",
    },
    {
        "key": "voluntary_attrition_rate",
        "label": "Voluntary vs Involuntary Split",
        "category": "Retention & Stability",
        "unit": "percent",
        "available": False,
        "note": "The dataset records that someone left, but not why. Requires "
        "termination reason codes from the HRIS.",
    },
    # --- Engagement & Culture -------------------------------------------------
    {
        "key": "avg_engagement_index",
        "label": "Engagement Index",
        "category": "Engagement & Culture",
        "unit": "score",
        "available": True,
        "note": "Composite of job, environment and relationship satisfaction, "
        "job involvement and work-life balance, rescaled to 0-100.",
    },
    {
        "key": "enps",
        "label": "eNPS (proxy)",
        "category": "Engagement & Culture",
        "unit": "score",
        "available": True,
        "note": "Proxy only. There is no recommend-to-a-friend question in the "
        "dataset; promoters and detractors are inferred from the engagement index.",
    },
    {
        "key": "overtime_rate",
        "label": "Overtime Rate",
        "category": "Engagement & Culture",
        "unit": "percent",
        "available": True,
        "note": "Share flagged as regularly working overtime.",
    },
    {
        "key": "absenteeism_rate",
        "label": "Absenteeism Rate",
        "category": "Engagement & Culture",
        "unit": "percent",
        "available": False,
        "note": "Requires attendance or leave records. No attendance data exists "
        "in the source extract.",
    },
    # --- Workforce & Productivity ---------------------------------------------
    {
        "key": "headcount",
        "label": "Total Headcount",
        "category": "Workforce & Productivity",
        "unit": "count",
        "available": True,
        "note": None,
    },
    {
        "key": "gender_pay_gap_pct",
        "label": "Gender Pay Gap",
        "category": "Workforce & Productivity",
        "unit": "percent",
        "available": True,
        "note": "Mean female pay against mean male pay. Negative means women "
        "are paid more, which is the case in this dataset.",
    },
    {
        "key": "avg_monthly_income",
        "label": "Average Monthly Income",
        "category": "Workforce & Productivity",
        "unit": "currency",
        "available": True,
        "note": None,
    },
    {
        "key": "revenue_per_employee",
        "label": "Revenue per Employee",
        "category": "Workforce & Productivity",
        "unit": "currency",
        "available": False,
        "note": "Needs an annual revenue figure. An admin can supply one under "
        "Admin > Settings, which turns this metric on immediately.",
        "unlockable": True,
    },
]


def catalog_with_values(
    metrics: dict[str, float], *, revenue_configured: bool
) -> list[dict[str, Any]]:
    """Merge measured values into the catalog for the Data Coverage panel."""
    out: list[dict[str, Any]] = []
    for entry in CATALOG:
        item = dict(entry)
        available = bool(item["available"])

        if item["key"] == "revenue_per_employee" and revenue_configured:
            available = True
            item["note"] = "Derived from the annual revenue figure set by an admin."

        item["available"] = available
        item["value"] = metrics.get(item["key"]) if available else None
        out.append(item)
    return out


def coverage_summary(entries: list[dict[str, Any]]) -> dict[str, int]:
    total = len(entries)
    available = sum(1 for e in entries if e["available"])
    return {
        "total": total,
        "available": available,
        "unavailable": total - available,
    }

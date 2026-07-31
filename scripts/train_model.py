"""Offline trainer for the attrition risk model.

Run locally, never on Vercel:

    python -m scripts.train_model

Fits a logistic regression on the IBM HR dataset and writes
`backend/ml/model.json`, containing the standardisation parameters, one-hot
levels and coefficients. The serving path (`backend/ml/score.py`) reads that
file with numpy alone, which keeps scikit-learn out of the deployed bundle.

A linear model is a deliberate choice over something stronger like gradient
boosting: the platform shows *why* an employee is flagged, and for a linear
model "contribution = coefficient x standardised value" is exactly true rather
than an approximation.
"""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    average_precision_score,
    brier_score_loss,
    roc_auc_score,
)
from sklearn.model_selection import StratifiedKFold, train_test_split

from backend.etl.transforms import transform

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CSV = ROOT / "data" / "WA_Fn-UseC_-HR-Employee-Attrition.csv"
OUTPUT_PATH = ROOT / "backend" / "ml" / "model.json"

# Excluded on purpose:
#   attrition            - the target
#   is_early_attrition   - derived from the target (leakage)
#   exit_date            - only exists for leavers (leakage)
#   engagement_index     - the exact mean of the five Likert items below,
#                          so including both is perfect collinearity
NUMERIC_FEATURES = [
    "age",
    "daily_rate",
    "distance_from_home",
    "education",
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

BINARY_FEATURES = ["over_time"]

CATEGORICAL_FEATURES = [
    "business_travel",
    "department",
    "education_field",
    "gender",
    "job_role",
    "marital_status",
]

# Human-readable names used in the "why is this person at risk" explanations.
NUMERIC_LABELS = {
    "age": "Age",
    "daily_rate": "Daily rate",
    "distance_from_home": "Distance from home",
    "education": "Education level",
    "environment_satisfaction": "Environment satisfaction",
    "hourly_rate": "Hourly rate",
    "job_involvement": "Job involvement",
    "job_level": "Job level",
    "job_satisfaction": "Job satisfaction",
    "monthly_income": "Monthly income",
    "monthly_rate": "Monthly rate",
    "num_companies_worked": "Number of previous employers",
    "percent_salary_hike": "Last salary increase %",
    "performance_rating": "Performance rating",
    "relationship_satisfaction": "Relationship satisfaction",
    "stock_option_level": "Stock option level",
    "total_working_years": "Total working years",
    "training_times_last_year": "Trainings last year",
    "work_life_balance": "Work-life balance",
    "years_at_company": "Years at company",
    "years_in_current_role": "Years in current role",
    "years_since_last_promotion": "Years since last promotion",
    "years_with_curr_manager": "Years with current manager",
}

CATEGORICAL_LABELS = {
    "business_travel": "Business travel",
    "department": "Department",
    "education_field": "Education field",
    "gender": "Gender",
    "job_role": "Job role",
    "marital_status": "Marital status",
}


def build_design_matrix(
    df: pd.DataFrame,
) -> tuple[np.ndarray, list[dict]]:
    """Assemble the feature matrix and a self-describing spec for each column.

    The spec is what gets serialised: it tells the runtime scorer how to
    reconstruct each column from a raw employee row.
    """
    columns: list[np.ndarray] = []
    specs: list[dict] = []

    for name in NUMERIC_FEATURES:
        values = df[name].astype(float).to_numpy()
        mean = float(values.mean())
        std = float(values.std(ddof=0))
        if std == 0.0:
            # Constant column carries no signal; skip rather than divide by zero.
            continue
        columns.append((values - mean) / std)
        specs.append(
            {
                "name": name,
                "kind": "numeric",
                "source": name,
                "mean": round(mean, 6),
                "std": round(std, 6),
                "label": NUMERIC_LABELS.get(name, name),
            }
        )

    for name in BINARY_FEATURES:
        columns.append(df[name].astype(bool).astype(float).to_numpy())
        specs.append(
            {
                "name": name,
                "kind": "binary",
                "source": name,
                "label": "Works overtime" if name == "over_time" else name,
            }
        )

    for name in CATEGORICAL_FEATURES:
        # Sorted for determinism; the first level is dropped as the reference
        # category so the design matrix stays full rank.
        levels = sorted(df[name].dropna().astype(str).unique())
        for level in levels[1:]:
            columns.append((df[name].astype(str) == level).astype(float).to_numpy())
            specs.append(
                {
                    "name": f"{name}={level}",
                    "kind": "category",
                    "source": name,
                    "level": level,
                    # The raw level is what the scorer matches on; the label is
                    # what a user reads, so underscores from the source data
                    # ("Travel_Frequently") are cleaned up here rather than
                    # leaking into the interface.
                    "label": f"{CATEGORICAL_LABELS.get(name, name)}: "
                    f"{level.replace('_', ' ')}",
                }
            )

    return np.column_stack(columns), specs


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--csv", type=Path, default=DEFAULT_CSV)
    parser.add_argument("--out", type=Path, default=OUTPUT_PATH)
    parser.add_argument("--test-size", type=float, default=0.25)
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    if not args.csv.exists():
        parser.error(f"Dataset not found: {args.csv}")

    raw = pd.read_csv(args.csv)
    df, _warnings = transform(raw)

    X, specs = build_design_matrix(df)
    y = df["attrition"].astype(int).to_numpy()

    print(f"Rows: {len(df)}   Features: {X.shape[1]}   Positives: {y.sum()} ({y.mean():.1%})")

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=args.test_size, random_state=args.seed, stratify=y
    )

    # class_weight balances the 84/16 split so the model does not collapse into
    # predicting "nobody leaves", which would score 84% accuracy and be useless.
    model = LogisticRegression(
        max_iter=5000,
        C=0.5,
        class_weight="balanced",
        solver="lbfgs",
        random_state=args.seed,
    )
    model.fit(X_train, y_train)

    test_probs = model.predict_proba(X_test)[:, 1]
    auc = roc_auc_score(y_test, test_probs)
    ap = average_precision_score(y_test, test_probs)
    brier = brier_score_loss(y_test, test_probs)

    # Cross-validated AUC on the full set gives a more stable read than a
    # single 25% holdout of only ~370 rows.
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=args.seed)
    cv_scores = []
    for train_idx, test_idx in cv.split(X, y):
        fold = LogisticRegression(
            max_iter=5000,
            C=0.5,
            class_weight="balanced",
            solver="lbfgs",
            random_state=args.seed,
        )
        fold.fit(X[train_idx], y[train_idx])
        cv_scores.append(
            roc_auc_score(y[test_idx], fold.predict_proba(X[test_idx])[:, 1])
        )

    print(f"Holdout ROC-AUC : {auc:.4f}")
    print(f"Holdout PR-AUC  : {ap:.4f}")
    print(f"Brier score     : {brier:.4f}")
    print(f"5-fold CV AUC   : {np.mean(cv_scores):.4f} (+/- {np.std(cv_scores):.4f})")

    # Refit on everything for the shipped artefact — the holdout has served its
    # purpose of estimating generalisation.
    final = LogisticRegression(
        max_iter=5000,
        C=0.5,
        class_weight="balanced",
        solver="lbfgs",
        random_state=args.seed,
    )
    final.fit(X, y)

    for spec, coef in zip(specs, final.coef_[0]):
        spec["coef"] = round(float(coef), 6)

    artefact = {
        "version": "1.0",
        "model_type": "logistic_regression",
        "trained_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "training_rows": int(len(df)),
        "positive_rate": round(float(y.mean()), 4),
        "intercept": round(float(final.intercept_[0]), 6),
        # class_weight="balanced" recentres the decision boundary near 0.5, so
        # these thresholds read as calibrated-against-balanced-prior, not as
        # raw population probabilities. The UI labels them as bands, not odds.
        "bands": {"high": 0.65, "medium": 0.40},
        "metrics": {
            "holdout_roc_auc": round(float(auc), 4),
            "holdout_pr_auc": round(float(ap), 4),
            "brier_score": round(float(brier), 4),
            "cv_roc_auc_mean": round(float(np.mean(cv_scores)), 4),
            "cv_roc_auc_std": round(float(np.std(cv_scores)), 4),
        },
        "features": specs,
    }

    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(artefact, indent=2), encoding="utf-8")
    size_kb = args.out.stat().st_size / 1024
    print(f"\nWrote {args.out.relative_to(ROOT)} ({size_kb:.1f} KB)")

    top = sorted(specs, key=lambda s: -abs(s["coef"]))[:10]
    print("\nStrongest signals:")
    for spec in top:
        arrow = "^ raises" if spec["coef"] > 0 else "v lowers"
        print(f"  {arrow} risk   {spec['label']:<42} {spec['coef']:+.3f}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

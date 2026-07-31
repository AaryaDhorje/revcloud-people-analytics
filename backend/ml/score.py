"""Runtime attrition scoring.

Deliberately numpy-only. The logistic regression is fitted offline by
`scripts/train_model.py` and exported to `model.json` as plain coefficients, so
scikit-learn and scipy (~150 MB together) never enter the Vercel bundle.

The model is linear, which is what makes per-employee explanation honest: the
contribution of a feature really is `coefficient x value`, not a post-hoc
approximation.
"""

from __future__ import annotations

import json
import math
from functools import lru_cache
from pathlib import Path
from typing import Any, Iterable

import numpy as np

MODEL_PATH = Path(__file__).with_name("model.json")


class ModelUnavailable(RuntimeError):
    """Raised when model.json is absent or malformed."""


@lru_cache(maxsize=1)
def load_model() -> dict[str, Any]:
    if not MODEL_PATH.exists():
        raise ModelUnavailable(
            "model.json is missing. Run `python -m scripts.train_model` to build it."
        )
    try:
        model = json.loads(MODEL_PATH.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise ModelUnavailable(f"model.json is not valid JSON: {exc}") from exc

    for key in ("intercept", "features", "bands"):
        if key not in model:
            raise ModelUnavailable(f"model.json is missing the '{key}' key.")
    return model


def model_is_available() -> bool:
    try:
        load_model()
        return True
    except ModelUnavailable:
        return False


def model_metadata() -> dict[str, Any]:
    model = load_model()
    return {
        "version": model.get("version"),
        "trained_at": model.get("trained_at"),
        "metrics": model.get("metrics", {}),
        "n_features": len(model["features"]),
    }


def _feature_value(spec: dict[str, Any], row: dict[str, Any]) -> float:
    """Project one employee row onto one model feature."""
    kind = spec["kind"]
    raw = row.get(spec["source"])

    if kind == "numeric":
        value = float(raw if raw is not None else spec.get("mean", 0.0))
        std = spec.get("std") or 1.0
        return (value - spec.get("mean", 0.0)) / std

    if kind == "binary":
        return 1.0 if bool(raw) else 0.0

    if kind == "category":
        return 1.0 if str(raw) == spec["level"] else 0.0

    raise ModelUnavailable(f"Unknown feature kind {kind!r} in model.json")


def _sigmoid(z: float) -> float:
    # Split on the sign to avoid overflow in exp for large |z|.
    if z >= 0:
        return 1.0 / (1.0 + math.exp(-z))
    e = math.exp(z)
    return e / (1.0 + e)


def band_for(score: float, bands: dict[str, float]) -> str:
    if score >= bands.get("high", 0.5):
        return "High"
    if score >= bands.get("medium", 0.25):
        return "Medium"
    return "Low"


def score_row(row: dict[str, Any], *, top_drivers: int = 4) -> dict[str, Any]:
    """Score a single employee.

    Returns the probability of attrition, its band, and the features pushing it
    furthest in each direction.
    """
    model = load_model()
    features = model["features"]

    values = np.array([_feature_value(f, row) for f in features], dtype=float)
    coefs = np.array([f["coef"] for f in features], dtype=float)
    contributions = coefs * values

    logit = float(model["intercept"] + contributions.sum())
    probability = _sigmoid(logit)

    # Rank by absolute contribution, but only report features that actually
    # moved the needle — a one-hot that is 0 contributes nothing and would be
    # noise in the explanation.
    order = np.argsort(-np.abs(contributions))
    drivers: list[dict[str, Any]] = []
    for idx in order:
        contribution = float(contributions[idx])
        if abs(contribution) < 1e-6:
            continue
        spec = features[idx]
        drivers.append(
            {
                "feature": spec["name"],
                "label": spec.get("label", spec["name"]),
                "contribution": round(contribution, 4),
                "direction": "increases" if contribution > 0 else "decreases",
            }
        )
        if len(drivers) >= top_drivers:
            break

    return {
        "risk_score": round(probability, 4),
        "risk_band": band_for(probability, model["bands"]),
        "risk_drivers": drivers,
    }


def score_many(
    rows: Iterable[dict[str, Any]], *, top_drivers: int = 4
) -> list[dict[str, Any]]:
    """Vectorised scoring for a whole ingest.

    Builds the design matrix once rather than per row, which keeps a 1,500-row
    upload well inside the serverless time budget.
    """
    model = load_model()
    features = model["features"]
    rows = list(rows)
    if not rows:
        return []

    matrix = np.array(
        [[_feature_value(f, row) for f in features] for row in rows], dtype=float
    )
    coefs = np.array([f["coef"] for f in features], dtype=float)
    contributions = matrix * coefs  # (n_rows, n_features)
    logits = contributions.sum(axis=1) + float(model["intercept"])
    probabilities = 1.0 / (1.0 + np.exp(-np.clip(logits, -500, 500)))

    bands = model["bands"]
    labels = [f.get("label", f["name"]) for f in features]
    names = [f["name"] for f in features]

    results: list[dict[str, Any]] = []
    for i in range(len(rows)):
        contrib = contributions[i]
        order = np.argsort(-np.abs(contrib))
        drivers: list[dict[str, Any]] = []
        for idx in order:
            value = float(contrib[idx])
            if abs(value) < 1e-6:
                continue
            drivers.append(
                {
                    "feature": names[idx],
                    "label": labels[idx],
                    "contribution": round(value, 4),
                    "direction": "increases" if value > 0 else "decreases",
                }
            )
            if len(drivers) >= top_drivers:
                break

        probability = float(probabilities[i])
        results.append(
            {
                "risk_score": round(probability, 4),
                "risk_band": band_for(probability, bands),
                "risk_drivers": drivers,
            }
        )
    return results

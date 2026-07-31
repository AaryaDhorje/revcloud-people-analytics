/** Presentation order for banded dimensions. Mirrors `backend/etl/transforms.py`. */

export const AGE_GROUP_ORDER = ["18-24", "25-34", "35-44", "45-54", "55+"];

export const TENURE_ORDER = ["<1 yr", "1-2 yrs", "3-5 yrs", "6-10 yrs", "10+ yrs"];

export const INCOME_BAND_ORDER = ["<3k", "3k-6k", "6k-10k", "10k+"];

export const EDUCATION_LABELS: Record<number, string> = {
  1: "Below College",
  2: "College",
  3: "Bachelor",
  4: "Master",
  5: "Doctor",
};

/** The 1-4 Likert scale used by every satisfaction field in the dataset. */
export const LIKERT_LABELS: Record<number, string> = {
  1: "Low",
  2: "Medium",
  3: "High",
  4: "Very High",
};

export const PERFORMANCE_LABELS: Record<number, string> = {
  1: "Low",
  2: "Good",
  3: "Excellent",
  4: "Outstanding",
};

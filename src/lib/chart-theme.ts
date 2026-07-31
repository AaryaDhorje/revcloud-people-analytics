/**
 * Chart colour tokens.
 *
 * The categorical slots are assigned in fixed order and never cycled — a
 * series keeps its hue when filters change the number of series on screen.
 * The set below was checked with the palette validator in both light and dark
 * mode (adjacent and all-pairs), so the colour-vision-deficiency separation,
 * lightness-band and chroma gates all pass.
 *
 * Values resolve from CSS custom properties so light/dark is handled in one
 * place, in `globals.css`.
 */

export const SERIES = {
  s1: "var(--series-1)",
  s2: "var(--series-2)",
  s3: "var(--series-3)",
  s4: "var(--series-4)",
} as const;

export const CHROME = {
  grid: "var(--grid)",
  axis: "var(--axis)",
  surface: "var(--surface)",
  textPrimary: "var(--text-primary)",
  textSecondary: "var(--text-secondary)",
  textMuted: "var(--text-muted)",
} as const;

export const STATUS = {
  good: "var(--status-good)",
  warning: "var(--status-warning)",
  serious: "var(--status-serious)",
  critical: "var(--status-critical)",
} as const;

/** Sequential blue ramp, light -> dark. For magnitude only. */
export const SEQUENTIAL = [
  "var(--seq-100)",
  "var(--seq-200)",
  "var(--seq-300)",
  "var(--seq-400)",
  "var(--seq-500)",
  "var(--seq-600)",
  "var(--seq-700)",
] as const;

/**
 * Pick a sequential step for a value within [min, max].
 *
 * Used by the heatmap and treemap, where colour encodes magnitude rather than
 * identity — one hue, light to dark, never a rainbow.
 */
export function sequentialStep(value: number, min: number, max: number): string {
  if (!Number.isFinite(value) || max <= min) return SEQUENTIAL[0];
  const ratio = (value - min) / (max - min);
  const index = Math.min(
    SEQUENTIAL.length - 1,
    Math.max(0, Math.round(ratio * (SEQUENTIAL.length - 1))),
  );
  return SEQUENTIAL[index];
}

/**
 * Ink that stays legible on a given sequential step.
 *
 * The ramp crosses from light to dark, so labels sitting on top of it have to
 * flip. Steps 0-2 are light enough for dark ink; the rest need white.
 */
export function inkForStep(value: number, min: number, max: number): string {
  if (!Number.isFinite(value) || max <= min) return "var(--text-primary)";
  const ratio = (value - min) / (max - min);
  const index = Math.round(ratio * (SEQUENTIAL.length - 1));
  return index <= 2 ? "#0b0b0b" : "#ffffff";
}

export const AXIS_TICK = {
  fill: CHROME.textMuted,
  fontSize: 11,
} as const;

/** Risk bands map to status tokens, always paired with a visible label. */
export function riskTone(band: string): { color: string; label: string } {
  switch (band) {
    case "High":
      return { color: STATUS.critical, label: "High" };
    case "Medium":
      return { color: STATUS.warning, label: "Medium" };
    case "Low":
      return { color: STATUS.good, label: "Low" };
    default:
      return { color: CHROME.textMuted, label: band || "Unknown" };
  }
}

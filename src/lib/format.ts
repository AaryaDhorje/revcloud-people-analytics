import type { MetricUnit } from "./types";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const compactCurrency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

const integer = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

export function formatMetric(
  value: number | null | undefined,
  unit: MetricUnit,
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  switch (unit) {
    case "percent":
      return `${value.toFixed(1)}%`;
    case "currency":
      return currency.format(value);
    case "score":
      return value.toFixed(2);
    case "years":
      return `${value.toFixed(1)} yrs`;
    case "days":
      return `${Math.round(value)} d`;
    case "count":
      return integer.format(value);
    default:
      return integer.format(value);
  }
}

export const formatCurrency = (value: number) => currency.format(value);
export const formatCompactCurrency = (value: number) => compactCurrency.format(value);
export const formatInteger = (value: number) => integer.format(value);
export const formatPercent = (value: number, digits = 1) => `${value.toFixed(digits)}%`;

/** "2023-07" -> "Jul 2023" for the trend axis. */
export function formatPeriod(period: string): string {
  const [year, month] = period.split("-");
  if (!year || !month) return period;
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function relativeTime(value: string | null | undefined): string {
  if (!value) return "—";
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return "—";
  const seconds = Math.round((Date.now() - then) / 1000);
  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return formatDate(value);
}

/** 1-4 Likert score to a plain-language label. */
export function satisfactionLabel(score: number): string {
  if (score >= 3.5) return "High";
  if (score >= 2.5) return "Moderate";
  if (score >= 1.5) return "Low";
  return "Very low";
}

/**
 * Turn a raw dataset enum into something readable.
 *
 * The source encodes categories as `Travel_Frequently`, `Non-Travel` and so
 * on; those should never reach the interface as-is.
 */
export function humanizeEnum(value: string | null | undefined): string {
  if (!value) return "—";
  return value.replace(/_/g, " ").trim();
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

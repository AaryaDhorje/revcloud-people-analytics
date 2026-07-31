"use client";

import { useEffect, useState } from "react";
import { ChevronDown, CircleSlash, Info } from "lucide-react";

import { apiFetch, filtersToQuery } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatMetric } from "@/lib/format";
import type { CoverageResponse } from "@/lib/types";
import { Badge, Card, Spinner } from "@/components/ui";
import { useFilters } from "./FilterContext";

const CATEGORY_ORDER = [
  "Talent Acquisition",
  "Retention & Stability",
  "Engagement & Culture",
  "Workforce & Productivity",
];

/**
 * Which metrics from the product brief this dataset can actually support.
 *
 * The IBM extract has no requisition, attendance or finance data, so
 * Time-to-Hire, Cost-per-Hire, Offer Acceptance and Absenteeism have no honest
 * basis in it. Declaring that — and naming the feed each one needs — is more
 * useful than quietly dropping them or filling them with invented numbers.
 */
export function CoveragePanel() {
  const { filters } = useFilters();
  const query = filtersToQuery(filters);

  const [data, setData] = useState<CoverageResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    apiFetch<CoverageResponse>(`/analytics/coverage${query}`)
      .then((result) => active && setData(result))
      .catch(() => active && setData(null))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [query]);

  const grouped = CATEGORY_ORDER.map((category) => ({
    category,
    metrics: (data?.metrics ?? []).filter((m) => m.category === category),
  })).filter((group) => group.metrics.length > 0);

  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition hover:bg-[var(--page)]"
      >
        <div className="min-w-0">
          <h3 className="text-sm font-medium">Data Coverage</h3>
          <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
            Which metrics from the product brief this dataset can support, and
            what the rest would need.
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          {loading ? (
            <Spinner className="size-4" />
          ) : data ? (
            <>
              <Badge tone="good">{data.summary.available} available</Badge>
              <Badge tone="neutral">
                {data.summary.unavailable} needs a feed
              </Badge>
            </>
          ) : null}
          <ChevronDown
            className={cn(
              "size-4 text-[var(--text-muted)] transition",
              open && "rotate-180",
            )}
            aria-hidden
          />
        </div>
      </button>

      {open && data && (
        <div className="border-t border-[var(--border)] px-5 py-4">
          <div className="grid gap-6 sm:grid-cols-2">
            {grouped.map(({ category, metrics }) => (
              <div key={category}>
                <h4 className="text-xs font-medium tracking-wide text-[var(--text-muted)] uppercase">
                  {category}
                </h4>
                <ul className="mt-3 space-y-3">
                  {metrics.map((metric) => (
                    <li key={metric.key} className="flex gap-3">
                      {metric.available ? (
                        <span
                          className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[var(--status-good)]"
                          aria-hidden
                        />
                      ) : (
                        <CircleSlash
                          className="mt-0.5 size-3.5 shrink-0 text-[var(--text-muted)]"
                          aria-hidden
                        />
                      )}

                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <span
                            className={cn(
                              "text-sm",
                              metric.available
                                ? "text-[var(--text-primary)]"
                                : "text-[var(--text-muted)]",
                            )}
                          >
                            {metric.label}
                          </span>
                          <span className="tabular shrink-0 text-sm font-medium">
                            {metric.available
                              ? formatMetric(metric.value, metric.unit)
                              : "—"}
                          </span>
                        </div>
                        {metric.note && (
                          <p className="mt-0.5 text-[11px] text-[var(--text-secondary)]">
                            {metric.note}
                          </p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {data.model && (
            <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-[var(--border)] pt-4 text-[11px] text-[var(--text-muted)]">
              <span className="inline-flex items-center gap-1.5">
                <Info className="size-3" aria-hidden />
                Attrition model
              </span>
              <span>
                Logistic regression · {data.model.n_features} features
              </span>
              <span>
                Cross-validated ROC-AUC{" "}
                <span className="font-medium text-[var(--text-secondary)]">
                  {data.model.metrics.cv_roc_auc_mean?.toFixed(3) ?? "—"}
                </span>
                {data.model.metrics.cv_roc_auc_std !== undefined &&
                  ` ± ${data.model.metrics.cv_roc_auc_std.toFixed(3)}`}
              </span>
              <span>
                Held-out ROC-AUC{" "}
                {data.model.metrics.holdout_roc_auc?.toFixed(3) ?? "—"}
              </span>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

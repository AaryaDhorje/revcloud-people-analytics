"use client";

import { useState } from "react";
import { Download, FileText, Lock } from "lucide-react";

import { downloadFile, filtersToQuery } from "@/lib/api";
import { exportDeepDivePdf } from "@/lib/pdf-export";
import { useAnalytics } from "@/lib/use-analytics";
import { formatCurrency } from "@/lib/format";
import type { DeepDiveResponse } from "@/lib/types";
import { Alert, Button, Card, Skeleton } from "@/components/ui";
import { FilterBar } from "@/components/dashboard/FilterBar";
import { useFilters } from "@/components/dashboard/FilterContext";
import { HighRiskTable } from "@/components/dashboard/HighRiskTable";
import { LiveIndicator } from "@/components/dashboard/LiveIndicator";
import { MiniStat } from "@/components/dashboard/KpiTile";
import {
  AttritionHeatmap,
  JobRoleTreemap,
  TenureIncomeScatter,
} from "@/components/charts/DeepDiveCharts";

export default function TalentRetentionPage() {
  const { filters, activeCount } = useFilters();
  const {
    data,
    loading,
    refreshing,
    error,
    reload,
    liveStatus,
    lastEventAt,
  } = useAnalytics<DeepDiveResponse>("/analytics/deep-dive");

  const [exporting, setExporting] = useState<"csv" | "pdf" | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  async function handleCsv() {
    setExporting("csv");
    setExportError(null);
    try {
      await downloadFile(
        `/exports/employees.csv${filtersToQuery(filters)}`,
        "revcloud-employees.csv",
      );
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Export failed.");
    } finally {
      setExporting(null);
    }
  }

  function handlePdf() {
    if (!data) return;
    setExporting("pdf");
    setExportError(null);
    try {
      exportDeepDivePdf({
        data,
        scopeLabel: data.scope_note ?? "Company-wide",
        filterSummary:
          activeCount > 0
            ? [
                ...filters.department,
                ...filters.job_role,
                ...filters.age_group,
                ...filters.tenure_band,
              ].join(", ") || "custom date range"
            : "None (all employees)",
      });
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Export failed.");
    } finally {
      setExporting(null);
    }
  }

  const equity = data?.pay_equity;
  const gap = equity?.gap_pct ?? null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">
            Talent &amp; Retention Deep Dive
          </h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Where attrition concentrates, and who is most likely to leave next.
          </p>
        </div>
        <LiveIndicator
          status={liveStatus}
          lastEventAt={lastEventAt}
          refreshing={refreshing}
          onRefresh={reload}
        />
      </div>

      <FilterBar>
        <Button
          variant="secondary"
          size="sm"
          onClick={handleCsv}
          loading={exporting === "csv"}
        >
          <Download className="size-3.5" aria-hidden />
          CSV
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={handlePdf}
          loading={exporting === "pdf"}
          disabled={!data}
        >
          <FileText className="size-3.5" aria-hidden />
          PDF
        </Button>
      </FilterBar>

      {data?.scope_note && (
        <Alert tone="info">
          <span className="inline-flex items-center gap-1.5">
            <Lock className="size-3.5" aria-hidden />
            {data.scope_note}
          </span>
        </Alert>
      )}

      {error && <Alert tone="critical">{error}</Alert>}
      {exportError && <Alert tone="critical">{exportError}</Alert>}

      {loading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Card key={index} className="p-5">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="mt-4 h-[260px] w-full" />
            </Card>
          ))}
        </div>
      ) : data ? (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <TenureIncomeScatter data={data.scatter} />
            <JobRoleTreemap data={data.treemap} />
          </div>

          <AttritionHeatmap data={data.heatmap} />

          {/* Pay equity */}
          {equity && (
            <Card className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h3 className="text-sm font-medium">Pay Equity</h3>
                  <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                    Mean and median monthly income by gender.
                  </p>
                </div>
                {gap !== null && (
                  <div className="text-right">
                    <p className="text-xs text-[var(--text-muted)]">Gap</p>
                    <p
                      className={
                        gap > 1
                          ? "text-lg font-semibold text-[var(--status-critical)]"
                          : "text-lg font-semibold text-[var(--success-text)]"
                      }
                    >
                      {gap > 0 ? "−" : "+"}
                      {Math.abs(gap).toFixed(1)}%
                    </p>
                  </div>
                )}
              </div>

              <div className="mt-5 grid gap-6 sm:grid-cols-3">
                {Object.entries(equity.by_gender).map(([gender, stats]) => (
                  <MiniStat
                    key={gender}
                    label={`${gender} · ${stats.headcount} employees`}
                    value={
                      stats.mean_income ? formatCurrency(stats.mean_income) : "—"
                    }
                    hint={
                      stats.median_income
                        ? `Median ${formatCurrency(stats.median_income)}`
                        : undefined
                    }
                  />
                ))}
              </div>

              <p className="mt-4 border-t border-[var(--border)] pt-3 text-[11px] text-[var(--text-muted)]">
                {gap !== null && gap < 0
                  ? `In this dataset women earn ${Math.abs(gap).toFixed(1)}% more than men on average. The figure is reported as measured rather than forced into an expected direction.`
                  : equity.note}
              </p>
            </Card>
          )}

          <HighRiskTable
            data={data.high_risk}
            modelAvailable={data.model_available}
          />
        </>
      ) : null}
    </div>
  );
}

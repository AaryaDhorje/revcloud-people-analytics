"use client";

import { Lock } from "lucide-react";

import { useAnalytics } from "@/lib/use-analytics";
import type { OverviewResponse } from "@/lib/types";
import { Alert, Card, Skeleton } from "@/components/ui";
import { CoveragePanel } from "@/components/dashboard/CoveragePanel";
import { FilterBar } from "@/components/dashboard/FilterBar";
import { useFilters } from "@/components/dashboard/FilterContext";
import { KpiTile } from "@/components/dashboard/KpiTile";
import { LiveIndicator } from "@/components/dashboard/LiveIndicator";
import {
  AgeGenderStacked,
  AttritionTrend,
  DepartmentBar,
  GenderDonut,
} from "@/components/charts/OverviewCharts";

export default function OverviewPage() {
  const { filters, setOnly } = useFilters();
  const {
    data,
    loading,
    refreshing,
    error,
    reload,
    liveStatus,
    lastEventAt,
  } = useAnalytics<OverviewResponse>("/analytics/overview");

  /** Drill-down: selecting a department bar filters the entire dashboard. */
  function handleDepartmentSelect(department: string) {
    const alreadyOnlyThis =
      filters.department.length === 1 && filters.department[0] === department;
    setOnly("department", alreadyOnlyThis ? null : department);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">
            Workforce Overview
          </h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Headline workforce health for the current selection.
          </p>
        </div>
        <LiveIndicator
          status={liveStatus}
          lastEventAt={lastEventAt}
          refreshing={refreshing}
          onRefresh={reload}
        />
      </div>

      <FilterBar />

      {data?.scope_note && (
        <Alert tone="info">
          <span className="inline-flex items-center gap-1.5">
            <Lock className="size-3.5" aria-hidden />
            {data.scope_note}
          </span>
        </Alert>
      )}

      {error && <Alert tone="critical">{error}</Alert>}

      {/* KPI row */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {loading
          ? Array.from({ length: 4 }).map((_, index) => (
              <KpiTile
                key={index}
                loading
                card={{
                  key: String(index),
                  label: "",
                  value: null,
                  unit: "none",
                  delta: null,
                  caption: null,
                  available: true,
                  unavailable_reason: null,
                }}
              />
            ))
          : data?.kpis.map((card) => <KpiTile key={card.key} card={card} />)}
      </div>

      {loading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Card key={index} className="p-5">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="mt-4 h-[240px] w-full" />
            </Card>
          ))}
        </div>
      ) : data ? (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <DepartmentBar
              data={data.attrition_by_department}
              onSelect={handleDepartmentSelect}
              selected={filters.department}
            />
            <GenderDonut data={data.gender_distribution} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <AgeGenderStacked data={data.attrition_by_age_gender} />
            {data.attrition_trend.length > 0 ? (
              <AttritionTrend data={data.attrition_trend} />
            ) : (
              <Card className="flex items-center justify-center p-8">
                <p className="max-w-xs text-center text-sm text-[var(--text-secondary)]">
                  No exits fall inside the selected date range, so there is no
                  trend to plot.
                </p>
              </Card>
            )}
          </div>

          <CoveragePanel />
        </>
      ) : null}
    </div>
  );
}

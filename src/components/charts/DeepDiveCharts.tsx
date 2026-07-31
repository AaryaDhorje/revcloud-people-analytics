"use client";

import { useMemo } from "react";
import {
  CartesianGrid,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  Treemap,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";

import {
  AXIS_TICK,
  CHROME,
  SEQUENTIAL,
  SERIES,
  inkForStep,
  sequentialStep,
} from "@/lib/chart-theme";
import { formatCompactCurrency, formatCurrency, formatInteger } from "@/lib/format";
import { TENURE_ORDER } from "@/lib/constants";
import type { HeatmapCell, ScatterPoint, TreemapNode } from "@/lib/types";
import { ChartCard, Legend } from "./ChartCard";
import { TooltipShell } from "./Tooltip";

/* -------------------------------------------------------------------------- */
/* Years at company vs monthly income — scatter                                */
/* -------------------------------------------------------------------------- */
export function TenureIncomeScatter({ data }: { data: ScatterPoint[] }) {
  // Two series only. Scatter puts every pair on screen at once, and the
  // validated palette caps all-pairs use at three slots.
  const stayed = data.filter((point) => !point.attrition);
  const left = data.filter((point) => point.attrition);

  return (
    <ChartCard
      title="Tenure vs Monthly Income"
      subtitle="Each point is one employee"
      note="Overlapping points are common at low tenure; hover to read exact values."
    >
      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 8, right: 20, bottom: 20, left: 8 }}>
            <CartesianGrid stroke={CHROME.grid} strokeWidth={1} />
            <XAxis
              type="number"
              dataKey="years_at_company"
              name="Years at company"
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={{ stroke: CHROME.axis }}
              label={{
                value: "Years at company",
                position: "insideBottom",
                offset: -12,
                fill: CHROME.textMuted,
                fontSize: 11,
              }}
            />
            <YAxis
              type="number"
              dataKey="monthly_income"
              name="Monthly income"
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={false}
              width={56}
              tickFormatter={(value) => formatCompactCurrency(Number(value))}
            />
            <ZAxis range={[36, 36]} />
            <Tooltip
              cursor={{ strokeDasharray: "0", stroke: CHROME.axis }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const point = payload[0].payload as ScatterPoint;
                return (
                  <TooltipShell
                    title={point.job_role}
                    rows={[
                      { label: "Department", value: point.department },
                      {
                        label: "Tenure",
                        value: `${point.years_at_company} yrs`,
                      },
                      {
                        label: "Monthly income",
                        value: formatCurrency(point.monthly_income),
                      },
                      {
                        label: "Status",
                        value: point.attrition ? "Left" : "Still employed",
                        color: point.attrition ? SERIES.s2 : SERIES.s1,
                      },
                    ]}
                  />
                );
              }}
            />
            {/* A 2px surface ring separates overlapping markers. */}
            <Scatter
              data={stayed}
              fill={SERIES.s1}
              fillOpacity={0.55}
              stroke="var(--surface)"
              strokeWidth={1}
            />
            <Scatter
              data={left}
              fill={SERIES.s2}
              fillOpacity={0.85}
              stroke="var(--surface)"
              strokeWidth={1}
            />
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      <Legend
        className="px-5 pt-2"
        items={[
          { label: `Still employed (${formatInteger(stayed.length)})`, color: SERIES.s1 },
          { label: `Left (${formatInteger(left.length)})`, color: SERIES.s2 },
        ]}
      />
    </ChartCard>
  );
}

/* -------------------------------------------------------------------------- */
/* Headcount by job role — treemap                                             */
/* -------------------------------------------------------------------------- */
interface TreemapContentProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  name?: string;
  size?: number;
  attrition_rate?: number;
  rateMin?: number;
  rateMax?: number;
}

function TreemapTile(props: TreemapContentProps) {
  const {
    x = 0,
    y = 0,
    width = 0,
    height = 0,
    name = "",
    size = 0,
    attrition_rate = 0,
    rateMin = 0,
    rateMax = 1,
  } = props;

  const fill = sequentialStep(attrition_rate, rateMin, rateMax);
  const ink = inkForStep(attrition_rate, rateMin, rateMax);

  // Only draw a label when it genuinely fits — a clipped label is worse than
  // no label, and the value stays available in the tooltip and table view.
  const showLabel = width > 78 && height > 42;
  const showValue = width > 78 && height > 60;

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={fill}
        // 2px surface gap between tiles rather than a contrasting border.
        stroke="var(--surface)"
        strokeWidth={2}
        rx={4}
      />
      {showLabel && (
        <text
          x={x + 8}
          y={y + 18}
          fill={ink}
          fontSize={11}
          fontWeight={500}
          className="pointer-events-none"
        >
          {name.length > Math.floor(width / 7)
            ? `${name.slice(0, Math.floor(width / 7) - 1)}…`
            : name}
        </text>
      )}
      {showValue && (
        <text
          x={x + 8}
          y={y + 34}
          fill={ink}
          fontSize={11}
          opacity={0.85}
          className="pointer-events-none"
        >
          {formatInteger(size)} · {attrition_rate.toFixed(1)}%
        </text>
      )}
    </g>
  );
}

export function JobRoleTreemap({ data }: { data: TreemapNode[] }) {
  const rates = data.map((node) => node.attrition_rate);
  const rateMin = rates.length ? Math.min(...rates) : 0;
  const rateMax = rates.length ? Math.max(...rates) : 1;

  const enriched = useMemo(
    () => data.map((node) => ({ ...node, rateMin, rateMax })),
    [data, rateMin, rateMax],
  );

  return (
    <ChartCard
      title="Employee Distribution by Job Role"
      subtitle="Tile size is headcount; shade is attrition rate"
      tableData={data}
      tableColumns={[
        { header: "Job role", accessor: (row) => row.name },
        {
          header: "Headcount",
          accessor: (row) => formatInteger(row.size),
          align: "right",
        },
        {
          header: "Attrition",
          accessor: (row) => `${row.attrition_rate.toFixed(1)}%`,
          align: "right",
        },
      ]}
    >
      <div className="h-[300px] px-3">
        <ResponsiveContainer width="100%" height="100%">
          <Treemap
            data={enriched}
            dataKey="size"
            nameKey="name"
            isAnimationActive={false}
            content={<TreemapTile />}
          >
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const node = payload[0].payload as TreemapNode;
                if (!node?.name) return null;
                return (
                  <TooltipShell
                    title={node.name}
                    rows={[
                      {
                        label: "Headcount",
                        value: formatInteger(node.size),
                      },
                      {
                        label: "Attrition rate",
                        value: `${node.attrition_rate.toFixed(1)}%`,
                      },
                    ]}
                  />
                );
              }}
            />
          </Treemap>
        </ResponsiveContainer>
      </div>

      {/* A sequential ramp always ships a scale legend. */}
      <div className="flex items-center gap-2 px-5 pt-3">
        <span className="text-[11px] text-[var(--text-muted)]">
          {rateMin.toFixed(0)}%
        </span>
        <div className="flex h-2 flex-1 overflow-hidden rounded-full">
          {SEQUENTIAL.map((step) => (
            <span key={step} className="flex-1" style={{ background: step }} />
          ))}
        </div>
        <span className="text-[11px] text-[var(--text-muted)]">
          {rateMax.toFixed(0)}%
        </span>
      </div>
    </ChartCard>
  );
}

/* -------------------------------------------------------------------------- */
/* Attrition by department and tenure — heatmap                                */
/* -------------------------------------------------------------------------- */
export function AttritionHeatmap({ data }: { data: HeatmapCell[] }) {
  const departments = useMemo(
    () => Array.from(new Set(data.map((cell) => cell.department))).sort(),
    [data],
  );

  const bands = useMemo(
    () =>
      TENURE_ORDER.filter((band) =>
        data.some((cell) => cell.tenure_band === band),
      ),
    [data],
  );

  const lookup = useMemo(() => {
    const map = new Map<string, HeatmapCell>();
    for (const cell of data) {
      map.set(`${cell.department}|${cell.tenure_band}`, cell);
    }
    return map;
  }, [data]);

  const rates = data.map((cell) => cell.attrition_rate);
  const min = rates.length ? Math.min(...rates) : 0;
  const max = rates.length ? Math.max(...rates) : 1;

  return (
    <ChartCard
      title="Attrition by Department and Tenure"
      subtitle="Darker means a higher share of that group left"
      tableData={data}
      tableColumns={[
        { header: "Department", accessor: (row) => row.department },
        { header: "Tenure", accessor: (row) => row.tenure_band },
        {
          header: "Headcount",
          accessor: (row) => formatInteger(row.headcount),
          align: "right",
        },
        {
          header: "Leavers",
          accessor: (row) => formatInteger(row.attrition_count),
          align: "right",
        },
        {
          header: "Rate",
          accessor: (row) => `${row.attrition_rate.toFixed(1)}%`,
          align: "right",
        },
      ]}
    >
      {/* Wide content scrolls inside its own container so the page never
          scrolls horizontally. */}
      <div className="overflow-x-auto px-3 pb-2">
        <div className="min-w-[520px]">
          <div
            className="grid gap-1"
            style={{
              gridTemplateColumns: `minmax(140px, 1.2fr) repeat(${bands.length}, minmax(72px, 1fr))`,
            }}
          >
            <div />
            {bands.map((band) => (
              <div
                key={band}
                className="pb-1 text-center text-[11px] font-medium text-[var(--text-muted)]"
              >
                {band}
              </div>
            ))}

            {departments.map((department) => (
              <div key={department} className="contents">
                <div className="flex items-center pr-2 text-xs text-[var(--text-secondary)]">
                  {department}
                </div>
                {bands.map((band) => {
                  const cell = lookup.get(`${department}|${band}`);
                  if (!cell) {
                    return (
                      <div
                        key={band}
                        className="grid h-14 place-items-center rounded-md bg-[var(--page)] text-[11px] text-[var(--text-muted)]"
                      >
                        —
                      </div>
                    );
                  }
                  const background = sequentialStep(
                    cell.attrition_rate,
                    min,
                    max,
                  );
                  const ink = inkForStep(cell.attrition_rate, min, max);
                  return (
                    <div
                      key={band}
                      title={`${department} · ${band}\n${cell.attrition_count} of ${cell.headcount} left (${cell.attrition_rate.toFixed(1)}%)`}
                      className="grid h-14 cursor-default place-items-center rounded-md transition hover:ring-2 hover:ring-[var(--series-1)]"
                      style={{ background }}
                    >
                      {/* The value is written into every cell, which is also
                          the relief for the lighter ramp steps. */}
                      <span
                        className="tabular text-xs font-medium"
                        style={{ color: ink }}
                      >
                        {cell.attrition_rate.toFixed(0)}%
                      </span>
                      <span
                        className="text-[10px]"
                        style={{ color: ink, opacity: 0.8 }}
                      >
                        {cell.attrition_count}/{cell.headcount}
                      </span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 px-5 pt-3">
        <span className="text-[11px] text-[var(--text-muted)]">
          {min.toFixed(0)}%
        </span>
        <div className="flex h-2 flex-1 overflow-hidden rounded-full">
          {SEQUENTIAL.map((step) => (
            <span key={step} className="flex-1" style={{ background: step }} />
          ))}
        </div>
        <span className="text-[11px] text-[var(--text-muted)]">
          {max.toFixed(0)}%
        </span>
      </div>
    </ChartCard>
  );
}

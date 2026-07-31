"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { AXIS_TICK, CHROME, SERIES } from "@/lib/chart-theme";
import { formatInteger, formatPeriod } from "@/lib/format";
import type {
  AgeGenderAttrition,
  DepartmentAttrition,
  NamedValue,
  TrendPoint,
} from "@/lib/types";
import { ChartCard, Legend } from "./ChartCard";
import { TooltipShell } from "./Tooltip";

const GRID = { stroke: CHROME.grid, strokeWidth: 1 };

/* -------------------------------------------------------------------------- */
/* Gender distribution — donut                                                 */
/* -------------------------------------------------------------------------- */
export function GenderDonut({ data }: { data: NamedValue[] }) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  // Fixed slot order, so a gender keeps its colour regardless of which is larger.
  const colorFor = (name: string) =>
    name.toLowerCase().startsWith("m") ? SERIES.s1 : SERIES.s2;

  return (
    <ChartCard
      title="Gender Distribution"
      subtitle="Share of the selected population"
      tableData={data}
      tableColumns={[
        { header: "Gender", accessor: (row) => row.name },
        {
          header: "Employees",
          accessor: (row) => formatInteger(row.value),
          align: "right",
        },
        {
          header: "Share",
          accessor: (row) =>
            total ? `${((row.value / total) * 100).toFixed(1)}%` : "—",
          align: "right",
        },
      ]}
    >
      <div className="relative h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={58}
              outerRadius={88}
              paddingAngle={2}
              startAngle={90}
              endAngle={-270}
              stroke="var(--surface)"
              strokeWidth={2}
            >
              {data.map((entry) => (
                <Cell key={entry.name} fill={colorFor(entry.name)} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const item = payload[0];
                const value = Number(item.value ?? 0);
                return (
                  <TooltipShell
                    title={String(item.name)}
                    rows={[
                      { label: "Employees", value: formatInteger(value) },
                      {
                        label: "Share",
                        value: total
                          ? `${((value / total) * 100).toFixed(1)}%`
                          : "—",
                      },
                    ]}
                  />
                );
              }}
            />
          </PieChart>
        </ResponsiveContainer>

        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold">{formatInteger(total)}</span>
          <span className="text-xs text-[var(--text-muted)]">employees</span>
        </div>
      </div>

      <Legend
        className="justify-center px-3 pt-2"
        items={data.map((item) => ({
          label: `${item.name} · ${
            total ? ((item.value / total) * 100).toFixed(1) : "0"
          }%`,
          color: colorFor(item.name),
        }))}
      />
    </ChartCard>
  );
}

/* -------------------------------------------------------------------------- */
/* Attrition by department — bar, click to drill down                          */
/* -------------------------------------------------------------------------- */
export function DepartmentBar({
  data,
  onSelect,
  selected,
}: {
  data: DepartmentAttrition[];
  onSelect: (department: string) => void;
  selected: string[];
}) {
  const hasSelection = selected.length > 0;

  return (
    <ChartCard
      title="Attrition by Department"
      subtitle="Click a bar to filter the whole dashboard"
      tableData={data}
      tableColumns={[
        { header: "Department", accessor: (row) => row.department },
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
      <div className="h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 8, right: 16, bottom: 8, left: 8 }}
            layout="vertical"
            barCategoryGap={10}
          >
            <CartesianGrid {...GRID} horizontal={false} />
            <XAxis
              type="number"
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={{ stroke: CHROME.axis }}
              unit="%"
            />
            <YAxis
              type="category"
              dataKey="department"
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={false}
              width={140}
            />
            <Tooltip
              cursor={{ fill: "color-mix(in oklab, var(--text-muted) 10%, transparent)" }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const row = payload[0].payload as DepartmentAttrition;
                return (
                  <TooltipShell
                    title={row.department}
                    rows={[
                      {
                        label: "Attrition rate",
                        value: `${row.attrition_rate.toFixed(1)}%`,
                        color: SERIES.s1,
                      },
                      {
                        label: "Leavers",
                        value: formatInteger(row.attrition_count),
                      },
                      {
                        label: "Headcount",
                        value: formatInteger(row.headcount),
                      },
                    ]}
                    footer="Click to filter the dashboard to this department"
                  />
                );
              }}
            />
            <Bar
              dataKey="attrition_rate"
              radius={[0, 4, 4, 0]}
              maxBarSize={26}
              cursor="pointer"
              onClick={(entry: unknown) =>
                onSelect((entry as DepartmentAttrition).department)
              }
            >
              {/* One series, one colour. Selection is shown by dimming the
                  others rather than by recolouring — a bar's hue never encodes
                  its rank. */}
              {data.map((row) => (
                <Cell
                  key={row.department}
                  fill={SERIES.s1}
                  fillOpacity={
                    !hasSelection || selected.includes(row.department) ? 1 : 0.28
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

/* -------------------------------------------------------------------------- */
/* Attrition by age group and gender — stacked column                          */
/* -------------------------------------------------------------------------- */
export function AgeGenderStacked({ data }: { data: AgeGenderAttrition[] }) {
  return (
    <ChartCard
      title="Attrition by Age Group and Gender"
      subtitle="Leavers per demographic band"
      tableData={data}
      tableColumns={[
        { header: "Age group", accessor: (row) => row.age_group },
        {
          header: "Male leavers",
          accessor: (row) => formatInteger(row.male_attrition),
          align: "right",
        },
        {
          header: "Female leavers",
          accessor: (row) => formatInteger(row.female_attrition),
          align: "right",
        },
        {
          header: "Total",
          accessor: (row) =>
            formatInteger(row.male_attrition + row.female_attrition),
          align: "right",
        },
      ]}
    >
      <div className="h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 12, bottom: 8, left: 0 }}>
            <CartesianGrid {...GRID} vertical={false} />
            <XAxis
              dataKey="age_group"
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={{ stroke: CHROME.axis }}
            />
            <YAxis
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
              width={36}
            />
            <Tooltip
              cursor={{ fill: "color-mix(in oklab, var(--text-muted) 10%, transparent)" }}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const row = payload[0].payload as AgeGenderAttrition;
                const headcount = row.male_headcount + row.female_headcount;
                const leavers = row.male_attrition + row.female_attrition;
                return (
                  <TooltipShell
                    title={`Age ${label}`}
                    rows={[
                      {
                        label: "Male leavers",
                        value: `${formatInteger(row.male_attrition)} of ${formatInteger(row.male_headcount)}`,
                        color: SERIES.s1,
                      },
                      {
                        label: "Female leavers",
                        value: `${formatInteger(row.female_attrition)} of ${formatInteger(row.female_headcount)}`,
                        color: SERIES.s2,
                      },
                      {
                        label: "Band attrition",
                        value: headcount
                          ? `${((leavers / headcount) * 100).toFixed(1)}%`
                          : "—",
                      },
                    ]}
                  />
                );
              }}
            />
            {/* The 2px surface-coloured stroke renders as a gap between
                segments rather than as a contrasting border. */}
            <Bar
              dataKey="male_attrition"
              stackId="attrition"
              fill={SERIES.s1}
              stroke="var(--surface)"
              strokeWidth={2}
              maxBarSize={44}
            />
            <Bar
              dataKey="female_attrition"
              stackId="attrition"
              fill={SERIES.s2}
              stroke="var(--surface)"
              strokeWidth={2}
              maxBarSize={44}
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <Legend
        className="px-5 pt-2"
        items={[
          { label: "Male", color: SERIES.s1 },
          { label: "Female", color: SERIES.s2 },
        ]}
      />
    </ChartCard>
  );
}

/* -------------------------------------------------------------------------- */
/* Attrition trend — line                                                      */
/* -------------------------------------------------------------------------- */
export function AttritionTrend({ data }: { data: TrendPoint[] }) {
  const peak = data.reduce<TrendPoint | null>(
    (max, point) => (!max || point.exits > max.exits ? point : max),
    null,
  );

  return (
    <ChartCard
      title="Attrition Trend Over Time"
      subtitle="Monthly exits across the observation window"
      note="Exit dates are derived from recorded tenure — the source dataset holds no calendar dates. Use this for shape and seasonality, not for exact monthly counts."
      tableData={data}
      tableColumns={[
        { header: "Month", accessor: (row) => formatPeriod(row.period) },
        {
          header: "Exits",
          accessor: (row) => formatInteger(row.exits),
          align: "right",
        },
        {
          header: "Headcount",
          accessor: (row) => formatInteger(row.headcount),
          align: "right",
        },
        {
          header: "Rate",
          accessor: (row) => `${row.attrition_rate.toFixed(2)}%`,
          align: "right",
        },
      ]}
    >
      <div className="h-[240px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 20, bottom: 8, left: 0 }}>
            <CartesianGrid {...GRID} vertical={false} />
            <XAxis
              dataKey="period"
              tickFormatter={formatPeriod}
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={{ stroke: CHROME.axis }}
              minTickGap={24}
            />
            <YAxis
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
              width={32}
            />
            <Tooltip
              cursor={{ stroke: CHROME.axis, strokeWidth: 1 }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const row = payload[0].payload as TrendPoint;
                return (
                  <TooltipShell
                    title={formatPeriod(row.period)}
                    rows={[
                      {
                        label: "Exits",
                        value: formatInteger(row.exits),
                        color: SERIES.s1,
                      },
                      {
                        label: "Headcount",
                        value: formatInteger(row.headcount),
                      },
                      {
                        label: "Monthly rate",
                        value: `${row.attrition_rate.toFixed(2)}%`,
                      },
                    ]}
                  />
                );
              }}
            />
            {/* Single series — the title names it, so no legend box. */}
            <Line
              type="monotone"
              dataKey="exits"
              stroke={SERIES.s1}
              strokeWidth={2}
              dot={false}
              activeDot={{
                r: 4,
                strokeWidth: 2,
                stroke: "var(--surface)",
                fill: SERIES.s1,
              }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {peak && (
        <p className="px-5 pt-2 text-xs text-[var(--text-secondary)]">
          Peak month:{" "}
          <span className="font-medium text-[var(--text-primary)]">
            {formatPeriod(peak.period)}
          </span>{" "}
          with {formatInteger(peak.exits)} exits
        </p>
      )}
    </ChartCard>
  );
}

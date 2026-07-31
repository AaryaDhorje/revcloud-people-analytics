"use client";

import { useState } from "react";
import { Info, Table2 } from "lucide-react";

import { cn } from "@/lib/cn";
import { Card } from "@/components/ui";

export interface TableColumn<T> {
  header: string;
  accessor: (row: T) => React.ReactNode;
  align?: "left" | "right";
}

/**
 * Wrapper for every chart on the dashboard.
 *
 * Provides the two things the accessibility pass requires of a chart: a
 * derived-data disclosure where one is warranted, and a table view of the same
 * numbers so the information is never carried by the graphic alone.
 */
export function ChartCard<T>({
  title,
  subtitle,
  note,
  action,
  children,
  tableData,
  tableColumns,
  className,
  bodyClassName,
}: {
  title: string;
  subtitle?: string;
  note?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  tableData?: T[];
  tableColumns?: TableColumn<T>[];
  className?: string;
  bodyClassName?: string;
}) {
  const [showTable, setShowTable] = useState(false);
  const canToggle = Boolean(tableData?.length && tableColumns?.length);

  return (
    <Card className={cn("flex flex-col overflow-hidden", className)}>
      <div className="flex items-start justify-between gap-3 px-5 pt-5">
        <div className="min-w-0">
          <h3 className="text-sm font-medium">{title}</h3>
          {subtitle && (
            <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
              {subtitle}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {action}
          {canToggle && (
            <button
              type="button"
              onClick={() => setShowTable((v) => !v)}
              aria-pressed={showTable}
              title={showTable ? "Show chart" : "Show data table"}
              className={cn(
                "grid size-7 place-items-center rounded-md transition",
                showTable
                  ? "bg-[color-mix(in_oklab,var(--series-1)_12%,transparent)] text-[var(--series-1)]"
                  : "text-[var(--text-muted)] hover:bg-[var(--page)] hover:text-[var(--text-secondary)]",
              )}
            >
              <Table2 className="size-4" aria-hidden />
              <span className="sr-only">
                {showTable ? "Show chart" : "Show data table"}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* The container grows with its content so the x-axis band is never
          clipped into a nested scrollbar. */}
      <div className={cn("min-w-0 flex-1 px-2 pt-4", bodyClassName)}>
        {showTable && canToggle ? (
          <div className="max-h-80 overflow-auto px-3 pb-2">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-[var(--surface)]">
                <tr className="border-b border-[var(--border)]">
                  {tableColumns!.map((column) => (
                    <th
                      key={column.header}
                      scope="col"
                      className={cn(
                        "px-2 py-2 font-medium text-[var(--text-secondary)]",
                        column.align === "right" ? "text-right" : "text-left",
                      )}
                    >
                      {column.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tableData!.map((row, index) => (
                  <tr
                    key={index}
                    className="border-b border-[var(--border)] last:border-0"
                  >
                    {tableColumns!.map((column) => (
                      <td
                        key={column.header}
                        className={cn(
                          "px-2 py-1.5",
                          column.align === "right"
                            ? "tabular text-right"
                            : "text-left",
                        )}
                      >
                        {column.accessor(row)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          children
        )}
      </div>

      {note && (
        <p className="flex items-start gap-1.5 px-5 pt-3 pb-4 text-[11px] text-[var(--text-muted)]">
          <Info className="mt-px size-3 shrink-0" aria-hidden />
          <span>{note}</span>
        </p>
      )}
      {!note && <div className="pb-4" />}
    </Card>
  );
}

/** Shared legend. Present whenever a chart draws two or more series. */
export function Legend({
  items,
  className,
}: {
  items: { label: string; color: string }[];
  className?: string;
}) {
  return (
    <ul className={cn("flex flex-wrap items-center gap-x-4 gap-y-1", className)}>
      {items.map((item) => (
        <li
          key={item.label}
          className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]"
        >
          <span
            className="size-2.5 rounded-[3px]"
            style={{ background: item.color }}
            aria-hidden
          />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

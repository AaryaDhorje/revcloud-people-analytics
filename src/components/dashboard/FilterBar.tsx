"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Lock, RotateCcw, X } from "lucide-react";

import { cn } from "@/lib/cn";
import { Badge, Button } from "@/components/ui";
import { useFilters } from "./FilterContext";

type ListKey = "department" | "job_role" | "age_group" | "tenure_band";

const FACETS: { key: ListKey; label: string; source: keyof FacetSources }[] = [
  { key: "department", label: "Department", source: "departments" },
  { key: "job_role", label: "Job Role", source: "job_roles" },
  { key: "age_group", label: "Age Group", source: "age_groups" },
  { key: "tenure_band", label: "Tenure", source: "tenure_bands" },
];

interface FacetSources {
  departments: string[];
  job_roles: string[];
  age_groups: string[];
  tenure_bands: string[];
}

function MultiSelect({
  label,
  values,
  selected,
  onToggle,
  disabled,
  disabledHint,
}: {
  label: string;
  values: string[];
  selected: string[];
  onToggle: (value: string) => void;
  disabled?: boolean;
  disabledHint?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (disabled) {
    return (
      <div
        title={disabledHint}
        className="inline-flex h-9 cursor-not-allowed items-center gap-2 rounded-lg bg-[var(--page)] px-3 text-sm text-[var(--text-muted)] ring-1 ring-[var(--border)]"
      >
        <Lock className="size-3.5" aria-hidden />
        {label}
        {selected.length > 0 && (
          <span className="font-medium text-[var(--text-secondary)]">
            {selected[0]}
          </span>
        )}
      </div>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className={cn(
          "inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm ring-1 transition",
          selected.length
            ? "bg-[color-mix(in_oklab,var(--series-1)_10%,transparent)] text-[var(--series-1)] ring-[color-mix(in_oklab,var(--series-1)_35%,transparent)]"
            : "bg-[var(--surface-raised)] text-[var(--text-secondary)] ring-[var(--border-strong)] hover:text-[var(--text-primary)]",
        )}
      >
        {label}
        {selected.length > 0 && (
          <span className="rounded-full bg-[var(--series-1)] px-1.5 text-[10px] font-semibold text-white">
            {selected.length}
          </span>
        )}
        <ChevronDown className="size-3.5" aria-hidden />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute z-50 mt-1 max-h-72 w-60 overflow-auto rounded-lg bg-[var(--surface-raised)] p-1 shadow-lg ring-1 ring-[var(--border-strong)]"
        >
          {values.length === 0 && (
            <p className="px-3 py-2 text-xs text-[var(--text-muted)]">
              No options available.
            </p>
          )}
          {values.map((value) => {
            const active = selected.includes(value);
            return (
              <button
                key={value}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => onToggle(value)}
                className="flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm transition hover:bg-[var(--page)]"
              >
                <span className="truncate">{value}</span>
                {active && (
                  <Check
                    className="size-4 shrink-0 text-[var(--series-1)]"
                    aria-hidden
                  />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function FilterBar({ children }: { children?: React.ReactNode }) {
  const { filters, options, activeCount, toggle, setDateRange, clearAll } =
    useFilters();

  const lockedDepartment = options?.locked_department ?? null;

  const sources: FacetSources = {
    departments: options?.departments ?? [],
    job_roles: options?.job_roles ?? [],
    age_groups: options?.age_groups ?? [],
    tenure_bands: options?.tenure_bands ?? [],
  };

  const activeChips = (
    ["department", "job_role", "age_group", "tenure_band"] as ListKey[]
  ).flatMap((key) =>
    filters[key].map((value) => ({ key, value })),
  );

  return (
    <div className="space-y-3">
      {/* All filters sit in one row above the charts. */}
      <div className="flex flex-wrap items-center gap-2">
        {FACETS.map((facet) => (
          <MultiSelect
            key={facet.key}
            label={facet.label}
            values={sources[facet.source]}
            selected={filters[facet.key]}
            onToggle={(value) => toggle(facet.key, value)}
            disabled={facet.key === "department" && Boolean(lockedDepartment)}
            disabledHint={
              lockedDepartment
                ? `Your manager role is scoped to ${lockedDepartment}.`
                : undefined
            }
          />
        ))}

        <div className="flex items-center gap-1.5 rounded-lg bg-[var(--surface-raised)] px-2 py-1 text-xs ring-1 ring-[var(--border-strong)]">
          <label htmlFor="date-from" className="text-[var(--text-muted)]">
            From
          </label>
          <input
            id="date-from"
            type="date"
            value={filters.date_from ?? ""}
            max={filters.date_to ?? undefined}
            onChange={(e) =>
              setDateRange(e.target.value || null, filters.date_to)
            }
            className="bg-transparent text-[var(--text-primary)] outline-none"
          />
          <span className="text-[var(--text-muted)]">to</span>
          <input
            id="date-to"
            type="date"
            value={filters.date_to ?? ""}
            min={filters.date_from ?? undefined}
            onChange={(e) =>
              setDateRange(filters.date_from, e.target.value || null)
            }
            className="bg-transparent text-[var(--text-primary)] outline-none"
          />
        </div>

        {activeCount > 0 && (
          <Button variant="ghost" size="sm" onClick={clearAll}>
            <RotateCcw className="size-3.5" aria-hidden />
            Reset
          </Button>
        )}

        <div className="ml-auto flex items-center gap-2">{children}</div>
      </div>

      {activeChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-[var(--text-muted)]">Filtered by</span>
          {activeChips.map(({ key, value }) => (
            <button
              key={`${key}:${value}`}
              onClick={() => toggle(key, value)}
              className="inline-flex items-center gap-1 rounded-full bg-[color-mix(in_oklab,var(--series-1)_10%,transparent)] px-2 py-0.5 text-xs text-[var(--series-1)] ring-1 ring-[color-mix(in_oklab,var(--series-1)_30%,transparent)] transition hover:brightness-95"
            >
              {value}
              <X className="size-3" aria-hidden />
            </button>
          ))}
        </div>
      )}

      {lockedDepartment && (
        <Badge tone="neutral">
          <Lock className="size-3" aria-hidden />
          Scoped to {lockedDepartment}
        </Badge>
      )}
    </div>
  );
}

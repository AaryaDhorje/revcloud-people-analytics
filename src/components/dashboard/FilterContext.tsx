"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { apiFetch } from "@/lib/api";
import { EMPTY_FILTERS, type DashboardFilters, type FilterOptions } from "@/lib/types";

type ListKey = "department" | "job_role" | "age_group" | "tenure_band";

interface FilterContextValue {
  filters: DashboardFilters;
  options: FilterOptions | null;
  activeCount: number;
  /** Add or remove one value from a multi-select facet. */
  toggle: (key: ListKey, value: string) => void;
  /** Replace a facet outright — used by chart drill-down. */
  setOnly: (key: ListKey, value: string | null) => void;
  setDateRange: (from: string | null, to: string | null) => void;
  clearAll: () => void;
}

const FilterContext = createContext<FilterContextValue | null>(null);

const LIST_KEYS: ListKey[] = [
  "department",
  "job_role",
  "age_group",
  "tenure_band",
];

function parseFilters(params: URLSearchParams): DashboardFilters {
  return {
    department: params.getAll("department"),
    job_role: params.getAll("job_role"),
    age_group: params.getAll("age_group"),
    tenure_band: params.getAll("tenure_band"),
    date_from: params.get("date_from"),
    date_to: params.get("date_to"),
  };
}

export function FilterProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [options, setOptions] = useState<FilterOptions | null>(null);

  const filters = useMemo(
    () => parseFilters(new URLSearchParams(searchParams.toString())),
    [searchParams],
  );

  useEffect(() => {
    let active = true;
    apiFetch<FilterOptions>("/analytics/filters")
      .then((data) => {
        if (active) setOptions(data);
      })
      .catch(() => setOptions(null));
    return () => {
      active = false;
    };
  }, []);

  /**
   * Filter state lives in the URL rather than component state, so a filtered
   * view is shareable, survives a refresh, and drill-down participates in
   * browser history — clicking a bar then pressing Back does what a user
   * expects.
   */
  const commit = useCallback(
    (next: DashboardFilters) => {
      const params = new URLSearchParams();
      for (const key of LIST_KEYS) {
        for (const value of next[key]) params.append(key, value);
      }
      if (next.date_from) params.set("date_from", next.date_from);
      if (next.date_to) params.set("date_to", next.date_to);

      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, {
        scroll: false,
      });
    },
    [pathname, router],
  );

  const toggle = useCallback(
    (key: ListKey, value: string) => {
      const current = filters[key];
      const next = current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value];
      commit({ ...filters, [key]: next });
    },
    [filters, commit],
  );

  const setOnly = useCallback(
    (key: ListKey, value: string | null) => {
      commit({ ...filters, [key]: value ? [value] : [] });
    },
    [filters, commit],
  );

  const setDateRange = useCallback(
    (from: string | null, to: string | null) => {
      commit({ ...filters, date_from: from, date_to: to });
    },
    [filters, commit],
  );

  const clearAll = useCallback(() => commit(EMPTY_FILTERS), [commit]);

  const activeCount =
    LIST_KEYS.reduce((total, key) => total + filters[key].length, 0) +
    (filters.date_from ? 1 : 0) +
    (filters.date_to ? 1 : 0);

  const value = useMemo(
    () => ({
      filters,
      options,
      activeCount,
      toggle,
      setOnly,
      setDateRange,
      clearAll,
    }),
    [filters, options, activeCount, toggle, setOnly, setDateRange, clearAll],
  );

  return (
    <FilterContext.Provider value={value}>{children}</FilterContext.Provider>
  );
}

export function useFilters(): FilterContextValue {
  const context = useContext(FilterContext);
  if (!context) {
    throw new Error("useFilters must be used inside a <FilterProvider>.");
  }
  return context;
}

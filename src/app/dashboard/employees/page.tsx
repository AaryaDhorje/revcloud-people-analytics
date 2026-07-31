"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";

import { apiFetch, filtersToQuery } from "@/lib/api";
import { riskTone } from "@/lib/chart-theme";
import { formatCurrency, formatInteger } from "@/lib/format";
import type { EmployeeSearchResponse } from "@/lib/types";
import { Alert, Badge, Button, Card, EmptyState, Input, Select, Spinner } from "@/components/ui";
import { FilterBar } from "@/components/dashboard/FilterBar";
import { useFilters } from "@/components/dashboard/FilterContext";

const PAGE_SIZE = 25;

export default function EmployeesPage() {
  const { filters } = useFilters();
  const query = filtersToQuery(filters);

  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [riskBand, setRiskBand] = useState("");
  const [page, setPage] = useState(1);

  const [data, setData] = useState<EmployeeSearchResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Debounce so a fast typist does not fire a request per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams(query.replace(/^\?/, ""));
    if (debounced) params.set("search", debounced);
    if (riskBand) params.set("risk_band", riskBand);
    params.set("page", String(page));
    params.set("page_size", String(PAGE_SIZE));

    try {
      const result = await apiFetch<EmployeeSearchResponse>(
        `/employees?${params.toString()}`,
      );
      setData(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load employees.");
    } finally {
      setLoading(false);
    }
  }, [query, debounced, riskBand, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalPages = useMemo(
    () => (data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1),
    [data],
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">
          Employee Directory
        </h2>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Search individual records within the data you are permitted to see.
        </p>
      </div>

      <FilterBar />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-64 flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--text-muted)]"
            aria-hidden
          />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by employee number, job role or department"
            className="pl-9"
            aria-label="Search employees"
          />
        </div>

        <Select
          value={riskBand}
          onChange={(event) => {
            setRiskBand(event.target.value);
            setPage(1);
          }}
          aria-label="Filter by risk band"
          className="w-44"
        >
          <option value="">All risk bands</option>
          <option value="High">High risk</option>
          <option value="Medium">Medium risk</option>
          <option value="Low">Low risk</option>
        </Select>
      </div>

      {error && <Alert tone="critical">{error}</Alert>}

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3">
          <p className="text-xs text-[var(--text-secondary)]">
            {loading && !data ? (
              "Loading…"
            ) : (
              <>
                <span className="font-medium text-[var(--text-primary)]">
                  {formatInteger(data?.total ?? 0)}
                </span>{" "}
                employees match
              </>
            )}
          </p>
          {loading && data && <Spinner className="size-4" />}
        </div>

        {!loading && data?.results.length === 0 ? (
          <EmptyState
            title="No employees match"
            description="Try clearing a filter or searching for a different term."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--text-secondary)]">
                  <th scope="col" className="px-5 py-2 font-medium">Employee</th>
                  <th scope="col" className="px-3 py-2 font-medium">Department</th>
                  <th scope="col" className="px-3 py-2 font-medium">Role</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Age</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Tenure</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Income</th>
                  <th scope="col" className="px-3 py-2 font-medium">Status</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Risk</th>
                  <th scope="col" className="w-10 px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {(data?.results ?? []).map((employee) => {
                  const tone = employee.risk_band
                    ? riskTone(employee.risk_band)
                    : null;
                  return (
                    <tr
                      key={employee.employee_number}
                      className="border-b border-[var(--border)] transition last:border-0 hover:bg-[var(--page)]"
                    >
                      <td className="px-5 py-2.5 font-medium">
                        #{employee.employee_number}
                      </td>
                      <td className="px-3 py-2.5 text-[var(--text-secondary)]">
                        {employee.department}
                      </td>
                      <td className="px-3 py-2.5 text-[var(--text-secondary)]">
                        {employee.job_role}
                      </td>
                      <td className="tabular px-3 py-2.5 text-right text-[var(--text-secondary)]">
                        {employee.age}
                      </td>
                      <td className="tabular px-3 py-2.5 text-right text-[var(--text-secondary)]">
                        {employee.years_at_company} yr
                      </td>
                      <td className="tabular px-3 py-2.5 text-right text-[var(--text-secondary)]">
                        {formatCurrency(employee.monthly_income)}
                      </td>
                      <td className="px-3 py-2.5">
                        {employee.attrition ? (
                          <Badge tone="neutral">Left</Badge>
                        ) : (
                          <Badge tone="good">Employed</Badge>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        {employee.risk_score !== null && tone ? (
                          <span className="inline-flex items-center gap-1.5">
                            <span
                              className="size-2 rounded-full"
                              style={{ background: tone.color }}
                              aria-hidden
                            />
                            <span className="tabular">
                              {(employee.risk_score * 100).toFixed(0)}%
                            </span>
                            <span className="text-xs text-[var(--text-muted)]">
                              {tone.label}
                            </span>
                          </span>
                        ) : (
                          <span className="text-xs text-[var(--text-muted)]">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <Link
                          href={`/dashboard/employees/${employee.employee_number}`}
                          className="inline-flex items-center text-[var(--series-1)] hover:underline"
                          aria-label={`Open profile for employee ${employee.employee_number}`}
                        >
                          <ChevronRight className="size-4" aria-hidden />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {data && data.total > PAGE_SIZE && (
          <div className="flex items-center justify-between border-t border-[var(--border)] px-5 py-3">
            <p className="text-xs text-[var(--text-secondary)]">
              Page {data.page} of {totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="size-3.5" aria-hidden />
                Previous
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
                <ChevronRight className="size-3.5" aria-hidden />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, ChevronRight } from "lucide-react";

import { cn } from "@/lib/cn";
import { formatCurrency } from "@/lib/format";
import { riskTone } from "@/lib/chart-theme";
import { Badge, Card, EmptyState } from "@/components/ui";
import type { HighRiskEmployee } from "@/lib/types";

/**
 * Ranked intervention list.
 *
 * A score on its own is not actionable, so each row expands to show the
 * factors that produced it. Because the model is linear, a driver's
 * contribution is literally its coefficient times the employee's standardised
 * value — an exact decomposition rather than an approximation.
 */
export function HighRiskTable({
  data,
  modelAvailable,
}: {
  data: HighRiskEmployee[];
  modelAvailable: boolean;
}) {
  const [expanded, setExpanded] = useState<number | null>(null);

  if (!modelAvailable) {
    return (
      <Card>
        <EmptyState
          title="Risk model unavailable"
          description="The attrition model artefact has not been built. Run `python -m scripts.train_model` to generate it, then re-ingest the dataset."
        />
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card>
        <EmptyState
          title="No employees to rank"
          description="No currently-employed people match the active filters."
        />
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] px-5 py-4">
        <div>
          <h3 className="text-sm font-medium">High-Risk Employees</h3>
          <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
            Currently employed, ranked by modelled attrition risk. Select a row
            to see what is driving it.
          </p>
        </div>
        <Badge tone="neutral">{data.length} shown</Badge>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--text-secondary)]">
              <th scope="col" className="px-5 py-2 font-medium">
                Employee
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                Department
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                Role
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                Tenure
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                Income
              </th>
              <th scope="col" className="px-3 py-2 text-center font-medium">
                Overtime
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                Risk
              </th>
              <th scope="col" className="w-8 px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {data.map((employee) => {
              const tone = riskTone(employee.risk_band);
              const isOpen = expanded === employee.employee_number;

              return (
                <tr
                  key={employee.employee_number}
                  className={cn(
                    "border-b border-[var(--border)] last:border-0",
                    isOpen && "bg-[var(--page)]",
                  )}
                >
                  <td colSpan={8} className="p-0">
                    <button
                      type="button"
                      onClick={() =>
                        setExpanded(isOpen ? null : employee.employee_number)
                      }
                      aria-expanded={isOpen}
                      className="grid w-full grid-cols-[minmax(90px,1fr)_minmax(120px,1.3fr)_minmax(140px,1.6fr)_80px_100px_84px_110px_32px] items-center text-left transition hover:bg-[var(--page)]"
                    >
                      <span className="px-5 py-3 font-medium">
                        #{employee.employee_number}
                      </span>
                      <span className="truncate px-3 py-3 text-[var(--text-secondary)]">
                        {employee.department}
                      </span>
                      <span className="truncate px-3 py-3 text-[var(--text-secondary)]">
                        {employee.job_role}
                      </span>
                      <span className="tabular px-3 py-3 text-right text-[var(--text-secondary)]">
                        {employee.years_at_company} yr
                      </span>
                      <span className="tabular px-3 py-3 text-right text-[var(--text-secondary)]">
                        {formatCurrency(employee.monthly_income)}
                      </span>
                      <span className="px-3 py-3 text-center">
                        {employee.over_time ? (
                          <Badge tone="warning">Yes</Badge>
                        ) : (
                          <span className="text-xs text-[var(--text-muted)]">
                            No
                          </span>
                        )}
                      </span>
                      <span className="flex items-center justify-end gap-2 px-3 py-3">
                        {/* Risk band never rides on colour alone — the swatch
                            is always paired with the written band. */}
                        <span
                          className="size-2 rounded-full"
                          style={{ background: tone.color }}
                          aria-hidden
                        />
                        <span className="tabular font-medium">
                          {employee.risk_score.toFixed(0)}%
                        </span>
                        <span className="text-xs text-[var(--text-muted)]">
                          {tone.label}
                        </span>
                      </span>
                      <span className="px-3 py-3">
                        <ChevronRight
                          className={cn(
                            "size-4 text-[var(--text-muted)] transition",
                            isOpen && "rotate-90",
                          )}
                          aria-hidden
                        />
                      </span>
                    </button>

                    {isOpen && (
                      <div className="border-t border-[var(--border)] bg-[var(--surface)] px-5 py-4">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium text-[var(--text-secondary)]">
                              What is driving this score
                            </p>
                            <ul className="mt-2 space-y-1.5">
                              {employee.risk_drivers.map((driver) => {
                                const raises = driver.direction === "increases";
                                const Icon = raises ? ArrowUp : ArrowDown;
                                return (
                                  <li
                                    key={driver.feature}
                                    className="flex items-center gap-2 text-xs"
                                  >
                                    <Icon
                                      className={cn(
                                        "size-3.5 shrink-0",
                                        raises
                                          ? "text-[var(--status-critical)]"
                                          : "text-[var(--success-text)]",
                                      )}
                                      aria-hidden
                                    />
                                    <span className="text-[var(--text-primary)]">
                                      {driver.label}
                                    </span>
                                    <span className="text-[var(--text-muted)]">
                                      {raises ? "raises" : "lowers"} risk
                                    </span>
                                    <span className="tabular ml-auto text-[var(--text-secondary)]">
                                      {driver.contribution > 0 ? "+" : ""}
                                      {driver.contribution.toFixed(2)}
                                    </span>
                                  </li>
                                );
                              })}
                            </ul>
                          </div>

                          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs sm:grid-cols-3">
                            <div>
                              <dt className="text-[var(--text-muted)]">Age</dt>
                              <dd className="tabular font-medium">
                                {employee.age}
                              </dd>
                            </div>
                            <div>
                              <dt className="text-[var(--text-muted)]">
                                Satisfaction
                              </dt>
                              <dd className="tabular font-medium">
                                {employee.job_satisfaction}/4
                              </dd>
                            </div>
                            <div>
                              <dt className="text-[var(--text-muted)]">
                                Engagement
                              </dt>
                              <dd className="tabular font-medium">
                                {employee.engagement_index.toFixed(0)}/100
                              </dd>
                            </div>
                            <div className="col-span-2 sm:col-span-3">
                              <dt className="text-[var(--text-muted)]">
                                Since last promotion
                              </dt>
                              <dd className="tabular font-medium">
                                {employee.years_since_last_promotion} yr
                              </dd>
                            </div>
                          </dl>
                        </div>

                        <Link
                          href={`/dashboard/employees/${employee.employee_number}`}
                          className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-[var(--series-1)] hover:underline"
                        >
                          Open full profile
                          <ChevronRight className="size-3" aria-hidden />
                        </Link>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="border-t border-[var(--border)] px-5 py-3 text-[11px] text-[var(--text-muted)]">
        Scores are statistical estimates, not predictions about individuals.
        Use them to prioritise conversations, never as grounds for an
        employment decision.
      </p>
    </Card>
  );
}

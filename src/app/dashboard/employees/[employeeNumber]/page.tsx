"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowLeft, ArrowUp } from "lucide-react";

import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/cn";
import { riskTone } from "@/lib/chart-theme";
import {
  EDUCATION_LABELS,
  LIKERT_LABELS,
  PERFORMANCE_LABELS,
} from "@/lib/constants";
import { formatCurrency, formatDate, humanizeEnum } from "@/lib/format";
import type { EmployeeProfile } from "@/lib/types";
import { Alert, Badge, Card, Skeleton } from "@/components/ui";

function Detail({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <div>
      <dt className="text-xs text-[var(--text-muted)]">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium">{value}</dd>
      {hint && <p className="text-[11px] text-[var(--text-secondary)]">{hint}</p>}
    </div>
  );
}

/** 1-4 Likert value rendered as a labelled meter. */
function ScoreMeter({ label, score }: { label: string; score: number }) {
  const pct = ((score - 1) / 3) * 100;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs text-[var(--text-muted)]">{label}</span>
        <span className="text-xs font-medium">
          {LIKERT_LABELS[score] ?? score}
          <span className="ml-1 text-[var(--text-muted)]">{score}/4</span>
        </span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--page)]">
        <div
          className="h-full rounded-full bg-[var(--series-1)]"
          style={{ width: `${Math.max(4, pct)}%` }}
        />
      </div>
    </div>
  );
}

export default function EmployeeProfilePage({
  params,
}: {
  params: Promise<{ employeeNumber: string }>;
}) {
  // Route params are Promises in Next 16.
  const { employeeNumber } = use(params);

  const [profile, setProfile] = useState<EmployeeProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    apiFetch<EmployeeProfile>(`/employees/${employeeNumber}`)
      .then((data) => {
        if (active) {
          setProfile(data);
          setError(null);
        }
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err.message : "Unable to load profile.");
        }
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [employeeNumber]);

  const tone = profile?.risk_band ? riskTone(profile.risk_band) : null;

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/employees"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--text-secondary)] transition hover:text-[var(--text-primary)]"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Back to directory
      </Link>

      {error && <Alert tone="critical">{error}</Alert>}

      {loading ? (
        <Card className="p-6">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="mt-4 h-4 w-full max-w-md" />
          <Skeleton className="mt-6 h-40 w-full" />
        </Card>
      ) : profile ? (
        <>
          {/* Identity ---------------------------------------------------- */}
          <Card className="p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl font-semibold tracking-tight">
                    Employee #{profile.employee_number}
                  </h2>
                  {profile.attrition ? (
                    <Badge tone="neutral">Left the company</Badge>
                  ) : (
                    <Badge tone="good">Currently employed</Badge>
                  )}
                </div>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">
                  {profile.job_role} · {profile.department} · Level{" "}
                  {profile.job_level}
                </p>
              </div>

              {profile.risk_score !== null && tone && (
                <div className="text-right">
                  <p className="text-xs text-[var(--text-muted)]">
                    Modelled attrition risk
                  </p>
                  <p className="mt-1 flex items-center justify-end gap-2">
                    <span
                      className="size-2.5 rounded-full"
                      style={{ background: tone.color }}
                      aria-hidden
                    />
                    <span className="text-2xl font-semibold">
                      {(profile.risk_score * 100).toFixed(0)}%
                    </span>
                    <span className="text-sm text-[var(--text-secondary)]">
                      {tone.label}
                    </span>
                  </p>
                </div>
              )}
            </div>

            <dl className="mt-6 grid gap-5 border-t border-[var(--border)] pt-5 sm:grid-cols-3 lg:grid-cols-5">
              <Detail label="Age" value={`${profile.age} (${profile.age_group})`} />
              <Detail label="Gender" value={profile.gender} />
              <Detail label="Marital status" value={profile.marital_status} />
              <Detail
                label="Education"
                value={EDUCATION_LABELS[profile.education] ?? profile.education}
                hint={profile.education_field}
              />
              <Detail
                label="Distance from home"
                value={`${profile.distance_from_home} km`}
              />
            </dl>
          </Card>

          <div className="grid gap-4 lg:grid-cols-3">
            {/* Compensation --------------------------------------------- */}
            <Card className="p-6">
              <h3 className="text-sm font-medium">Compensation</h3>
              <dl className="mt-4 space-y-4">
                <Detail
                  label="Monthly income"
                  value={formatCurrency(profile.monthly_income)}
                />
                <Detail
                  label="Last salary increase"
                  value={`${profile.percent_salary_hike}%`}
                />
                <Detail
                  label="Stock option level"
                  value={`Level ${profile.stock_option_level}`}
                />
                <Detail
                  label="Daily / hourly rate"
                  value={`${formatCurrency(profile.daily_rate)} · ${formatCurrency(profile.hourly_rate)}`}
                />
              </dl>
            </Card>

            {/* Tenure ---------------------------------------------------- */}
            <Card className="p-6">
              <h3 className="text-sm font-medium">Tenure &amp; History</h3>
              <dl className="mt-4 space-y-4">
                <Detail
                  label="Years at company"
                  value={`${profile.years_at_company} (${profile.tenure_band})`}
                />
                <Detail
                  label="Years in current role"
                  value={profile.years_in_current_role}
                />
                <Detail
                  label="Years since last promotion"
                  value={profile.years_since_last_promotion}
                />
                <Detail
                  label="Years with current manager"
                  value={profile.years_with_curr_manager}
                />
                <Detail
                  label="Total working years"
                  value={profile.total_working_years}
                  hint={`${profile.num_companies_worked} previous employers`}
                />
                <Detail
                  label="Hire date"
                  value={formatDate(profile.hire_date)}
                  hint="Derived from recorded tenure"
                />
                {profile.exit_date && (
                  <Detail
                    label="Exit date"
                    value={formatDate(profile.exit_date)}
                    hint="Derived from recorded tenure"
                  />
                )}
              </dl>
            </Card>

            {/* Engagement ------------------------------------------------ */}
            <Card className="p-6">
              <div className="flex items-baseline justify-between">
                <h3 className="text-sm font-medium">Engagement</h3>
                <span className="text-xs text-[var(--text-secondary)]">
                  Index{" "}
                  <span className="font-medium text-[var(--text-primary)]">
                    {profile.engagement_index.toFixed(0)}/100
                  </span>
                </span>
              </div>

              <div className="mt-4 space-y-3">
                <ScoreMeter label="Job satisfaction" score={profile.job_satisfaction} />
                <ScoreMeter
                  label="Environment satisfaction"
                  score={profile.environment_satisfaction}
                />
                <ScoreMeter
                  label="Relationship satisfaction"
                  score={profile.relationship_satisfaction}
                />
                <ScoreMeter label="Job involvement" score={profile.job_involvement} />
                <ScoreMeter
                  label="Work-life balance"
                  score={profile.work_life_balance}
                />
              </div>

              <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-[var(--border)] pt-4">
                <Detail
                  label="Performance rating"
                  value={
                    PERFORMANCE_LABELS[profile.performance_rating] ??
                    profile.performance_rating
                  }
                />
                <Detail
                  label="eNPS category"
                  value={profile.enps_category}
                  hint="Proxy from engagement"
                />
                <Detail
                  label="Overtime"
                  value={profile.over_time ? "Yes" : "No"}
                />
                <Detail
                  label="Business travel"
                  value={humanizeEnum(profile.business_travel)}
                />
                <Detail
                  label="Trainings last year"
                  value={profile.training_times_last_year}
                />
              </dl>
            </Card>
          </div>

          {/* Risk drivers ------------------------------------------------ */}
          {profile.risk_drivers && profile.risk_drivers.length > 0 && (
            <Card className="p-6">
              <h3 className="text-sm font-medium">
                What is driving this risk score
              </h3>
              <p className="mt-1 text-xs text-[var(--text-secondary)]">
                The model is linear, so each contribution below is exactly the
                feature&rsquo;s coefficient times this employee&rsquo;s
                standardised value.
              </p>

              <ul className="mt-4 space-y-2">
                {profile.risk_drivers.map((driver) => {
                  const raises = driver.direction === "increases";
                  const Icon = raises ? ArrowUp : ArrowDown;
                  const magnitude = Math.min(
                    100,
                    Math.abs(driver.contribution) * 45,
                  );
                  return (
                    <li key={driver.feature} className="flex items-center gap-3">
                      <Icon
                        className={cn(
                          "size-4 shrink-0",
                          raises
                            ? "text-[var(--status-critical)]"
                            : "text-[var(--success-text)]",
                        )}
                        aria-hidden
                      />
                      <span className="w-56 shrink-0 truncate text-sm">
                        {driver.label}
                      </span>
                      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--page)]">
                        <span
                          className="block h-full rounded-full"
                          style={{
                            width: `${magnitude}%`,
                            background: raises
                              ? "var(--status-critical)"
                              : "var(--status-good)",
                          }}
                        />
                      </span>
                      <span className="tabular w-16 shrink-0 text-right text-xs text-[var(--text-secondary)]">
                        {driver.contribution > 0 ? "+" : ""}
                        {driver.contribution.toFixed(2)}
                      </span>
                    </li>
                  );
                })}
              </ul>

              <p className="mt-4 border-t border-[var(--border)] pt-3 text-[11px] text-[var(--text-muted)]">
                A statistical estimate about a pattern, not a prediction about
                this person. Never use it as grounds for an employment decision.
              </p>
            </Card>
          )}
        </>
      ) : null}
    </div>
  );
}

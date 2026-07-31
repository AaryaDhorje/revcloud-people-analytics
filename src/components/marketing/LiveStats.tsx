"use client";

import { useEffect, useState } from "react";

import { apiFetch } from "@/lib/api";
import { formatInteger } from "@/lib/format";

interface PublicStats {
  employees_analyzed: number;
  departments: number;
  job_roles: number;
}

/**
 * Headline numbers read from the live database.
 *
 * Aggregate-only and non-identifying, which is why the endpoint behind it is
 * safe to serve unauthenticated.
 */
export function LiveStats() {
  const [stats, setStats] = useState<PublicStats | null>(null);

  useEffect(() => {
    let active = true;
    apiFetch<PublicStats>("/public/stats")
      .then((data) => {
        if (active) setStats(data);
      })
      .catch(() => {
        // The marketing page must still render if the API is unreachable.
      });
    return () => {
      active = false;
    };
  }, []);

  const items = [
    { label: "Employee records analysed", value: stats?.employees_analyzed },
    { label: "Departments tracked", value: stats?.departments },
    { label: "Job roles covered", value: stats?.job_roles },
  ];

  return (
    <dl className="grid grid-cols-3 gap-4 sm:gap-8">
      {items.map((item) => (
        <div key={item.label}>
          <dt className="text-xs text-[var(--text-muted)]">{item.label}</dt>
          <dd className="mt-1 text-2xl font-semibold sm:text-3xl">
            {item.value === undefined ? (
              <span className="text-[var(--text-muted)]">—</span>
            ) : (
              formatInteger(item.value)
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

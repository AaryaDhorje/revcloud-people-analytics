"use client";

import { Lock } from "lucide-react";

import { cn } from "@/lib/cn";
import { formatMetric } from "@/lib/format";
import { Card, Skeleton } from "@/components/ui";
import type { KpiCard } from "@/lib/types";

/**
 * A single headline figure.
 *
 * When the story is one number, the number *is* the chart — no sparkline, no
 * decorative colour. An unavailable metric renders as an explicit locked state
 * naming the feed it needs, rather than being hidden or filled with a guess.
 */
export function KpiTile({
  card,
  loading,
}: {
  card: KpiCard;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <Card className="p-5">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="mt-3 h-8 w-32" />
        <Skeleton className="mt-3 h-3 w-40" />
      </Card>
    );
  }

  if (!card.available) {
    return (
      <Card className="border-dashed p-5 opacity-90 ring-dashed">
        <div className="flex items-center gap-1.5">
          <Lock className="size-3 text-[var(--text-muted)]" aria-hidden />
          <p className="text-xs font-medium text-[var(--text-secondary)]">
            {card.label}
          </p>
        </div>
        <p className="mt-2 text-2xl font-semibold text-[var(--text-muted)]">
          Not available
        </p>
        {card.unavailable_reason && (
          <p className="mt-2 text-xs text-[var(--text-muted)]">
            {card.unavailable_reason}
          </p>
        )}
      </Card>
    );
  }

  return (
    <Card className="p-5">
      <p className="text-xs font-medium text-[var(--text-secondary)]">
        {card.label}
      </p>
      <p className="mt-2 text-3xl font-semibold tracking-tight">
        {formatMetric(card.value, card.unit)}
      </p>
      {card.caption && (
        <p className="mt-2 text-xs text-[var(--text-muted)]">{card.caption}</p>
      )}
    </Card>
  );
}

/** Compact figure used inside panels rather than as a top-level tile. */
export function MiniStat({
  label,
  value,
  hint,
  tone,
  className,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "good" | "critical";
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <p className="text-xs text-[var(--text-muted)]">{label}</p>
      <p
        className={cn(
          "mt-1 text-lg font-semibold",
          tone === "good" && "text-[var(--success-text)]",
          tone === "critical" && "text-[var(--status-critical)]",
        )}
      >
        {value}
      </p>
      {hint && (
        <p className="mt-0.5 text-[11px] text-[var(--text-secondary)]">{hint}</p>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

import { cn } from "@/lib/cn";
import { relativeTime } from "@/lib/format";
import type { LiveStatus } from "@/lib/use-live-updates";

const TONE: Record<LiveStatus, { dot: string; label: string }> = {
  live: { dot: "bg-[var(--status-good)]", label: "Live" },
  connecting: { dot: "bg-[var(--status-warning)]", label: "Reconnecting" },
  offline: { dot: "bg-[var(--text-muted)]", label: "Offline" },
};

export function LiveIndicator({
  status,
  lastEventAt,
  refreshing,
  onRefresh,
}: {
  status: LiveStatus;
  lastEventAt: string | null;
  refreshing?: boolean;
  onRefresh?: () => void;
}) {
  // Re-render on a timer so "2m ago" does not sit frozen.
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(timer);
  }, []);

  const tone = TONE[status];

  return (
    <div className="flex items-center gap-2">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--surface-raised)] px-2.5 py-1 text-xs text-[var(--text-secondary)] ring-1 ring-[var(--border)]">
        <span
          className={cn(
            "size-1.5 rounded-full",
            tone.dot,
            status === "live" && "live-dot",
          )}
          aria-hidden
        />
        {tone.label}
        {lastEventAt && (
          <span className="text-[var(--text-muted)]">
            · updated {relativeTime(lastEventAt)}
          </span>
        )}
      </span>

      {onRefresh && (
        <button
          type="button"
          onClick={onRefresh}
          title="Refresh now"
          className="grid size-7 place-items-center rounded-md text-[var(--text-muted)] transition hover:bg-[var(--page)] hover:text-[var(--text-secondary)]"
        >
          <RefreshCw
            className={cn("size-3.5", refreshing && "animate-spin")}
            aria-hidden
          />
          <span className="sr-only">Refresh</span>
        </button>
      )}
    </div>
  );
}

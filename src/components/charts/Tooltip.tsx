"use client";

/**
 * Shared tooltip shell.
 *
 * Every visualisation ships a hover layer showing exact values and, where the
 * measure is a share, the percentage alongside it.
 */
export function TooltipShell({
  title,
  rows,
  footer,
}: {
  title: string;
  rows: { label: string; value: string; color?: string }[];
  footer?: string;
}) {
  return (
    <div className="pointer-events-none rounded-lg bg-[var(--surface-raised)] px-3 py-2 text-xs shadow-lg ring-1 ring-[var(--border-strong)]">
      <p className="font-medium text-[var(--text-primary)]">{title}</p>
      <dl className="mt-1.5 space-y-1">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center gap-3">
            {row.color && (
              <span
                className="size-2 shrink-0 rounded-[2px]"
                style={{ background: row.color }}
                aria-hidden
              />
            )}
            <dt className="text-[var(--text-secondary)]">{row.label}</dt>
            <dd className="tabular ml-auto font-medium text-[var(--text-primary)]">
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
      {footer && (
        <p className="mt-1.5 border-t border-[var(--border)] pt-1.5 text-[11px] text-[var(--text-muted)]">
          {footer}
        </p>
      )}
    </div>
  );
}

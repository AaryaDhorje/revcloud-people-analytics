"use client";

import { forwardRef } from "react";
import { AlertTriangle, Info, Loader2 } from "lucide-react";

import { cn } from "@/lib/cn";

/* -------------------------------------------------------------------------- */
/* Button                                                                      */
/* -------------------------------------------------------------------------- */
type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-[var(--series-1)] text-white hover:brightness-110 active:brightness-95 shadow-sm",
  secondary:
    "bg-[var(--surface-raised)] text-[var(--text-primary)] ring-1 ring-[var(--border-strong)] hover:bg-[var(--page)]",
  ghost:
    "text-[var(--text-secondary)] hover:bg-[var(--page)] hover:text-[var(--text-primary)]",
  danger: "bg-[var(--status-critical)] text-white hover:brightness-110",
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-xs gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-12 px-6 text-base gap-2",
};

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant = "primary", size = "md", loading, children, disabled, ...props },
    ref,
  ) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center rounded-lg font-medium transition",
        "disabled:cursor-not-allowed disabled:opacity-55",
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        className,
      )}
      {...props}
    >
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  ),
);
Button.displayName = "Button";

/* -------------------------------------------------------------------------- */
/* Form controls                                                               */
/* -------------------------------------------------------------------------- */
const CONTROL_BASE =
  "w-full rounded-lg bg-[var(--surface-raised)] px-3 text-sm text-[var(--text-primary)] " +
  "ring-1 ring-[var(--border-strong)] transition placeholder:text-[var(--text-muted)] " +
  "focus:ring-2 focus:ring-[var(--series-1)] focus:outline-none disabled:opacity-60";

export const Input = forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input ref={ref} className={cn(CONTROL_BASE, "h-10", className)} {...props} />
));
Input.displayName = "Input";

export const Select = forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => (
  <select ref={ref} className={cn(CONTROL_BASE, "h-10 pr-8", className)} {...props}>
    {children}
  </select>
));
Select.displayName = "Select";

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea ref={ref} className={cn(CONTROL_BASE, "py-2", className)} {...props} />
));
Textarea.displayName = "Textarea";

export function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
  className,
}: {
  label: string;
  hint?: string;
  error?: string | null;
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label
        htmlFor={htmlFor}
        className="block text-xs font-medium text-[var(--text-secondary)]"
      >
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-xs text-[var(--status-critical)]">{error}</p>
      ) : hint ? (
        <p className="text-xs text-[var(--text-muted)]">{hint}</p>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Surfaces                                                                    */
/* -------------------------------------------------------------------------- */
export function Card({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-xl bg-[var(--surface)] ring-1 ring-[var(--border)]",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: "neutral" | "good" | "warning" | "critical" | "info";
  className?: string;
}) {
  const tones: Record<string, string> = {
    neutral:
      "bg-[var(--page)] text-[var(--text-secondary)] ring-[var(--border-strong)]",
    good: "bg-[color-mix(in_oklab,var(--status-good)_14%,transparent)] text-[var(--success-text)] ring-[color-mix(in_oklab,var(--status-good)_35%,transparent)]",
    warning:
      "bg-[color-mix(in_oklab,var(--status-warning)_18%,transparent)] text-[var(--text-primary)] ring-[color-mix(in_oklab,var(--status-warning)_45%,transparent)]",
    critical:
      "bg-[color-mix(in_oklab,var(--status-critical)_14%,transparent)] text-[var(--status-critical)] ring-[color-mix(in_oklab,var(--status-critical)_35%,transparent)]",
    info: "bg-[color-mix(in_oklab,var(--series-1)_12%,transparent)] text-[var(--series-1)] ring-[color-mix(in_oklab,var(--series-1)_32%,transparent)]",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Feedback                                                                    */
/* -------------------------------------------------------------------------- */
export function Spinner({ className }: { className?: string }) {
  return (
    <Loader2
      className={cn("size-5 animate-spin text-[var(--text-muted)]", className)}
      aria-hidden
    />
  );
}

export function Alert({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: "info" | "warning" | "critical";
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const config = {
    info: {
      icon: Info,
      ring: "ring-[color-mix(in_oklab,var(--series-1)_30%,transparent)]",
      bg: "bg-[color-mix(in_oklab,var(--series-1)_8%,transparent)]",
      fg: "text-[var(--series-1)]",
    },
    warning: {
      icon: AlertTriangle,
      ring: "ring-[color-mix(in_oklab,var(--status-warning)_40%,transparent)]",
      bg: "bg-[color-mix(in_oklab,var(--status-warning)_12%,transparent)]",
      fg: "text-[var(--text-primary)]",
    },
    critical: {
      icon: AlertTriangle,
      ring: "ring-[color-mix(in_oklab,var(--status-critical)_35%,transparent)]",
      bg: "bg-[color-mix(in_oklab,var(--status-critical)_10%,transparent)]",
      fg: "text-[var(--status-critical)]",
    },
  }[tone];

  const Icon = config.icon;

  return (
    <div
      role={tone === "info" ? "status" : "alert"}
      className={cn("flex gap-3 rounded-lg p-3 ring-1", config.bg, config.ring, className)}
    >
      {/* Status is never carried by colour alone — icon plus text always. */}
      <Icon className={cn("mt-0.5 size-4 shrink-0", config.fg)} aria-hidden />
      <div className="min-w-0 text-sm">
        {title && <p className="font-medium text-[var(--text-primary)]">{title}</p>}
        <div className="text-[var(--text-secondary)]">{children}</div>
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      <p className="text-sm font-medium text-[var(--text-primary)]">{title}</p>
      {description && (
        <p className="max-w-sm text-xs text-[var(--text-secondary)]">{description}</p>
      )}
      {action}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-[color-mix(in_oklab,var(--text-muted)_18%,transparent)]",
        className,
      )}
    />
  );
}

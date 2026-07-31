"use client";

import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";

import { cn } from "@/lib/cn";

type Theme = "light" | "dark" | "system";

const OPTIONS: { value: Theme; label: string; Icon: typeof Sun }[] = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "system", label: "System", Icon: Monitor },
];

export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>("system");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("rc-theme");
    setTheme(saved === "light" || saved === "dark" ? saved : "system");
    setMounted(true);
  }, []);

  const apply = (next: Theme) => {
    setTheme(next);
    if (next === "system") {
      localStorage.removeItem("rc-theme");
      document.documentElement.removeAttribute("data-theme");
    } else {
      localStorage.setItem("rc-theme", next);
      document.documentElement.setAttribute("data-theme", next);
    }
  };

  // Render a stable placeholder until mounted, so the server and client markup
  // agree and the selected state is not guessed during hydration.
  if (!mounted) {
    return <div className={cn("h-8 w-[6.5rem]", className)} aria-hidden />;
  }

  return (
    <div
      role="radiogroup"
      aria-label="Colour theme"
      className={cn(
        "inline-flex items-center gap-0.5 rounded-lg bg-[var(--page)] p-0.5 ring-1 ring-[var(--border)]",
        className,
      )}
    >
      {OPTIONS.map(({ value, label, Icon }) => (
        <button
          key={value}
          role="radio"
          aria-checked={theme === value}
          aria-label={label}
          title={label}
          onClick={() => apply(value)}
          className={cn(
            "grid size-7 place-items-center rounded-md transition",
            theme === value
              ? "bg-[var(--surface-raised)] text-[var(--text-primary)] shadow-sm ring-1 ring-[var(--border)]"
              : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]",
          )}
        >
          <Icon className="size-3.5" aria-hidden />
        </button>
      ))}
    </div>
  );
}

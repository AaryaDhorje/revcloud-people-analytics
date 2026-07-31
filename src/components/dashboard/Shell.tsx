"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  Sparkles,
  Users,
  X,
} from "lucide-react";

import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { initials } from "@/lib/format";
import { Alert, Badge, Button, Spinner } from "@/components/ui";
import { ThemeToggle } from "@/components/ThemeToggle";

const NAV = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard, exact: true },
  {
    href: "/dashboard/talent-retention",
    label: "Talent & Retention",
    icon: BarChart3,
  },
  { href: "/dashboard/employees", label: "Employees", icon: Users },
  {
    href: "/dashboard/admin",
    label: "Admin",
    icon: Settings,
    adminOnly: true,
  },
];

const ROLE_LABEL: Record<string, string> = {
  admin: "Admin / HR Leader",
  manager: "Manager",
  viewer: "Viewer",
};

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, loading, logout, idleWarning, stayActive } = useAuth();
  const [navOpen, setNavOpen] = useState(false);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Spinner className="size-6" />
      </div>
    );
  }

  // The route guard normally prevents this; it can still appear briefly if a
  // session is revoked while the tab is open.
  if (!user) {
    return (
      <div className="flex flex-1 items-center justify-center px-4">
        <div className="max-w-sm text-center">
          <p className="text-sm font-medium">Your session has ended</p>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            Sign in again to return to your dashboards.
          </p>
          <Button className="mt-6" onClick={() => (window.location.href = "/login")}>
            Go to sign in
          </Button>
        </div>
      </div>
    );
  }

  const visibleNav = NAV.filter(
    (item) => !item.adminOnly || user.role === "admin",
  );

  const isActive = (item: (typeof NAV)[number]) =>
    item.exact ? pathname === item.href : pathname.startsWith(item.href);

  return (
    <div className="flex min-h-full flex-1">
      {/* ---------------------------------------------------------------- */}
      {/* Sidebar                                                           */}
      {/* ---------------------------------------------------------------- */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-[var(--border)] bg-[var(--surface)] transition-transform lg:static lg:translate-x-0",
          navOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-16 items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <span className="grid size-8 place-items-center rounded-lg bg-[var(--series-1)] text-white">
              <Sparkles className="size-4" aria-hidden />
            </span>
            RevCloud
          </Link>
          <button
            onClick={() => setNavOpen(false)}
            className="text-[var(--text-muted)] lg:hidden"
            aria-label="Close navigation"
          >
            <X className="size-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          {visibleNav.map((item) => {
            const Icon = item.icon;
            const active = isActive(item);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setNavOpen(false)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
                  active
                    ? "bg-[color-mix(in_oklab,var(--series-1)_12%,transparent)] text-[var(--series-1)]"
                    : "text-[var(--text-secondary)] hover:bg-[var(--page)] hover:text-[var(--text-primary)]",
                )}
              >
                <Icon className="size-4 shrink-0" aria-hidden />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-[var(--border)] p-3">
          <div className="flex items-center gap-3 rounded-lg px-2 py-2">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--series-1)] text-xs font-semibold text-white">
              {initials(user.full_name)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{user.full_name}</p>
              <p className="truncate text-xs text-[var(--text-muted)]">
                {ROLE_LABEL[user.role] ?? user.role}
              </p>
            </div>
          </div>

          {user.department && (
            <p className="px-2 pb-2 text-xs text-[var(--text-muted)]">
              Scoped to {user.department}
            </p>
          )}

          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start"
            onClick={() => void logout()}
          >
            <LogOut className="size-4" aria-hidden />
            Sign out
          </Button>
        </div>
      </aside>

      {navOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setNavOpen(false)}
          aria-hidden
        />
      )}

      {/* ---------------------------------------------------------------- */}
      {/* Main column                                                       */}
      {/* ---------------------------------------------------------------- */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-[var(--border)] bg-[color-mix(in_oklab,var(--page)_88%,transparent)] px-4 backdrop-blur sm:px-6">
          <button
            onClick={() => setNavOpen(true)}
            className="text-[var(--text-secondary)] lg:hidden"
            aria-label="Open navigation"
          >
            <Menu className="size-5" />
          </button>

          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm font-medium">
              {visibleNav.find(isActive)?.label ?? "Dashboard"}
            </h1>
          </div>

          <Badge tone={user.role === "admin" ? "info" : "neutral"}>
            {ROLE_LABEL[user.role] ?? user.role}
          </Badge>
          <ThemeToggle className="hidden sm:inline-flex" />
        </header>

        {idleWarning && (
          <div className="px-4 pt-4 sm:px-6">
            <Alert tone="warning" title="You're about to be signed out">
              <div className="flex flex-wrap items-center gap-3">
                <span>
                  For the safety of employee data, inactive sessions end
                  automatically.
                </span>
                <Button size="sm" variant="secondary" onClick={stayActive}>
                  Keep me signed in
                </Button>
              </div>
            </Alert>
          </div>
        )}

        <main className="flex-1 px-4 py-6 sm:px-6">{children}</main>
      </div>
    </div>
  );
}

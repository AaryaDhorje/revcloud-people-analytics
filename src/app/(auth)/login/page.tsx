"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { useAuth } from "@/lib/auth";
import { Alert, Button, Card, Field, Input } from "@/components/ui";

/** Seeded accounts, surfaced so the deployed demo is explorable immediately. */
const DEMO_ACCOUNTS = [
  {
    role: "Admin / HR Leader",
    email: "admin@revcloud.io",
    password: "Admin123!",
    scope: "Company-wide data, ingestion, user management",
  },
  {
    role: "Manager",
    email: "manager@revcloud.io",
    password: "Manager123!",
    scope: "Research & Development only",
  },
  {
    role: "Viewer",
    email: "viewer@revcloud.io",
    password: "Viewer123!",
    scope: "Read-only dashboards",
  },
];

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const nextPath = searchParams.get("next") ?? "/dashboard";

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      router.push(nextPath);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in.");
      setSubmitting(false);
    }
  }

  function applyDemoAccount(account: (typeof DEMO_ACCOUNTS)[number]) {
    setEmail(account.email);
    setPassword(account.password);
    setError(null);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          Sign in to your People Analytics workspace.
        </p>
      </div>

      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <Alert tone="critical">{error}</Alert>}

          <Field label="Email" htmlFor="email">
            <Input
              id="email"
              type="email"
              required
              autoComplete="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
            />
          </Field>

          <Field label="Password" htmlFor="password">
            <Input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </Field>

          <div className="flex justify-end">
            <Link
              href="/forgot-password"
              className="text-xs font-medium text-[var(--series-1)] hover:underline"
            >
              Forgot your password?
            </Link>
          </div>

          <Button type="submit" className="w-full" loading={submitting}>
            Sign in
          </Button>
        </form>
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-[var(--border)] px-4 py-3">
          <p className="text-xs font-medium">Demo accounts</p>
          <p className="mt-0.5 text-xs text-[var(--text-muted)]">
            Sign in as each role to see how access scoping changes what loads.
          </p>
        </div>
        <ul className="divide-y divide-[var(--border)]">
          {DEMO_ACCOUNTS.map((account) => (
            <li key={account.email}>
              <button
                type="button"
                onClick={() => applyDemoAccount(account)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-[var(--page)]"
              >
                <span className="min-w-0">
                  <span className="block text-xs font-medium">
                    {account.role}
                  </span>
                  <span className="block truncate text-xs text-[var(--text-muted)]">
                    {account.scope}
                  </span>
                </span>
                <span className="shrink-0 text-xs font-medium text-[var(--series-1)]">
                  Use
                </span>
              </button>
            </li>
          ))}
        </ul>
      </Card>

      <p className="text-center text-sm text-[var(--text-secondary)]">
        Don&rsquo;t have an account?{" "}
        <Link
          href="/register"
          className="font-medium text-[var(--series-1)] hover:underline"
        >
          Create one
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  // useSearchParams needs a Suspense boundary during static rendering.
  return (
    <Suspense fallback={<div className="h-96" />}>
      <LoginForm />
    </Suspense>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { useAuth } from "@/lib/auth";
import { Alert, Button, Card, Field, Input } from "@/components/ui";

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();

  const [form, setForm] = useState({
    full_name: "",
    email: "",
    password: "",
    department: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function update(key: keyof typeof form) {
    return (event: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [key]: event.target.value }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await register({
        full_name: form.full_name,
        email: form.email,
        password: form.password,
        department: form.department.trim() || null,
      });
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create account.");
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Create your account
        </h1>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          Get read-only access to the analytics dashboards.
        </p>
      </div>

      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <Alert tone="critical">{error}</Alert>}

          <Field label="Full name" htmlFor="full_name">
            <Input
              id="full_name"
              required
              autoComplete="name"
              autoFocus
              value={form.full_name}
              onChange={update("full_name")}
              placeholder="Alex Morgan"
            />
          </Field>

          <Field label="Work email" htmlFor="email">
            <Input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={form.email}
              onChange={update("email")}
              placeholder="you@company.com"
            />
          </Field>

          <Field
            label="Password"
            htmlFor="password"
            hint="At least 8 characters, mixing letters and numbers."
          >
            <Input
              id="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={form.password}
              onChange={update("password")}
              placeholder="••••••••"
            />
          </Field>

          <Field
            label="Department"
            htmlFor="department"
            hint="Optional. Used if an administrator later upgrades you to a manager."
          >
            <Input
              id="department"
              value={form.department}
              onChange={update("department")}
              placeholder="Research & Development"
            />
          </Field>

          <Alert tone="info">
            New accounts are created with the{" "}
            <strong className="text-[var(--text-primary)]">viewer</strong> role.
            Manager and admin access must be granted by an administrator, so
            signing up never widens access to employee data on its own.
          </Alert>

          <Button type="submit" className="w-full" loading={submitting}>
            Create account
          </Button>
        </form>
      </Card>

      <p className="text-center text-sm text-[var(--text-secondary)]">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-medium text-[var(--series-1)] hover:underline"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}

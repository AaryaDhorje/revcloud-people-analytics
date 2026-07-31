"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2 } from "lucide-react";

import { apiFetch } from "@/lib/api";
import { Alert, Button, Card, Field, Input } from "@/components/ui";

function ResetPasswordForm() {
  const router = useRouter();
  const token = useSearchParams().get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (password !== confirm) {
      setError("Those passwords don't match.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await apiFetch("/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, password }),
      });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to reset password.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!token) {
    return (
      <Card className="p-8 text-center">
        <h1 className="text-xl font-semibold">Reset link incomplete</h1>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          This page needs the token from your reset email.
        </p>
        <Button
          className="mt-6"
          onClick={() => router.push("/forgot-password")}
        >
          Request a new link
        </Button>
      </Card>
    );
  }

  if (done) {
    return (
      <div className="space-y-6">
        <Card className="p-8 text-center">
          <CheckCircle2
            className="mx-auto size-9 text-[var(--status-good)]"
            aria-hidden
          />
          <h1 className="mt-4 text-xl font-semibold">Password updated</h1>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            Every existing session was signed out as a precaution. Sign in with
            your new password to continue.
          </p>
          <Button className="mt-6 w-full" onClick={() => router.push("/login")}>
            Go to sign in
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Choose a new password
        </h1>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          Pick something you haven&rsquo;t used before.
        </p>
      </div>

      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <Alert tone="critical">{error}</Alert>}

          <Field
            label="New password"
            htmlFor="password"
            hint="At least 8 characters, mixing letters and numbers."
          >
            <Input
              id="password"
              type="password"
              required
              minLength={8}
              autoFocus
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>

          <Field label="Confirm new password" htmlFor="confirm">
            <Input
              id="confirm"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </Field>

          <Button type="submit" className="w-full" loading={submitting}>
            Update password
          </Button>
        </form>
      </Card>

      <p className="text-center text-sm">
        <Link
          href="/login"
          className="font-medium text-[var(--series-1)] hover:underline"
        >
          Back to sign in
        </Link>
      </p>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="h-96" />}>
      <ResetPasswordForm />
    </Suspense>
  );
}

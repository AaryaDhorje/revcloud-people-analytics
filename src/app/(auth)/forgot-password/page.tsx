"use client";

import { useState } from "react";
import Link from "next/link";
import { MailCheck } from "lucide-react";

import { apiFetch } from "@/lib/api";
import { Alert, Button, Card, Field, Input } from "@/components/ui";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await apiFetch("/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <div className="space-y-6">
        <Card className="p-8 text-center">
          <MailCheck
            className="mx-auto size-9 text-[var(--status-good)]"
            aria-hidden
          />
          <h1 className="mt-4 text-xl font-semibold">Check your inbox</h1>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            If that email is registered, a reset link is on its way. The link
            expires in 30 minutes.
          </p>

          <Alert tone="info" className="mt-6 text-left">
            In this demo environment email delivery is set to{" "}
            <code className="rounded bg-[var(--page)] px-1 py-0.5 text-xs">
              console
            </code>
            , so the reset link is written to the backend server log rather than
            sent. Configure the SMTP environment variables to deliver real mail.
          </Alert>
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Reset your password
        </h1>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          Enter your email and we&rsquo;ll send you a link to choose a new one.
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
              autoFocus
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
            />
          </Field>

          <Button type="submit" className="w-full" loading={submitting}>
            Send reset link
          </Button>
        </form>
      </Card>

      <p className="text-center text-sm text-[var(--text-secondary)]">
        Remembered it?{" "}
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

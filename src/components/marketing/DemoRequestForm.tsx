"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";

import { apiFetch } from "@/lib/api";
import { Button, Field, Input, Textarea } from "@/components/ui";

export function DemoRequestForm() {
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setStatus("sending");

    const data = new FormData(event.currentTarget);
    try {
      await apiFetch("/public/demo-request", {
        method: "POST",
        body: JSON.stringify({
          email: data.get("email"),
          full_name: data.get("full_name") || null,
          company: data.get("company") || null,
          message: data.get("message") || null,
        }),
      });
      setStatus("sent");
    } catch (err) {
      setStatus("idle");
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  if (status === "sent") {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl bg-[var(--surface)] p-8 text-center ring-1 ring-[var(--border)]">
        <CheckCircle2
          className="size-8 text-[var(--status-good)]"
          aria-hidden
        />
        <p className="text-base font-medium">Request received</p>
        <p className="max-w-sm text-sm text-[var(--text-secondary)]">
          Thanks — we&rsquo;ll be in touch shortly to arrange your walkthrough.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-xl bg-[var(--surface)] p-6 ring-1 ring-[var(--border)] sm:p-8"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Work email" htmlFor="demo-email">
          <Input
            id="demo-email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@company.com"
          />
        </Field>
        <Field label="Full name" htmlFor="demo-name">
          <Input
            id="demo-name"
            name="full_name"
            autoComplete="name"
            placeholder="Alex Morgan"
          />
        </Field>
      </div>

      <Field label="Company" htmlFor="demo-company">
        <Input id="demo-company" name="company" placeholder="Acme Inc." />
      </Field>

      <Field
        label="What would you like to see?"
        htmlFor="demo-message"
        hint="Optional — tell us which metrics matter most to you."
      >
        <Textarea
          id="demo-message"
          name="message"
          rows={3}
          placeholder="We're trying to understand why attrition is climbing in our engineering org."
        />
      </Field>

      {error && (
        <p role="alert" className="text-sm text-[var(--status-critical)]">
          {error}
        </p>
      )}

      <Button
        type="submit"
        size="lg"
        loading={status === "sending"}
        className="w-full"
      >
        Request a demo
      </Button>
      <p className="text-center text-xs text-[var(--text-muted)]">
        No credit card required. We&rsquo;ll never share your details.
      </p>
    </form>
  );
}

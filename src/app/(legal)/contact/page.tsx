import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, Mail, MessageSquare } from "lucide-react";

import { DemoRequestForm } from "@/components/marketing/DemoRequestForm";

export const metadata: Metadata = { title: "Contact" };

export default function ContactPage() {
  return (
    <article className="space-y-8">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Contact</h1>
        <p className="mt-3 text-[var(--text-secondary)]">
          Send a note through the form below and it lands in the platform&rsquo;s
          demo-request queue, visible to administrators in the admin console.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          {
            icon: MessageSquare,
            title: "Product questions",
            detail: "What the platform measures and how the metrics are derived.",
          },
          {
            icon: Mail,
            title: "Demo requests",
            detail: "A walkthrough against data that resembles your own.",
          },
          {
            icon: BookOpen,
            title: "API reference",
            detail: "Interactive OpenAPI docs for every endpoint.",
          },
        ].map(({ icon: Icon, title, detail }) => (
          <div
            key={title}
            className="rounded-xl bg-[var(--surface)] p-4 ring-1 ring-[var(--border)]"
          >
            <Icon className="size-5 text-[var(--series-1)]" aria-hidden />
            <p className="mt-3 text-sm font-medium">{title}</p>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">{detail}</p>
          </div>
        ))}
      </div>

      <DemoRequestForm />

      <p className="text-sm text-[var(--text-secondary)]">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-medium text-[var(--series-1)] underline underline-offset-4"
        >
          Sign in
        </Link>
        .
      </p>
    </article>
  );
}

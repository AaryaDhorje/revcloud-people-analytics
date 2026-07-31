import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Database,
  Gauge,
  HeartPulse,
  LineChart,
  Lock,
  ShieldCheck,
  Sparkles,
  Target,
  UserPlus,
  Users,
} from "lucide-react";

import { DemoRequestForm } from "@/components/marketing/DemoRequestForm";
import { LiveStats } from "@/components/marketing/LiveStats";
import { ThemeToggle } from "@/components/ThemeToggle";

const FEATURES = [
  {
    icon: UserPlus,
    title: "Talent Acquisition",
    description:
      "Measure quality of hire and first-year attrition to see whether the people you bring in actually stay and perform.",
    points: ["Quality of hire", "Early attrition", "New-hire performance"],
  },
  {
    icon: HeartPulse,
    title: "Retention & Stability",
    description:
      "Find the departments, roles and tenure bands quietly bleeding people — before the exit interviews pile up.",
    points: ["Attrition by segment", "Tenure risk", "Internal mobility"],
  },
  {
    icon: Gauge,
    title: "Engagement & Culture",
    description:
      "A composite engagement index and overtime signals that act as leading indicators of burnout.",
    points: ["Engagement index", "eNPS proxy", "Overtime load"],
  },
  {
    icon: BarChart3,
    title: "Workforce & Productivity",
    description:
      "Connect headcount, pay equity and tenure distribution to the business questions leaders actually ask.",
    points: ["Headcount & demographics", "Pay equity", "Revenue per employee"],
  },
];

const STEPS = [
  {
    icon: Database,
    title: "Connect data",
    description:
      "Upload an HR extract or point the platform at your HRIS. A pandas pipeline cleans, validates and derives the fields your metrics need.",
  },
  {
    icon: LineChart,
    title: "Analyse insights",
    description:
      "KPIs, distributions and trends recompute on ingest and stream to every open dashboard over a live connection.",
  },
  {
    icon: Target,
    title: "Take action",
    description:
      "A trained model ranks who is most likely to leave and shows the specific factors driving each person's risk.",
  },
];

const TESTIMONIALS = [
  {
    quote:
      "We stopped arguing about whether attrition was a problem and started arguing about which team to fix first. That is a much better argument to be having.",
    name: "VP People",
    role: "Series C fintech · illustrative",
  },
  {
    quote:
      "The risk drivers are the part that changed our reviews. Knowing someone is high risk is not useful. Knowing it is overtime plus no promotion in three years is.",
    name: "Head of Talent",
    role: "Global manufacturer · illustrative",
  },
  {
    quote:
      "Our managers only see their own teams and our executives see everything. That single detail is what got this past our data-protection review.",
    name: "Director, HR Operations",
    role: "Healthcare network · illustrative",
  },
];

export default function LandingPage() {
  return (
    <>
      {/* ---------------------------------------------------------------- */}
      {/* Header                                                            */}
      {/* ---------------------------------------------------------------- */}
      <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[color-mix(in_oklab,var(--page)_88%,transparent)] backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <span className="grid size-8 place-items-center rounded-lg bg-[var(--series-1)] text-white">
              <Sparkles className="size-4" aria-hidden />
            </span>
            <span>RevCloud</span>
            <span className="hidden text-sm font-normal text-[var(--text-muted)] sm:inline">
              People Analytics
            </span>
          </Link>

          <div className="flex items-center gap-2">
            <ThemeToggle className="hidden sm:inline-flex" />
            <Link
              href="/login"
              className="rounded-lg px-3 py-2 text-sm font-medium text-[var(--text-secondary)] transition hover:text-[var(--text-primary)]"
            >
              Sign in
            </Link>
            <Link
              href="/register"
              className="inline-flex h-9 items-center rounded-lg bg-[var(--series-1)] px-4 text-sm font-medium text-white shadow-sm transition hover:brightness-110"
            >
              Get started
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* -------------------------------------------------------------- */}
        {/* Hero                                                            */}
        {/* -------------------------------------------------------------- */}
        <section className="relative overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 -top-40 h-96 bg-[radial-gradient(60%_60%_at_50%_50%,color-mix(in_oklab,var(--series-1)_18%,transparent),transparent)]"
          />
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
            <div className="mx-auto max-w-3xl text-center">
              <span className="inline-flex items-center gap-2 rounded-full bg-[var(--surface)] px-3 py-1 text-xs font-medium text-[var(--text-secondary)] ring-1 ring-[var(--border-strong)]">
                <span
                  className="size-1.5 rounded-full bg-[var(--status-good)]"
                  aria-hidden
                />
                Attrition model live · cross-validated ROC-AUC 0.83
              </span>

              <h1 className="mt-6 text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
                Turn People Data into Strategic Insights
              </h1>

              <p className="mx-auto mt-6 max-w-2xl text-lg text-pretty text-[var(--text-secondary)]">
                Most organisations track finance and operations precisely, then
                guess at their people. RevCloud closes that gap — a secure,
                end-to-end platform that turns raw HR data into a diagnosis of
                workforce health and an early warning on the risks building
                inside it.
              </p>

              <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link
                  href="/register"
                  className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[var(--series-1)] px-7 text-base font-medium text-white shadow-sm transition hover:brightness-110 sm:w-auto"
                >
                  Get started
                  <ArrowRight className="size-4" aria-hidden />
                </Link>
                <a
                  href="#request-demo"
                  className="inline-flex h-12 w-full items-center justify-center rounded-lg bg-[var(--surface-raised)] px-7 text-base font-medium ring-1 ring-[var(--border-strong)] transition hover:bg-[var(--surface)] sm:w-auto"
                >
                  Request a demo
                </a>
              </div>
            </div>

            <div className="mx-auto mt-16 max-w-3xl rounded-xl bg-[var(--surface)] p-6 ring-1 ring-[var(--border)] sm:p-8">
              <LiveStats />
              <p className="mt-4 text-xs text-[var(--text-muted)]">
                Figures read live from the platform database.
              </p>
            </div>
          </div>
        </section>

        {/* -------------------------------------------------------------- */}
        {/* The problem                                                     */}
        {/* -------------------------------------------------------------- */}
        <section className="border-y border-[var(--border)] bg-[var(--surface)]">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                  The &ldquo;human&rdquo; gap in business data
                </h2>
                <p className="mt-4 text-[var(--text-secondary)]">
                  HR teams are flooded with data from HRIS, payroll and
                  performance systems, yet still lack one unified view they can
                  act on. The result is a familiar set of failures.
                </p>
              </div>

              <dl className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
                {[
                  {
                    term: "Reactive HR",
                    detail:
                      "Decisions made on intuition and exit interviews — lagging indicators, by definition.",
                  },
                  {
                    term: "The impact gap",
                    detail:
                      "Leaders ask why margin is dropping; the dashboard reports headcount. The two never meet.",
                  },
                  {
                    term: "Siloed metrics",
                    detail:
                      "Cost-per-hire and time-to-hire tracked apart from the retention they actually predict.",
                  },
                  {
                    term: "Hidden risks",
                    detail:
                      "Burnout and flight risk stay invisible until the turnover has already happened.",
                  },
                  {
                    term: "Data inaccessibility",
                    detail:
                      "The numbers that matter are locked in spreadsheets nobody can safely share.",
                  },
                ].map((item) => (
                  <div key={item.term}>
                    <dt className="text-sm font-medium">{item.term}</dt>
                    <dd className="mt-1 text-sm text-[var(--text-secondary)]">
                      {item.detail}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </section>

        {/* -------------------------------------------------------------- */}
        {/* Features                                                        */}
        {/* -------------------------------------------------------------- */}
        <section id="features" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <div className="max-w-2xl">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Four connected views of workforce health
            </h2>
            <p className="mt-4 text-[var(--text-secondary)]">
              Every metric is tied back to a decision someone has to make. Where
              the underlying data cannot support a metric honestly, the platform
              says so rather than inventing a number.
            </p>
          </div>

          <div className="mt-12 grid gap-6 sm:grid-cols-2">
            {FEATURES.map(({ icon: Icon, title, description, points }) => (
              <div
                key={title}
                className="rounded-xl bg-[var(--surface)] p-6 ring-1 ring-[var(--border)] transition hover:ring-[var(--border-strong)]"
              >
                <span className="grid size-10 place-items-center rounded-lg bg-[color-mix(in_oklab,var(--series-1)_12%,transparent)] text-[var(--series-1)]">
                  <Icon className="size-5" aria-hidden />
                </span>
                <h3 className="mt-4 text-lg font-medium">{title}</h3>
                <p className="mt-2 text-sm text-[var(--text-secondary)]">
                  {description}
                </p>
                <ul className="mt-4 flex flex-wrap gap-2">
                  {points.map((point) => (
                    <li
                      key={point}
                      className="rounded-full bg-[var(--page)] px-2.5 py-1 text-xs text-[var(--text-secondary)] ring-1 ring-[var(--border)]"
                    >
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* -------------------------------------------------------------- */}
        {/* How it works                                                    */}
        {/* -------------------------------------------------------------- */}
        <section className="border-y border-[var(--border)] bg-[var(--surface)]">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <h2 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">
              How it works
            </h2>

            <ol className="mt-14 grid gap-8 md:grid-cols-3">
              {STEPS.map(({ icon: Icon, title, description }, index) => (
                <li key={title} className="relative">
                  <div className="flex items-center gap-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-[var(--series-1)] text-white">
                      <Icon className="size-5" aria-hidden />
                    </span>
                    <span className="text-xs font-medium tracking-wide text-[var(--text-muted)] uppercase">
                      Step {index + 1}
                    </span>
                  </div>
                  <h3 className="mt-4 text-lg font-medium">{title}</h3>
                  <p className="mt-2 text-sm text-[var(--text-secondary)]">
                    {description}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* -------------------------------------------------------------- */}
        {/* Security                                                        */}
        {/* -------------------------------------------------------------- */}
        <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <div className="grid gap-10 lg:grid-cols-2 lg:items-center lg:gap-16">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                Built for data nobody should see by accident
              </h2>
              <p className="mt-4 text-[var(--text-secondary)]">
                Employee records are among the most sensitive data an
                organisation holds. Access control is enforced in the query
                layer, not the interface — a manager&rsquo;s scope is derived
                from their session, so it cannot be widened by editing a URL.
              </p>

              <ul className="mt-8 space-y-4">
                {[
                  {
                    icon: Lock,
                    title: "JWT sessions with automatic idle logout",
                    detail:
                      "Short-lived access tokens in httpOnly cookies, silently renewed while you work and revoked the moment you sign out.",
                  },
                  {
                    icon: Users,
                    title: "Role-based access control",
                    detail:
                      "Admins see the company. Managers see only their department. Viewers get read-only dashboards.",
                  },
                  {
                    icon: ShieldCheck,
                    title: "Audit trail on every read",
                    detail:
                      "Opening an individual employee profile is recorded with who, what and when.",
                  },
                ].map(({ icon: Icon, title, detail }) => (
                  <li key={title} className="flex gap-4">
                    <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-[color-mix(in_oklab,var(--series-1)_12%,transparent)] text-[var(--series-1)]">
                      <Icon className="size-4" aria-hidden />
                    </span>
                    <div>
                      <p className="text-sm font-medium">{title}</p>
                      <p className="mt-1 text-sm text-[var(--text-secondary)]">
                        {detail}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
              {TESTIMONIALS.map((testimonial) => (
                <figure
                  key={testimonial.name}
                  className="rounded-xl bg-[var(--surface)] p-5 ring-1 ring-[var(--border)]"
                >
                  <blockquote className="text-sm text-pretty text-[var(--text-secondary)]">
                    &ldquo;{testimonial.quote}&rdquo;
                  </blockquote>
                  <figcaption className="mt-3 text-xs">
                    <span className="font-medium">{testimonial.name}</span>
                    <span className="text-[var(--text-muted)]">
                      {" "}
                      — {testimonial.role}
                    </span>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>

        {/* -------------------------------------------------------------- */}
        {/* Demo request                                                    */}
        {/* -------------------------------------------------------------- */}
        <section
          id="request-demo"
          className="border-t border-[var(--border)] bg-[var(--surface)]"
        >
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                  See it against your own numbers
                </h2>
                <p className="mt-4 text-[var(--text-secondary)]">
                  Tell us what you are trying to understand about your workforce
                  and we will walk you through the platform with data that looks
                  like yours.
                </p>
                <p className="mt-6 text-sm text-[var(--text-secondary)]">
                  Prefer to explore first?{" "}
                  <Link
                    href="/register"
                    className="font-medium text-[var(--series-1)] underline underline-offset-4"
                  >
                    Create a free viewer account
                  </Link>{" "}
                  and browse the dashboards straight away.
                </p>
              </div>

              <DemoRequestForm />
            </div>
          </div>
        </section>
      </main>

      {/* ---------------------------------------------------------------- */}
      {/* Footer                                                            */}
      {/* ---------------------------------------------------------------- */}
      <footer className="border-t border-[var(--border)]">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
          <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2 text-sm font-medium">
              <span className="grid size-7 place-items-center rounded-md bg-[var(--series-1)] text-white">
                <Sparkles className="size-3.5" aria-hidden />
              </span>
              RevCloud People Analytics
            </div>

            <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-[var(--text-secondary)]">
              <Link
                href="/privacy"
                className="transition hover:text-[var(--text-primary)]"
              >
                Privacy Policy
              </Link>
              <Link
                href="/terms"
                className="transition hover:text-[var(--text-primary)]"
              >
                Terms of Service
              </Link>
              <Link
                href="/contact"
                className="transition hover:text-[var(--text-primary)]"
              >
                Contact
              </Link>
              <a
                href="/api/py/docs"
                className="transition hover:text-[var(--text-primary)]"
              >
                API docs
              </a>
            </nav>
          </div>

          <p className="mt-8 text-xs text-[var(--text-muted)]">
            Built as a product and implementation brief demonstration. Employee
            figures come from the public IBM HR Analytics Employee Attrition
            &amp; Performance dataset; no real personal data is processed.
          </p>
        </div>
      </footer>
    </>
  );
}

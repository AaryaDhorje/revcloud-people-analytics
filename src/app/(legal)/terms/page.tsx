import type { Metadata } from "next";

export const metadata: Metadata = { title: "Terms of Service" };

export default function TermsPage() {
  return (
    <article className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">
          Terms of Service
        </h1>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Last updated 31 July 2026
        </p>
      </header>

      <div className="rounded-lg bg-[var(--surface)] p-4 text-sm text-[var(--text-secondary)] ring-1 ring-[var(--border)]">
        <strong className="text-[var(--text-primary)]">
          Demonstration notice.
        </strong>{" "}
        This deployment exists to demonstrate a product and implementation
        brief. It is provided as-is, with no warranty and no service-level
        commitment.
      </div>

      <section className="space-y-3">
        <h2 className="text-xl font-medium">Acceptable use</h2>
        <p className="text-[var(--text-secondary)]">
          Accounts are personal and must not be shared. Do not attempt to access
          data outside the scope your role grants, and do not upload real
          employee data to this demonstration environment.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-medium">Analytical output</h2>
        <p className="text-[var(--text-secondary)]">
          The platform produces statistical estimates, not determinations about
          individuals. The attrition model reports a probability with the
          factors contributing to it; it does not predict what any specific
          person will do. Employment decisions should never rest on a model
          score alone.
        </p>
        <p className="text-[var(--text-secondary)]">
          Several figures are explicitly derived rather than measured. Hire and
          exit dates are reconstructed from recorded tenure because the source
          dataset contains no calendar dates, and the eNPS figure is a proxy
          inferred from satisfaction scores. Both are labelled as such wherever
          they appear.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-medium">Availability</h2>
        <p className="text-[var(--text-secondary)]">
          The service may be modified or withdrawn at any time. Data in this
          environment may be reset without notice.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-medium">Liability</h2>
        <p className="text-[var(--text-secondary)]">
          To the fullest extent permitted by law, no liability is accepted for
          any loss arising from use of this demonstration.
        </p>
      </section>
    </article>
  );
}

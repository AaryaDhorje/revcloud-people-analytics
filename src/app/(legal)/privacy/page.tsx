import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <article className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Privacy Policy</h1>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Last updated 31 July 2026
        </p>
      </header>

      <div className="rounded-lg bg-[var(--surface)] p-4 text-sm text-[var(--text-secondary)] ring-1 ring-[var(--border)]">
        <strong className="text-[var(--text-primary)]">
          Demonstration notice.
        </strong>{" "}
        This deployment is a portfolio demonstration. The employee records it
        analyses come from the public IBM HR Analytics Employee Attrition &amp;
        Performance dataset. No real personal data is processed, and this
        document is illustrative rather than a binding legal agreement.
      </div>

      <section className="space-y-3">
        <h2 className="text-xl font-medium">What we collect</h2>
        <p className="text-[var(--text-secondary)]">
          Two categories of data exist in the platform:
        </p>
        <ul className="list-disc space-y-2 pl-5 text-[var(--text-secondary)]">
          <li>
            <strong className="text-[var(--text-primary)]">
              Account data.
            </strong>{" "}
            Your name, email address, password hash, assigned role and
            department. Passwords are hashed with bcrypt and are never stored or
            transmitted in plain text.
          </li>
          <li>
            <strong className="text-[var(--text-primary)]">
              Workforce data.
            </strong>{" "}
            Employee records uploaded by an administrator, plus the fields the
            pipeline derives from them, such as tenure bands and the engagement
            index.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-medium">How access is restricted</h2>
        <p className="text-[var(--text-secondary)]">
          Access is enforced in the query layer rather than the interface. A
          manager&rsquo;s department scope is derived from their authenticated
          session, so it cannot be widened by changing a request parameter.
          Administrators see company-wide figures; viewers have read-only
          access.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-medium">Audit logging</h2>
        <p className="text-[var(--text-secondary)]">
          The platform records who accessed which data and when. Opening an
          individual employee profile — the most sensitive read available — is
          logged per record. Administrators can review this trail in the admin
          console.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-medium">Sessions and retention</h2>
        <p className="text-[var(--text-secondary)]">
          Sessions use short-lived JSON Web Tokens held in httpOnly cookies,
          which JavaScript cannot read. Sessions end automatically after a
          period of inactivity, and signing out revokes existing tokens
          immediately. Account and workforce data persist until an administrator
          deletes them or replaces the dataset with a new upload.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-medium">Contact</h2>
        <p className="text-[var(--text-secondary)]">
          Questions about this policy can be sent through the{" "}
          <a
            href="/contact"
            className="font-medium text-[var(--series-1)] underline underline-offset-4"
          >
            contact page
          </a>
          .
        </p>
      </section>
    </article>
  );
}

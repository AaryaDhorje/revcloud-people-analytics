import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <header className="border-b border-[var(--border)]">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <span className="grid size-8 place-items-center rounded-lg bg-[var(--series-1)] text-white">
              <Sparkles className="size-4" aria-hidden />
            </span>
            RevCloud
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-[var(--text-secondary)] transition hover:text-[var(--text-primary)]"
          >
            <ArrowLeft className="size-4" aria-hidden />
            Back to site
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-14 sm:px-6">
        {children}
      </main>

      <footer className="border-t border-[var(--border)]">
        <div className="mx-auto flex max-w-3xl flex-wrap gap-x-6 gap-y-2 px-4 py-8 text-sm text-[var(--text-secondary)] sm:px-6">
          <Link href="/privacy" className="hover:text-[var(--text-primary)]">
            Privacy Policy
          </Link>
          <Link href="/terms" className="hover:text-[var(--text-primary)]">
            Terms of Service
          </Link>
          <Link href="/contact" className="hover:text-[var(--text-primary)]">
            Contact
          </Link>
        </div>
      </footer>
    </>
  );
}

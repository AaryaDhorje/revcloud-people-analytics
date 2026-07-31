import Link from "next/link";
import { Sparkles } from "lucide-react";

import { ThemeToggle } from "@/components/ThemeToggle";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="flex h-16 items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="grid size-8 place-items-center rounded-lg bg-[var(--series-1)] text-white">
            <Sparkles className="size-4" aria-hidden />
          </span>
          RevCloud
        </Link>
        <ThemeToggle />
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-10 sm:px-6">
        <div className="w-full max-w-md">{children}</div>
      </main>

      <footer className="px-4 py-6 text-center text-xs text-[var(--text-muted)] sm:px-6">
        <Link href="/privacy" className="hover:text-[var(--text-secondary)]">
          Privacy
        </Link>
        <span className="mx-2">·</span>
        <Link href="/terms" className="hover:text-[var(--text-secondary)]">
          Terms
        </Link>
        <span className="mx-2">·</span>
        <Link href="/contact" className="hover:text-[var(--text-secondary)]">
          Contact
        </Link>
      </footer>
    </div>
  );
}

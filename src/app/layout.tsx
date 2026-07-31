import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { AuthProvider } from "@/lib/auth";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "RevCloud — People Analytics & Strategy Platform",
    template: "%s · RevCloud",
  },
  description:
    "Turn workforce data into strategic insight. Diagnose workforce health, " +
    "predict attrition risk before it happens, and measure the business impact " +
    "of HR initiatives.",
};

/**
 * Applies the saved theme before first paint.
 *
 * Without this the page renders in the OS theme and then snaps to the stored
 * preference, which is a visible flash on every navigation.
 */
const THEME_BOOTSTRAP = `
(function () {
  try {
    var saved = localStorage.getItem("rc-theme");
    if (saved === "light" || saved === "dark") {
      document.documentElement.setAttribute("data-theme", saved);
    }
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
      </head>
      <body className="flex min-h-full flex-col bg-[var(--page)] text-[var(--text-primary)]">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}

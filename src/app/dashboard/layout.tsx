import { Suspense } from "react";

import { FilterProvider } from "@/components/dashboard/FilterContext";
import { DashboardShell } from "@/components/dashboard/Shell";
import { Spinner } from "@/components/ui";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DashboardShell>
      {/* FilterProvider reads useSearchParams, so it needs a Suspense
          boundary above it. */}
      <Suspense
        fallback={
          <div className="flex h-64 items-center justify-center">
            <Spinner />
          </div>
        }
      >
        <FilterProvider>{children}</FilterProvider>
      </Suspense>
    </DashboardShell>
  );
}

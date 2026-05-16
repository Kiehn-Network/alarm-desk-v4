import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

const LiveMap = lazy(() => import("@/components/monitor/live-map"));

export const Route = createFileRoute("/_authenticated/monitor")({
  component: MonitorPage,
  ssr: false,
});

function MonitorPage() {
  return (
    <div className="p-6 lg:p-8 flex flex-col gap-4 h-full">
      <div>
        <h1 className="text-3xl font-bold">Monitor</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Live-Standorte aller Fahrer der Domäne und ihr aktueller Einsatzstatus.
        </p>
      </div>
      <Suspense
        fallback={
          <div className="flex-1 grid place-items-center rounded-xl border border-border bg-card min-h-[400px]">
            <div className="size-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
        }
      >
        <LiveMap />
      </Suspense>
    </div>
  );
}

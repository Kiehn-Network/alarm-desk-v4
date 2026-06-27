import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

const AuswertungMap = lazy(() => import("@/components/auswertung/auswertung-map"));

export const Route = createFileRoute("/_authenticated/auswertung")({
  component: AuswertungPage,
  ssr: false,
});

function AuswertungPage() {
  return (
    <div className="p-6 lg:p-8 flex flex-col gap-4 h-full">
      <div>
        <h1 className="text-3xl font-bold">Auswertung</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Karten-Auswertung von Echteinbrüchen. Auf die Karte klicken, um einen neuen Pin zu setzen.
        </p>
      </div>
      <Suspense
        fallback={
          <div className="flex-1 grid place-items-center rounded-xl border border-border bg-card min-h-[400px]">
            <div className="size-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
        }
      >
        <AuswertungMap />
      </Suspense>
    </div>
  );
}
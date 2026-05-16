import { createFileRoute } from "@tanstack/react-router";
import { Construction } from "lucide-react";

export const Route = createFileRoute("/_authenticated/notdienst/rohrservice")({
  component: () => (
    <div className="p-6 lg:p-8">
      <h1 className="text-3xl font-bold">Notdienst: Rohrservice</h1>
      <div className="mt-8 rounded-xl border border-border bg-card p-12 text-center" style={{ boxShadow: "var(--shadow-card)" }}>
        <div className="mx-auto size-14 rounded-full bg-muted grid place-items-center">
          <Construction className="size-6 text-muted-foreground" />
        </div>
        <h2 className="mt-4 text-lg font-semibold">In Vorbereitung</h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
          Dieses Modul wird in einer der nächsten Iterationen umgesetzt.
        </p>
      </div>
    </div>
  ),
});

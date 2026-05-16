import { createFileRoute } from "@tanstack/react-router";
import { Construction } from "lucide-react";

export const Route = createFileRoute("/_authenticated/notdienst/lutz")({
  component: () => (
    <div className="p-6 lg:p-8">
      <h1 className="text-3xl font-bold capitalize">Notdienst: lutz</h1>
      <div className="mt-8 rounded-xl border border-border bg-card p-12 text-center" style={{ boxShadow: "var(--shadow-card)" }}>
        <Construction className="mx-auto size-10 text-muted-foreground" />
        <p className="mt-4 text-sm text-muted-foreground">Modul folgt in Kürze.</p>
      </div>
    </div>
  ),
});

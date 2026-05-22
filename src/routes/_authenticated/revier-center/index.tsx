import { createFileRoute, Link } from "@tanstack/react-router";
import { Radar, MapPin, Wrench, ScanLine } from "lucide-react";

export const Route = createFileRoute("/_authenticated/revier-center/")({
  component: RevierCenterUebersicht,
});

const cards = [
  { to: "/revier-center/owks/zeitstrahl", title: "Zeitstrahl", desc: "Bestreifungen visuell planen und bearbeiten", icon: Radar },
  { to: "/revier-center/owks/bestreifungsplaene", title: "Bestreifungspläne", desc: "Wiederkehrende Pläne anlegen", icon: Wrench },
  { to: "/revier-center/owks/rundgaenge", title: "Rundgangsverwaltung", desc: "Rundgänge mit Kontrollpunkten", icon: MapPin },
  { to: "/revier-center/owks/nfc-punkte", title: "NFC-Punkte", desc: "NFC-Tags verwalten und zuordnen", icon: ScanLine },
];

function RevierCenterUebersicht() {
  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Übersicht</h2>
        <p className="text-sm text-muted-foreground">Das Revier Center bündelt die Sicherheits- und Wachmodule.</p>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <Link key={c.to} to={c.to}
            className="rounded-xl border border-border bg-card p-5 hover:border-primary/60 hover:shadow-md transition">
            <c.icon className="size-6 text-primary" />
            <div className="mt-3 font-semibold">{c.title}</div>
            <div className="text-xs text-muted-foreground mt-1">{c.desc}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}

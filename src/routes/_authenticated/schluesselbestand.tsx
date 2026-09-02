import { createFileRoute } from "@tanstack/react-router";
import { Boxes } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/schluesselbestand")({
  component: SchluesselbestandPage,
  head: () => ({
    meta: [
      { title: "Schlüsselbestand – AlarmDesk" },
      { name: "description", content: "Bestandsverwaltung aller Schlüssel: Depot, Lagerort, Menge und Ausgabestatus." },
      { property: "og:title", content: "Schlüsselbestand – AlarmDesk" },
      { property: "og:description", content: "Bestandsverwaltung aller Schlüssel: Depot, Lagerort, Menge und Ausgabestatus." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function SchluesselbestandPage() {
  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Boxes className="size-5 text-primary" />
        <h1 className="text-xl font-semibold">Schlüsselbestand</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">In Vorbereitung</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Hier entsteht die Bestandsverwaltung für alle Schlüssel (Depot, Lagerort/Schrank &amp; Fach,
          Menge, Ausgabestatus). Der Funktionsumfang wird gerade abgestimmt.
        </CardContent>
      </Card>
    </div>
  );
}

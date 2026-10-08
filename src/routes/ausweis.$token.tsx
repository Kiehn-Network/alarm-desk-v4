import { createFileRoute } from "@tanstack/react-router";
import { pruefeAusweis } from "@/lib/ausweis-pruefen.functions";

export const Route = createFileRoute("/ausweis/$token")({
  loader: ({ params }) => pruefeAusweis({ data: { token: params.token } }),
  head: () => ({
    meta: [
      { title: "Dienstausweis prüfen – AlarmDesk" },
      { name: "description", content: "Prüfung eines AlarmDesk-Dienstausweises: Name, Firma und Gültigkeit." },
      { property: "og:title", content: "Dienstausweis prüfen – AlarmDesk" },
      { property: "og:description", content: "Prüfung eines AlarmDesk-Dienstausweises: Name, Firma und Gültigkeit." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Seite,
});

function datum(s: string | null) {
  if (!s) return "unbefristet";
  const [y, m, d] = s.split("-");
  return `${d}.${m}.${y}`;
}

function Seite() {
  const r = Route.useLoaderData();
  const ok = r.gefunden && r.status !== "abgelaufen";
  return (
    <main className="min-h-screen bg-muted/40 flex items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl bg-card text-card-foreground shadow-lg border overflow-hidden">
        <div className={`px-5 py-4 text-center font-bold text-lg ${!r.gefunden ? "bg-destructive text-destructive-foreground" : ok ? "bg-primary text-primary-foreground" : "bg-destructive text-destructive-foreground"}`}>
          {!r.gefunden ? "✗ Ausweis nicht gefunden" : ok ? "✓ Ausweis gültig" : "✗ Ausweis abgelaufen"}
        </div>
        {r.gefunden ? (
          <div className="p-5 space-y-4 text-center">
            {r.foto ? (
              <img src={r.foto} alt={r.name} className="mx-auto h-40 w-32 rounded-lg object-cover border" />
            ) : (
              <div className="mx-auto h-40 w-32 rounded-lg border bg-muted flex items-center justify-center text-xs text-muted-foreground">Kein Foto</div>
            )}
            <div>
              <div className="text-xl font-semibold">{r.name}</div>
              {r.funktion && <div className="text-sm text-muted-foreground">{r.funktion}</div>}
            </div>
            <dl className="text-sm text-left grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
              {r.firma && (<><dt className="text-muted-foreground">Firma</dt><dd className="font-medium">{r.firma}</dd></>)}
              {r.ausweisNr && (<><dt className="text-muted-foreground">Ausweis-Nr.</dt><dd className="font-medium">{r.ausweisNr}</dd></>)}
              <dt className="text-muted-foreground">Gültig bis</dt><dd className="font-medium">{datum(r.gueltigBis)}</dd>
            </dl>
          </div>
        ) : (
          <p className="p-5 text-sm text-center text-muted-foreground">Dieser Code gehört zu keinem bekannten Dienstausweis. Bitte den Ausweis nicht akzeptieren und die Firma kontaktieren.</p>
        )}
        <div className="px-5 py-3 text-center text-xs text-muted-foreground border-t">AlarmDesk · Live-Prüfung des Dienstausweises</div>
      </div>
    </main>
  );
}

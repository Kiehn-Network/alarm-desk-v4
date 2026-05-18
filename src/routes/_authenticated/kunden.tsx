import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Search, Clock, Users, History as HistoryIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { searchKundenEinsaetze, listEinsatzHistorie } from "@/lib/einsaetze.functions";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/kunden")({
  component: KundenPage,
});

const STATUS_META: Record<string, { label: string; cls: string }> = {
  in_bearbeitung: { label: "Läuft", cls: "bg-blue-500/15 text-blue-400 border border-blue-500/30" },
  abgeschlossen: { label: "Abgeschlossen", cls: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30" },
  storniert: { label: "Storniert", cls: "bg-red-500/15 text-red-400 border border-red-500/30" },
  entwurf: { label: "Entwurf", cls: "bg-muted text-muted-foreground" },
  wartet_freigabe: { label: "Offen", cls: "bg-amber-500/15 text-amber-400 border border-amber-500/30" },
  freigegeben: { label: "Freigegeben", cls: "bg-cyan-500/15 text-cyan-400 border border-cyan-500/30" },
  abgelehnt: { label: "Abgelehnt", cls: "bg-red-500/15 text-red-400 border border-red-500/30" },
};

function fmt(d?: string | null) {
  if (!d) return "–";
  return new Date(d).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function toIsoStart(local: string) {
  if (!local) return null;
  const d = new Date(local);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}
function toIsoEnd(local: string) {
  if (!local) return null;
  const d = new Date(local);
  if (isNaN(d.getTime())) return null;
  // Ende des Tages
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

function KundenPage() {
  const search = useServerFn(searchKundenEinsaetze);
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [submitted, setSubmitted] = useState({ q: "", from: "" as string, to: "" as string });
  const [historyFor, setHistoryFor] = useState<any | null>(null);

  const { data, isFetching } = useQuery({
    queryKey: ["kunden-einsaetze", submitted],
    queryFn: () => search({ data: {
      q: submitted.q || null,
      from: submitted.from ? toIsoStart(submitted.from) : null,
      to: submitted.to ? toIsoEnd(submitted.to) : null,
    }}),
    enabled: !!(submitted.q || submitted.from || submitted.to),
  });

  const einsaetze: any[] = data?.einsaetze ?? [];
  const profiles: Record<string, string> = data?.profiles ?? {};

  const grouped = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const e of einsaetze) {
      const key = (e.kunden_name || "(ohne Kunde)").trim();
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [einsaetze]);

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2"><Users className="size-7 text-primary" /> Kunden</h1>
        <p className="text-sm text-muted-foreground mt-1">Einsätze nach Kunde, Einsatz-Nr. oder Zeitraum suchen.</p>
      </div>

      <form
        className="rounded-xl border border-border bg-card p-4 lg:p-5 grid grid-cols-1 md:grid-cols-12 gap-3 items-end"
        onSubmit={(ev) => { ev.preventDefault(); setSubmitted({ q: q.trim(), from, to }); }}
      >
        <div className="md:col-span-5">
          <Label className="text-xs">Suche (Kunde, Adresse, Anlage, Einsatz-Nr.)</Label>
          <div className="relative mt-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="z. B. Müller, Hauptstr. 5, Anlage 1234, UUID …" className="pl-9" />
          </div>
        </div>
        <div className="md:col-span-3">
          <Label className="text-xs">Von</Label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1" />
        </div>
        <div className="md:col-span-3">
          <Label className="text-xs">Bis</Label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1" />
        </div>
        <div className="md:col-span-1">
          <Button type="submit" className="w-full gap-1.5"><Search className="size-4" /></Button>
        </div>
      </form>

      <div className="rounded-xl border border-border bg-card overflow-hidden" style={{ boxShadow: "var(--shadow-card)" }}>
        {!submitted.q && !submitted.from && !submitted.to ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            Suchbegriff eingeben oder Zeitraum wählen, um Einsätze zu finden.
          </div>
        ) : isFetching ? (
          <div className="p-12 text-center text-muted-foreground">Lade…</div>
        ) : einsaetze.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">Keine Einsätze gefunden.</div>
        ) : (
          <div className="divide-y divide-border">
            <div className="px-4 lg:px-5 py-2.5 text-xs text-muted-foreground flex items-center justify-between">
              <span>{einsaetze.length} Einsätze · {grouped.length} Kunden</span>
            </div>
            {grouped.map(([kunde, items]) => (
              <div key={kunde}>
                <div className="px-4 lg:px-5 py-2.5 bg-muted/30 text-sm font-semibold flex items-center justify-between">
                  <span className="truncate">{kunde}</span>
                  <Badge variant="secondary">{items.length}</Badge>
                </div>
                <ul className="divide-y divide-border">
                  {items.map((e) => (
                    <li key={e.id} className="p-4 lg:p-5 hover:bg-muted/30 transition-colors">
                      <div className="flex flex-wrap items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${STATUS_META[e.status]?.cls ?? ""}`}>
                              {STATUS_META[e.status]?.label ?? e.status}
                            </span>
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="size-3" /> {fmt(e.created_at)}
                            </span>
                            <span className="text-[10px] font-mono text-muted-foreground">#{String(e.id).slice(0, 8)}</span>
                          </div>
                          <h3 className="mt-1 font-semibold text-sm truncate">{e.einsatzgrund}</h3>
                          <div className="mt-1 text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-0.5">
                            {e.address && <span>📍 {e.address}</span>}
                            {e.key_number && <span>🔑 {e.key_number}</span>}
                            {e.anlagen_nr && <span>🏷️ {e.anlagen_nr}</span>}
                            {e.teilnehmer_id && <span>#️⃣ {e.teilnehmer_id}</span>}
                          </div>
                          <div className="mt-1.5 text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-0.5">
                            <span>Erstellt: <b className="text-foreground/80">{profiles[e.created_by] ?? "–"}</b></span>
                            {e.assigned_to && <span>Fahrer: <b className="text-foreground/80">{profiles[e.assigned_to] ?? "–"}</b></span>}
                            {e.abgeschlossen_am && <span>Abgeschlossen: {fmt(e.abgeschlossen_am)}</span>}
                          </div>
                        </div>
                        <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => setHistoryFor(e)}>
                          <HistoryIcon className="size-4" /> Verlauf
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>

      <HistorieDialog einsatz={historyFor} onClose={() => setHistoryFor(null)} />
    </div>
  );
}

function HistorieDialog({ einsatz, onClose }: { einsatz: any | null; onClose: () => void }) {
  const fn = useServerFn(listEinsatzHistorie);
  const { data, isLoading } = useQuery({
    queryKey: ["einsatz-historie", einsatz?.id],
    queryFn: () => fn({ data: { einsatz_id: einsatz!.id } }),
    enabled: !!einsatz,
  });
  const entries = data?.entries ?? [];
  return (
    <Dialog open={!!einsatz} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Verlauf</DialogTitle>
          <DialogDescription>{einsatz?.einsatzgrund}</DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <div className="p-6 text-center text-sm text-muted-foreground">Lade…</div>
        ) : entries.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">Keine Einträge.</div>
        ) : (
          <ul className="max-h-[60vh] overflow-y-auto divide-y divide-border">
            {entries.map((e: any) => (
              <li key={e.id} className="py-2 text-sm">
                <div className="text-xs text-muted-foreground">{fmt(e.changed_at)} · {e.changed_by_name ?? "–"}</div>
                <div className="mt-0.5"><b>{e.field_name}</b>: {e.old_value ?? "–"} → {e.new_value ?? "–"}</div>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
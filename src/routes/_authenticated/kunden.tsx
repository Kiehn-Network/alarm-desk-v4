import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Search, Clock, Users, History as HistoryIcon, Info, Pencil, FileText, Loader2, Boxes } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { searchKundenEinsaetze, listEinsatzHistorie } from "@/lib/einsaetze.functions";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { DateiEditDialog, type DateiLike } from "@/components/datei-edit-dialog";
import { listBestandForKunde } from "@/lib/schluesselbestand.functions";

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
  const [infoFor, setInfoFor] = useState<any | null>(null);
  const [editKundeFor, setEditKundeFor] = useState<any | null>(null);
  const [editDatei, setEditDatei] = useState<DateiLike | null>(null);

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
                        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setInfoFor(e)}>
                          <Info className="size-4" /> Info
                        </Button>
                        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setEditKundeFor(e)}>
                          <Pencil className="size-4" /> Bearbeiten
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
      <InfoDialog einsatz={infoFor} profiles={profiles} onClose={() => setInfoFor(null)} />
      <KundeDateienDialog
        einsatz={editKundeFor}
        onClose={() => setEditKundeFor(null)}
        onPick={(d) => { setEditKundeFor(null); setEditDatei(d); }}
      />
      {editDatei && (
        <DateiEditDialog datei={editDatei} onClose={() => setEditDatei(null)} />
      )}
    </div>
  );
}

function KundeDateienDialog({
  einsatz, onClose, onPick,
}: { einsatz: any | null; onClose: () => void; onPick: (d: DateiLike) => void }) {
  const loadBestand = useServerFn(listBestandForKunde);
  const { data, isLoading } = useQuery({
    queryKey: ["kunde-dateien", einsatz?.id],
    enabled: !!einsatz,
    queryFn: async () => {
      const name = (einsatz!.kunden_name ?? "").trim();
      const key = (einsatz!.key_number ?? "").trim();
      let q = supabase.from("dateien").select("*").is("deleted_at", null).limit(100);
      const ors: string[] = [];
      if (name) ors.push(`kunden_name.ilike.%${name}%`);
      if (key) ors.push(`key_number.eq.${key}`);
      if (ors.length === 0) return [];
      q = q.or(ors.join(","));
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return (data ?? []) as DateiLike[];
    },
  });

  const { data: bestandData, isLoading: bestandLoading } = useQuery({
    queryKey: ["kunde-bestand", einsatz?.id],
    enabled: !!einsatz,
    queryFn: () => loadBestand({ data: {
      kunden_name: einsatz!.kunden_name ?? null,
      key_number: einsatz!.key_number ?? null,
      address: einsatz!.address ?? null,
    }}),
  });

  if (!einsatz) return null;
  const dateien = data ?? [];
  const bestand: any[] = bestandData?.rows ?? [];


  return (
    <Dialog open={!!einsatz} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="size-4 text-primary" /> Kunden-Einstellungen
          </DialogTitle>
          <DialogDescription>
            {einsatz.kunden_name || "(ohne Kunde)"} · Datei wählen, um zu bearbeiten
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md border border-border">
          <div className="px-3 py-2 border-b border-border flex items-center gap-2 text-sm font-medium">
            <Boxes className="size-4 text-primary" /> Schlüsselbestand
            {bestandLoading && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
          </div>
          {!bestandLoading && bestand.length === 0 ? (
            <div className="px-3 py-3 text-xs text-muted-foreground">
              Kein Bestandseintrag zu diesem Kunden hinterlegt.
            </div>
          ) : (
            <ul className="divide-y divide-border max-h-48 overflow-y-auto">
              {bestand.map((b) => (
                <li key={b.id} className="px-3 py-2 text-sm">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">🔑 {b.key_number}</span>
                    {b.bezeichnung && <span className="text-muted-foreground">{b.bezeichnung}</span>}
                    <Badge variant="outline" className="text-[11px]">Depot {b.im_depot}/{b.anzahl_soll}</Badge>
                    {b.draussen > 0 && (
                      <Badge className="text-[11px] bg-amber-500/15 text-amber-500 border border-amber-500/30">
                        {b.draussen} unterwegs
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {[b.objekt, b.address, b.schrank && `Schrank ${b.schrank}`, b.fach && `Fach ${b.fach}`]
                      .filter(Boolean).join(" · ") || "—"}
                    {b.traeger?.length ? ` · bei: ${b.traeger.join(", ")}` : ""}
                  </div>
                  {b.warnungen?.length > 0 && (
                    <div className="text-xs text-red-500 mt-0.5">⚠ {b.warnungen.join(" · ")}</div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>


        {isLoading ? (
          <div className="p-6 text-center"><Loader2 className="size-5 animate-spin mx-auto text-muted-foreground" /></div>
        ) : dateien.length === 0 ? (
          <div className="p-6 text-sm text-center text-muted-foreground">
            Keine passenden Datei-Einträge gefunden. Lege in der Datei-Verwaltung einen Eintrag mit diesem Kundennamen oder dieser Schlüssel-Nr. an.
          </div>
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border max-h-[60vh] overflow-y-auto">
            {dateien.map((d) => (
              <li key={d.id}>
                <button
                  className="w-full text-left px-3 py-2.5 hover:bg-muted/50 transition flex items-center gap-3"
                  onClick={() => onPick(d)}
                >
                  <FileText className="size-4 text-primary shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{d.filename}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {[d.kunden_name, d.address, d.key_number && `🔑 ${d.key_number}`]
                        .filter(Boolean).join(" · ") || "—"}
                    </div>
                  </div>
                  <Pencil className="size-4 text-muted-foreground" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-3 py-1.5 border-b border-border/50 last:border-0 text-sm">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="col-span-2 break-words">{value ?? "–"}</div>
    </div>
  );
}

function InfoDialog({ einsatz, profiles, onClose }: { einsatz: any | null; profiles: Record<string, string>; onClose: () => void }) {
  if (!einsatz) return null;
  const e = einsatz;
  const bericht = e.bericht_data ?? null;
  return (
    <Dialog open={!!einsatz} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Info className="size-4 text-primary" /> Einsatz-Details
          </DialogTitle>
          <DialogDescription>
            <span className="font-mono text-xs">#{String(e.id).slice(0, 8)}</span> · {e.einsatzgrund}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <section>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Kunde</h4>
            <Row label="Name" value={e.kunden_name} />
            <Row label="Adresse" value={e.address} />
            <Row label="Schlüssel-Nr." value={e.key_number} />
            <Row label="Anlagen-Nr." value={e.anlagen_nr} />
            <Row label="Teilnehmer-ID" value={e.teilnehmer_id} />
            <Row label="E-Mail" value={e.kunden_email} />
          </section>

          <section>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Status & Beteiligte</h4>
            <Row label="Status" value={STATUS_META[e.status]?.label ?? e.status} />
            <Row label="Priorität" value={e.prioritaet} />
            <Row label="Erstellt" value={`${fmt(e.created_at)} · ${profiles[e.created_by] ?? "–"}`} />
            <Row label="Fahrer" value={e.assigned_to ? `${profiles[e.assigned_to] ?? "–"} · zugewiesen ${fmt(e.assigned_at)}` : "–"} />
            {e.approved_by && <Row label="Freigegeben" value={`${fmt(e.approved_at)} · ${profiles[e.approved_by] ?? "–"}`} />}
            {e.ablehnung_grund && <Row label="Ablehnungsgrund" value={e.ablehnung_grund} />}
          </section>

          <section>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Zeiten</h4>
            <Row label="Geplant" value={e.geplant_am ? fmt(e.geplant_am) : "–"} />
            <Row label="Vor Ort" value={fmt(e.vor_ort_am)} />
            <Row label="Abfahrt" value={fmt(e.abfahrt_am)} />
            <Row label="Einsatz-Ende" value={fmt(e.einsatz_ende_am)} />
            <Row label="Abgeschlossen" value={fmt(e.abgeschlossen_am)} />
          </section>

          {e.beschreibung && (
            <section>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Beschreibung</h4>
              <p className="text-sm whitespace-pre-wrap rounded-md border border-border bg-muted/30 p-3">{e.beschreibung}</p>
            </section>
          )}

          {e.status === "storniert" && (
            <section className="rounded-md border border-red-500/30 bg-red-500/5 p-3 text-sm">
              <div className="font-semibold text-red-400 mb-1">Storniert</div>
              <Row label="Am" value={fmt(e.storniert_at)} />
              <Row label="Von" value={profiles[e.storniert_by] ?? "–"} />
              {e.storniert_grund && <Row label="Grund" value={e.storniert_grund} />}
            </section>
          )}

          {e.bericht_typ && (
            <section>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                Bericht – {e.bericht_typ === "hausnotruf" ? "Hausnotruf" : "AV-Einsatz"}
              </h4>
              {e.bericht_typ === "hausnotruf" ? (
                <>
                  <Row label="Problem" value={<span className="whitespace-pre-wrap">{e.hausnotruf_problem || "–"}</span>} />
                  <Row label="Lösung" value={<span className="whitespace-pre-wrap">{e.hausnotruf_loesung || "–"}</span>} />
                </>
              ) : bericht && typeof bericht === "object" ? (
                <div className="rounded-md border border-border bg-muted/30 p-3 space-y-1">
                  {Object.entries(bericht).map(([k, v]) => (
                    <Row key={k} label={k} value={
                      typeof v === "boolean" ? (v ? "Ja" : "Nein")
                      : v == null || v === "" ? "–"
                      : typeof v === "object" ? <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(v, null, 2)}</pre>
                      : String(v)
                    } />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Keine Bericht-Daten.</p>
              )}
            </section>
          )}
        </div>
      </DialogContent>
    </Dialog>
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
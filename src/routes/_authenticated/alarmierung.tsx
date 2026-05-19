import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  History as HistoryIcon, Plus, Search, Ban, Clock, Flag, CheckSquare,
  ClipboardList, Mail,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useRole } from "@/hooks/use-role";
import { useDomainModules } from "@/hooks/use-domain-modules";
import {
  listEinsaetze, abschliessenEinsatz, listEinsatzHistorie, stornierenEinsatz,
} from "@/lib/einsaetze.functions";
import { EinsatzBerichtDialog } from "@/components/einsatz-bericht-dialog";
import { BerichtSendDialog } from "@/components/bericht-send-dialog";

export const Route = createFileRoute("/_authenticated/alarmierung")({
  component: AlarmierungPage,
});

type Einsatz = any;

const STATUS_META: Record<string, { label: string; cls: string }> = {
  in_bearbeitung: { label: "Läuft",         cls: "bg-blue-500/15 text-blue-400 border border-blue-500/30" },
  abgeschlossen:  { label: "Abgeschlossen", cls: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30" },
  storniert:      { label: "Storniert",     cls: "bg-red-500/15 text-red-400 border border-red-500/30" },
  // Legacy-Status (alte Datensätze)
  entwurf:        { label: "Entwurf",       cls: "bg-muted text-muted-foreground" },
  wartet_freigabe:{ label: "Offen",         cls: "bg-amber-500/15 text-amber-400 border border-amber-500/30" },
  freigegeben:    { label: "Freigegeben",   cls: "bg-cyan-500/15 text-cyan-400 border border-cyan-500/30" },
  abgelehnt:      { label: "Abgelehnt",     cls: "bg-red-500/15 text-red-400 border border-red-500/30" },
};

function fmt(d?: string | null) {
  if (!d) return "–";
  return new Date(d).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function AlarmierungPage() {
  const { canManage } = useRole();
  const { data: modules } = useDomainModules();
  const hausnotrufEnabled = modules?.has("hausnotruf") ?? false;
  const list = useServerFn(listEinsaetze);
  const abschliessen = useServerFn(abschliessenEinsatz);
  const stornieren = useServerFn(stornierenEinsatz);
  const { data, refetch, isLoading } = useQuery({ queryKey: ["einsaetze"], queryFn: () => list() });

  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<string>("aktiv");
  const [typFilter, setTypFilter] = useState<string>("alle");
  const [history, setHistory] = useState<Einsatz | null>(null);
  const [berichtFor, setBerichtFor] = useState<Einsatz | null>(null);
  const [sendFor, setSendFor] = useState<Einsatz | null>(null);
  const [stornoFor, setStornoFor] = useState<Einsatz | null>(null);
  const [stornoGrund, setStornoGrund] = useState("");
  const [stornoBusy, setStornoBusy] = useState(false);

  const einsaetze: Einsatz[] = data?.einsaetze ?? [];
  const profiles: Record<string, string> = data?.profiles ?? {};

  const isAktiv = (e: Einsatz) => ["in_bearbeitung", "freigegeben", "wartet_freigabe", "entwurf"].includes(e.status);
  const isErledigt = (e: Einsatz) => ["abgeschlossen", "abgelehnt", "storniert"].includes(e.status);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = einsaetze.filter((e) => {
      if (tab === "aktiv" && !isAktiv(e)) return false;
      if (tab === "erledigt" && !isErledigt(e)) return false;
      if (hausnotrufEnabled && typFilter !== "alle" && (e.einsatz_typ ?? "av_einsatz") !== typFilter) return false;
      if (!q) return true;
      return [e.einsatzgrund, e.kunden_name, e.address, e.key_number, e.anlagen_nr, e.teilnehmer_id]
        .filter(Boolean).join(" ").toLowerCase().includes(q);
    });
    // Sort: Hausnotruf zuerst, dann AV-Einsatz, innerhalb nach created_at desc
    if (hausnotrufEnabled) {
      const rank = (t: string) => (t === "hausnotruf" ? 0 : 1);
      list.sort((a, b) => {
        const r = rank(a.einsatz_typ ?? "av_einsatz") - rank(b.einsatz_typ ?? "av_einsatz");
        if (r !== 0) return r;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
    }
    return list;
  }, [einsaetze, search, tab, typFilter, hausnotrufEnabled]);

  const counts = useMemo(() => ({
    aktiv: einsaetze.filter(isAktiv).length,
    erledigt: einsaetze.filter(isErledigt).length,
  }), [einsaetze]);

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Alarmierung</h1>
          <p className="text-sm text-muted-foreground mt-1">Laufende und abgeschlossene Einsätze.</p>
        </div>
        {canManage && (
          <Link to="/einsatz-erstellen">
            <Button className="gap-2"><Plus className="size-4" /> Neuer Einsatz</Button>
          </Link>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[260px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Suche Kunde, Adresse, Grund..." className="pl-9" />
        </div>
        {hausnotrufEnabled && (
          <Tabs value={typFilter} onValueChange={setTypFilter}>
            <TabsList>
              <TabsTrigger value="alle">Alle Typen</TabsTrigger>
              <TabsTrigger value="hausnotruf">Hausnotruf</TabsTrigger>
              <TabsTrigger value="av_einsatz">AV-Einsatz</TabsTrigger>
            </TabsList>
            <TabsContent value={typFilter} />
          </Tabs>
        )}
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="aktiv" className="gap-2">Aktiv <Badge variant="secondary" className="ml-1">{counts.aktiv}</Badge></TabsTrigger>
            <TabsTrigger value="erledigt" className="gap-2">Erledigt <Badge variant="secondary" className="ml-1">{counts.erledigt}</Badge></TabsTrigger>
            <TabsTrigger value="alle">Alle</TabsTrigger>
          </TabsList>
          <TabsContent value={tab} />
        </Tabs>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden" style={{ boxShadow: "var(--shadow-card)" }}>
        {isLoading ? (
          <div className="p-12 text-center text-muted-foreground">Lade Einsätze...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <div className="mx-auto size-12 rounded-full bg-muted grid place-items-center">
              <Flag className="size-5 text-muted-foreground" />
            </div>
            <p className="mt-3 text-sm text-muted-foreground">Keine Einsätze in dieser Ansicht.</p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map((e) => (
              <li key={e.id} className="p-4 lg:p-5 hover:bg-muted/30 transition-colors">
                <div className="flex flex-wrap items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${STATUS_META[e.status]?.cls ?? ""}`}>
                        {STATUS_META[e.status]?.label ?? e.status}
                      </span>
                      {hausnotrufEnabled && (
                        <span className={`text-xs px-2 py-0.5 rounded-md font-medium border ${
                          (e.einsatz_typ ?? "av_einsatz") === "hausnotruf"
                            ? "bg-fuchsia-500/15 text-fuchsia-400 border-fuchsia-500/30"
                            : "bg-slate-500/15 text-slate-300 border-slate-500/30"
                        }`}>
                          {(e.einsatz_typ ?? "av_einsatz") === "hausnotruf" ? "Hausnotruf" : "AV-Einsatz"}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="size-3" /> {fmt(e.created_at)}
                      </span>
                    </div>
                    <h3 className="mt-1.5 font-semibold text-base truncate">{e.einsatzgrund}</h3>
                    <div className="mt-1 text-sm text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
                      {e.kunden_name && <span>👤 {e.kunden_name}</span>}
                      {e.address && <span>📍 {e.address}</span>}
                      {e.key_number && <span>🔑 {e.key_number}</span>}
                      {e.anlagen_nr && <span>🏷️ {e.anlagen_nr}</span>}
                      {e.teilnehmer_id && <span>#️⃣ {e.teilnehmer_id}</span>}
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
                      <span>Erstellt von <b className="text-foreground/80">{profiles[e.created_by] ?? "–"}</b></span>
                      {e.assigned_to && <span>Fahrer: <b className="text-foreground/80">{profiles[e.assigned_to] ?? "–"}</b></span>}
                      {e.abgeschlossen_am && <span>Abgeschlossen: {fmt(e.abgeschlossen_am)}</span>}
                    </div>
                    {(e.vor_ort_am || e.abfahrt_am || e.einsatz_ende_am) && (
                      <div className="mt-2 text-xs flex flex-wrap gap-x-4 gap-y-1">
                        {e.vor_ort_am && <span>📍 Vor Ort: <b className="text-foreground/80">{fmt(e.vor_ort_am)}</b></span>}
                        {e.abfahrt_am && <span>🚗 Abfahrt: <b className="text-foreground/80">{fmt(e.abfahrt_am)}</b></span>}
                        {e.einsatz_ende_am && <span>🏁 Ende: <b className="text-foreground/80">{fmt(e.einsatz_ende_am)}</b></span>}
                      </div>
                    )}
                    {e.status === "storniert" && (
                      <div className="mt-2 text-xs rounded-md border border-red-500/30 bg-red-500/5 p-2">
                        <div className="font-medium text-red-400">
                          Storniert am {fmt(e.storniert_at)} · von {profiles[e.storniert_by] ?? "–"}
                        </div>
                        {e.storniert_grund && (
                          <div className="mt-0.5 text-foreground/80 whitespace-pre-wrap">Grund: {e.storniert_grund}</div>
                        )}
                      </div>
                    )}
                    {e.bericht_typ && (
                      <div className="mt-1 text-xs text-muted-foreground">
                        📝 Bericht: <span className="text-foreground/80">{e.bericht_typ === "hausnotruf" ? "Hausnotruf" : "AV-Einsatz"}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => setHistory(e)}>
                      <HistoryIcon className="size-4" /> Verlauf
                    </Button>
                    {canManage && (
                      <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setBerichtFor(e)}>
                        <ClipboardList className="size-4" /> Bericht
                      </Button>
                    )}
                    {canManage && (
                      <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setSendFor(e)}>
                        <Mail className="size-4" /> Senden
                      </Button>
                    )}
                    {canManage && isAktiv(e) && (
                      <Button size="sm" className="gap-1.5"
                        onClick={async () => {
                          try { await abschliessen({ data: { id: e.id } }); toast.success("Abgeschlossen"); refetch(); }
                          catch (err: any) { toast.error(err.message); }
                        }}>
                        <CheckSquare className="size-4" /> Abschließen
                      </Button>
                    )}
                    {canManage && e.status !== "storniert" && e.status !== "abgeschlossen" && (
                      <Button size="sm" variant="ghost" className="gap-1.5 text-red-400 hover:text-red-300"
                        onClick={() => { setStornoFor(e); setStornoGrund(""); }}>
                        <Ban className="size-4" /> Stornieren
                      </Button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <HistoryDialog einsatz={history} onClose={() => setHistory(null)} />
      <EinsatzBerichtDialog
        einsatz={berichtFor}
        open={!!berichtFor}
        onClose={() => setBerichtFor(null)}
      />
      <BerichtSendDialog
        einsatz={sendFor}
        fahrerName={sendFor?.assigned_to ? profiles[sendFor.assigned_to] ?? null : null}
        open={!!sendFor}
        onClose={() => setSendFor(null)}
      />
      <Dialog open={!!stornoFor} onOpenChange={(o) => { if (!o) { setStornoFor(null); setStornoGrund(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Einsatz stornieren</DialogTitle>
            <DialogDescription>
              Der Einsatz wird mit Zeitstempel und deinem Namen als storniert markiert.
              Ein Grund ist erforderlich.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Grund</Label>
            <Textarea
              value={stornoGrund}
              onChange={(e) => setStornoGrund(e.target.value)}
              rows={4}
              maxLength={1000}
              placeholder="Warum wird storniert?"
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => { setStornoFor(null); setStornoGrund(""); }}>
              Abbrechen
            </Button>
            <Button
              variant="destructive"
              disabled={stornoBusy || stornoGrund.trim().length === 0}
              onClick={async () => {
                if (!stornoFor) return;
                setStornoBusy(true);
                try {
                  await stornieren({ data: { id: stornoFor.id, grund: stornoGrund.trim() } });
                  toast.success("Einsatz storniert");
                  setStornoFor(null); setStornoGrund("");
                  refetch();
                } catch (err: any) {
                  toast.error(err.message ?? "Fehler");
                } finally { setStornoBusy(false); }
              }}
            >
              <Ban className="size-4 mr-1.5" /> Stornieren
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const FIELD_LABELS: Record<string, string> = {
  status: "Status", einsatzgrund: "Einsatzgrund", kunden_name: "Kunde",
  address: "Adresse", key_number: "Schlüssel-Nr.", anlagen_nr: "Anlagen-Nr.",
  teilnehmer_id: "Teilnehmer-ID", beschreibung: "Beschreibung",
  assigned_to: "Fahrer", abgeschlossen_am: "Abgeschlossen am",
  vor_ort_am: "Vor Ort", abfahrt_am: "Abfahrt", einsatz_ende_am: "Einsatz Ende",
  bericht: "Bericht", bericht_typ: "Berichtstyp",
  hausnotruf_problem: "Hausnotruf-Problem", hausnotruf_loesung: "Hausnotruf-Lösung",
};

function HistoryDialog({ einsatz, onClose }: { einsatz: Einsatz | null; onClose: () => void }) {
  const list = useServerFn(listEinsatzHistorie);
  const { data } = useQuery({
    queryKey: ["einsatz-historie", einsatz?.id],
    queryFn: () => list({ data: { einsatz_id: einsatz!.id } }),
    enabled: !!einsatz,
  });
  const entries = (data?.entries ?? []) as any[];
  return (
    <Dialog open={!!einsatz} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Änderungs-Verlauf</DialogTitle>
          <DialogDescription>Alle Änderungen an diesem Einsatz.</DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto space-y-2">
          {entries.length === 0 ? (
            <p className="text-sm text-muted-foreground p-4 text-center">Noch keine Einträge.</p>
          ) : entries.map((e) => (
            <div key={e.id} className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{FIELD_LABELS[e.field_name] ?? e.field_name}</span>
                <span className="text-xs text-muted-foreground">{fmt(e.changed_at)} · {e.changed_by_name ?? "—"}</span>
              </div>
              <div className="mt-1 grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                <div className="rounded bg-red-500/10 text-red-300 px-2 py-1">
                  <span className="opacity-60">Alt: </span>{e.old_value ?? <i className="opacity-50">leer</i>}
                </div>
                <div className="rounded bg-emerald-500/10 text-emerald-300 px-2 py-1">
                  <span className="opacity-60">Neu: </span>{e.new_value ?? <i className="opacity-50">leer</i>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

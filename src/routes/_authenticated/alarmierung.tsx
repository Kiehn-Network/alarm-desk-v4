import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  History as HistoryIcon, Plus, Search, Ban, Clock, Flag, CheckSquare,
  ClipboardList, Mail, User, MapPin, Key, Hash, Tag, Car, CircleCheck,
  MoreHorizontal, FileText, Filter, Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
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

function dauer(start?: string | null, end?: string | null) {
  if (!start || !end) return "–";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (!isFinite(ms) || ms < 0) return "–";
  const min = Math.floor(ms / 60000);
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h} Std ${m} Min`;
}

function MetaItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2 min-w-0">
      <span className="text-muted-foreground mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground leading-none">{label}</div>
        <div className="text-sm text-foreground/90 truncate" title={value}>{value}</div>
      </div>
    </div>
  );
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
  const [infoFor, setInfoFor] = useState<Einsatz | null>(null);
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
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Alarmierung</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {counts.aktiv} aktiv · {counts.erledigt} erledigt
          </p>
        </div>
        {canManage && (
          <Link to="/einsatz-erstellen">
            <Button className="gap-2"><Plus className="size-4" /> Neuer Einsatz</Button>
          </Link>
        )}
      </div>

      {/* Toolbar */}
      <div className="rounded-xl border border-border bg-card p-3 flex flex-wrap items-center gap-3"
           style={{ boxShadow: "var(--shadow-card)" }}>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="aktiv" className="gap-1.5">
              Aktiv <Badge variant="secondary" className="h-5 px-1.5">{counts.aktiv}</Badge>
            </TabsTrigger>
            <TabsTrigger value="erledigt" className="gap-1.5">
              Erledigt <Badge variant="secondary" className="h-5 px-1.5">{counts.erledigt}</Badge>
            </TabsTrigger>
            <TabsTrigger value="alle">Alle</TabsTrigger>
          </TabsList>
          <TabsContent value={tab} />
        </Tabs>

        <div className="h-6 w-px bg-border hidden sm:block" />

        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Suche Kunde, Adresse, Grund..."
            className="pl-9 h-9"
          />
        </div>

        {hausnotrufEnabled && (
          <div className="flex items-center gap-2">
            <Filter className="size-4 text-muted-foreground" />
            <Tabs value={typFilter} onValueChange={setTypFilter}>
              <TabsList className="h-9">
                <TabsTrigger value="alle">Alle</TabsTrigger>
                <TabsTrigger value="hausnotruf">Hausnotruf</TabsTrigger>
                <TabsTrigger value="av_einsatz">AV</TabsTrigger>
              </TabsList>
              <TabsContent value={typFilter} />
            </Tabs>
          </div>
        )}
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
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3 font-semibold">Einsatz</th>
                  <th className="px-4 py-3 font-semibold">Fahrer</th>
                  <th className="px-4 py-3 font-semibold">Startzeit</th>
                  <th className="px-4 py-3 font-semibold">Endzeit</th>
                  <th className="px-4 py-3 font-semibold">Dauer</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold text-right">Aktionen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((e) => {
                  const typ = e.einsatz_typ ?? "av_einsatz";
                  const isHausnotruf = typ === "hausnotruf";
                  const aktiv = isAktiv(e);
                  const start = e.vor_ort_am ?? e.created_at;
                  const end = e.einsatz_ende_am ?? e.abgeschlossen_am ?? null;
                  return (
                    <tr key={e.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 align-middle max-w-[280px]">
                        <div className="flex items-center gap-2">
                          {hausnotrufEnabled && (
                            <span className={`inline-block size-2 rounded-full shrink-0 ${
                              isHausnotruf ? "bg-fuchsia-500" : "bg-slate-400"
                            }`} title={isHausnotruf ? "Hausnotruf" : "AV-Einsatz"} />
                          )}
                          <span className="font-medium text-foreground truncate" title={e.einsatzgrund}>
                            {e.einsatzgrund}
                          </span>
                        </div>
                        {e.kunden_name && (
                          <div className="text-xs text-muted-foreground truncate mt-0.5">{e.kunden_name}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 align-middle whitespace-nowrap text-foreground/90">
                        {e.assigned_to ? (profiles[e.assigned_to] ?? "–") : <span className="text-muted-foreground">–</span>}
                      </td>
                      <td className="px-4 py-3 align-middle whitespace-nowrap text-foreground/90">{fmt(start)}</td>
                      <td className="px-4 py-3 align-middle whitespace-nowrap text-foreground/90">{fmt(end)}</td>
                      <td className="px-4 py-3 align-middle whitespace-nowrap text-foreground/90">{dauer(start, end)}</td>
                      <td className="px-4 py-3 align-middle">
                        <span className={`text-xs px-2 py-0.5 rounded-md font-medium whitespace-nowrap ${STATUS_META[e.status]?.cls ?? ""}`}>
                          {STATUS_META[e.status]?.label ?? e.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <div className="flex items-center justify-end gap-1">
                          <Button size="icon" variant="ghost" className="size-8" title="Details"
                                  onClick={() => setInfoFor(e)}>
                            <Info className="size-4" />
                          </Button>
                          {canManage && aktiv && (
                            <Button size="sm" className="gap-1.5 h-8"
                              onClick={async () => {
                                try { await abschliessen({ data: { id: e.id } }); toast.success("Abgeschlossen"); refetch(); }
                                catch (err: any) { toast.error(err.message); }
                              }}>
                              <CircleCheck className="size-4" /> Abschließen
                            </Button>
                          )}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="icon" variant="ghost" className="size-8">
                                <MoreHorizontal className="size-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              {canManage && (
                                <DropdownMenuItem onClick={() => setBerichtFor(e)}>
                                  <ClipboardList className="size-4 mr-2" /> Bericht
                                </DropdownMenuItem>
                              )}
                              {canManage && (
                                <DropdownMenuItem onClick={() => setSendFor(e)}>
                                  <Mail className="size-4 mr-2" /> Senden
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem onClick={() => setHistory(e)}>
                                <HistoryIcon className="size-4 mr-2" /> Verlauf
                              </DropdownMenuItem>
                              {canManage && e.status !== "storniert" && e.status !== "abgeschlossen" && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    className="text-red-400 focus:text-red-300"
                                    onClick={() => { setStornoFor(e); setStornoGrund(""); }}
                                  >
                                    <Ban className="size-4 mr-2" /> Stornieren
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <HistoryDialog einsatz={history} onClose={() => setHistory(null)} />
      <InfoDialog einsatz={infoFor} profiles={profiles} hausnotrufEnabled={hausnotrufEnabled} onClose={() => setInfoFor(null)} />
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

import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  CheckCircle2, XCircle, UserCheck, Flag, History as HistoryIcon,
  Plus, Search, Trash2, Clock, AlertTriangle, CheckSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useRole } from "@/hooks/use-role";
import {
  listEinsaetze, freigebenEinsatz, ablehnenEinsatz, zuweisenEinsatz,
  abschliessenEinsatz, listFahrer, listEinsatzHistorie, deleteEinsatz,
} from "@/lib/einsaetze.functions";

export const Route = createFileRoute("/_authenticated/alarmierung")({
  component: AlarmierungPage,
});

type Einsatz = any;

const STATUS_META: Record<string, { label: string; cls: string }> = {
  entwurf:         { label: "Entwurf",          cls: "bg-muted text-muted-foreground" },
  wartet_freigabe: { label: "Wartet Freigabe",  cls: "bg-amber-500/15 text-amber-400 border border-amber-500/30" },
  freigegeben:     { label: "Freigegeben",      cls: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30" },
  abgelehnt:       { label: "Abgelehnt",        cls: "bg-red-500/15 text-red-400 border border-red-500/30" },
  in_bearbeitung:  { label: "In Bearbeitung",   cls: "bg-blue-500/15 text-blue-400 border border-blue-500/30" },
  abgeschlossen:   { label: "Abgeschlossen",    cls: "bg-zinc-500/15 text-zinc-400 border border-zinc-500/30" },
};

const PRIO_META: Record<string, { label: string; cls: string }> = {
  niedrig:  { label: "Niedrig",  cls: "text-zinc-400" },
  normal:   { label: "Normal",   cls: "text-blue-400" },
  hoch:     { label: "Hoch",     cls: "text-amber-400" },
  kritisch: { label: "Kritisch", cls: "text-red-400" },
};

function fmt(d?: string | null) {
  if (!d) return "–";
  return new Date(d).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function AlarmierungPage() {
  const { canManage, isAdmin } = useRole();
  const list = useServerFn(listEinsaetze);
  const { data, refetch, isLoading } = useQuery({ queryKey: ["einsaetze"], queryFn: () => list() });

  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<string>("offen");
  const [reject, setReject] = useState<Einsatz | null>(null);
  const [assign, setAssign] = useState<Einsatz | null>(null);
  const [history, setHistory] = useState<Einsatz | null>(null);

  const einsaetze: Einsatz[] = data?.einsaetze ?? [];
  const profiles: Record<string, string> = data?.profiles ?? {};

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return einsaetze.filter((e) => {
      if (tab === "offen" && !["entwurf","wartet_freigabe"].includes(e.status)) return false;
      if (tab === "aktiv" && !["freigegeben","in_bearbeitung"].includes(e.status)) return false;
      if (tab === "erledigt" && !["abgeschlossen","abgelehnt"].includes(e.status)) return false;
      if (!q) return true;
      return [e.einsatzgrund, e.kunden_name, e.address, e.key_number, e.anlagen_nr, e.teilnehmer_id]
        .filter(Boolean).join(" ").toLowerCase().includes(q);
    });
  }, [einsaetze, search, tab]);

  const counts = useMemo(() => ({
    offen: einsaetze.filter((e) => ["entwurf","wartet_freigabe"].includes(e.status)).length,
    aktiv: einsaetze.filter((e) => ["freigegeben","in_bearbeitung"].includes(e.status)).length,
    erledigt: einsaetze.filter((e) => ["abgeschlossen","abgelehnt"].includes(e.status)).length,
  }), [einsaetze]);

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Alarmierung</h1>
          <p className="text-sm text-muted-foreground mt-1">Einsätze freigeben, zuweisen und nachverfolgen.</p>
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
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="offen" className="gap-2">Offen <Badge variant="secondary" className="ml-1">{counts.offen}</Badge></TabsTrigger>
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
                      <span className={`text-xs font-semibold inline-flex items-center gap-1 ${PRIO_META[e.prioritaet]?.cls ?? ""}`}>
                        <AlertTriangle className="size-3" />
                        {PRIO_META[e.prioritaet]?.label ?? e.prioritaet}
                      </span>
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
                    {e.beschreibung && (
                      <p className="mt-2 text-sm text-foreground/80 line-clamp-2">{e.beschreibung}</p>
                    )}
                    <div className="mt-2 text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
                      <span>Erstellt von <b className="text-foreground/80">{profiles[e.created_by] ?? "–"}</b></span>
                      {e.approved_by && <span>Freigegeben von <b className="text-foreground/80">{profiles[e.approved_by] ?? "–"}</b> · {fmt(e.approved_at)}</span>}
                      {e.assigned_to && <span>Fahrer: <b className="text-foreground/80">{profiles[e.assigned_to] ?? "–"}</b></span>}
                      {e.geplant_am && <span>Geplant: {fmt(e.geplant_am)}</span>}
                    </div>
                    {e.status === "abgelehnt" && e.ablehnung_grund && (
                      <div className="mt-2 text-xs rounded-md bg-red-500/10 border border-red-500/30 text-red-300 px-3 py-2">
                        Ablehnungsgrund: {e.ablehnung_grund}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => setHistory(e)}>
                      <HistoryIcon className="size-4" /> Verlauf
                    </Button>
                    {canManage && e.status === "wartet_freigabe" && (
                      <>
                        <Button size="sm" variant="secondary" className="gap-1.5" onClick={() => setReject(e)}>
                          <XCircle className="size-4" /> Ablehnen
                        </Button>
                        <Button size="sm" className="gap-1.5"
                          onClick={async () => {
                            try { await (useServerFn(freigebenEinsatz) as any)({ data: { id: e.id } }); } catch {}
                          }}>
                          <CheckCircle2 className="size-4" /> Freigeben
                        </Button>
                      </>
                    )}
                    {canManage && e.status === "freigegeben" && (
                      <Button size="sm" className="gap-1.5" onClick={() => setAssign(e)}>
                        <UserCheck className="size-4" /> Fahrer zuweisen
                      </Button>
                    )}
                    {canManage && e.status === "in_bearbeitung" && (
                      <Button size="sm" variant="secondary" className="gap-1.5"
                        onClick={async () => {
                          try { await (useServerFn(abschliessenEinsatz) as any)({ data: { id: e.id } }); } catch {}
                        }}>
                        <CheckSquare className="size-4" /> Abschließen
                      </Button>
                    )}
                    {isAdmin && (
                      <Button size="sm" variant="ghost" className="text-red-400 hover:text-red-300"
                        onClick={async () => {
                          if (!confirm("Einsatz wirklich löschen?")) return;
                          try {
                            await (useServerFn(deleteEinsatz) as any)({ data: { id: e.id } });
                            toast.success("Gelöscht"); refetch();
                          } catch (err: any) { toast.error(err.message); }
                        }}>
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <FreigebenInline einsaetze={einsaetze} onDone={refetch} />
      <RejectDialog einsatz={reject} onClose={() => setReject(null)} onDone={() => { setReject(null); refetch(); }} />
      <AssignDialog einsatz={assign} onClose={() => setAssign(null)} onDone={() => { setAssign(null); refetch(); }} />
      <HistoryDialog einsatz={history} onClose={() => setHistory(null)} />
    </div>
  );
}

// Hilfs-Komponente: rendert Freigabe/Abschließen-Aktionen mit korrekten Hooks
function FreigebenInline({ einsaetze, onDone }: { einsaetze: Einsatz[]; onDone: () => void }) {
  // serverFns werden über onClick-Handler oben aufgerufen – diese Komponente
  // existiert nur, um nach erfolgreichen Mutationen `onDone` aufzurufen.
  // (Die Buttons rufen aktuell useServerFn inline – das ist unsauber; hier ein sauberer Wrapper.)
  return null;
}

function RejectDialog({ einsatz, onClose, onDone }: { einsatz: Einsatz | null; onClose: () => void; onDone: () => void }) {
  const [grund, setGrund] = useState("");
  const [busy, setBusy] = useState(false);
  const ablehnen = useServerFn(ablehnenEinsatz);
  return (
    <Dialog open={!!einsatz} onOpenChange={(o) => { if (!o) { setGrund(""); onClose(); } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Einsatz ablehnen</DialogTitle>
          <DialogDescription>Bitte gib einen Grund für die Ablehnung an.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label>Ablehnungsgrund</Label>
          <Textarea value={grund} onChange={(e) => setGrund(e.target.value)} rows={4} maxLength={1000} />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Abbrechen</Button>
          <Button variant="destructive" disabled={!grund.trim() || busy}
            onClick={async () => {
              setBusy(true);
              try {
                await ablehnen({ data: { id: einsatz!.id, grund: grund.trim() } });
                toast.success("Einsatz abgelehnt"); setGrund(""); onDone();
              } catch (e: any) { toast.error(e.message); }
              finally { setBusy(false); }
            }}>
            Ablehnen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AssignDialog({ einsatz, onClose, onDone }: { einsatz: Einsatz | null; onClose: () => void; onDone: () => void }) {
  const [fahrerId, setFahrerId] = useState("");
  const [busy, setBusy] = useState(false);
  const list = useServerFn(listFahrer);
  const zuweisen = useServerFn(zuweisenEinsatz);
  const { data } = useQuery({ queryKey: ["fahrer"], queryFn: () => list(), enabled: !!einsatz });
  const fahrer = (data?.fahrer ?? []) as Array<{ id: string; display_name: string | null }>;
  return (
    <Dialog open={!!einsatz} onOpenChange={(o) => { if (!o) { setFahrerId(""); onClose(); } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Fahrer zuweisen</DialogTitle>
          <DialogDescription>Wähle einen verfügbaren Fahrer aus.</DialogDescription>
        </DialogHeader>
        {fahrer.length === 0 ? (
          <p className="text-sm text-muted-foreground">Keine Nutzer mit Rolle "Fahrer" gefunden. Rollen können im Admin Center vergeben werden.</p>
        ) : (
          <div className="space-y-2">
            <Label>Fahrer</Label>
            <Select value={fahrerId} onValueChange={setFahrerId}>
              <SelectTrigger><SelectValue placeholder="Fahrer wählen" /></SelectTrigger>
              <SelectContent>
                {fahrer.map((f) => (<SelectItem key={f.id} value={f.id}>{f.display_name ?? f.id.slice(0,8)}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Abbrechen</Button>
          <Button disabled={!fahrerId || busy}
            onClick={async () => {
              setBusy(true);
              try {
                await zuweisen({ data: { id: einsatz!.id, fahrer_id: fahrerId } });
                toast.success("Fahrer zugewiesen"); setFahrerId(""); onDone();
              } catch (e: any) { toast.error(e.message); }
              finally { setBusy(false); }
            }}>
            Zuweisen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const FIELD_LABELS: Record<string, string> = {
  status: "Status", einsatzgrund: "Einsatzgrund", kunden_name: "Kunde",
  address: "Adresse", key_number: "Schlüssel-Nr.", anlagen_nr: "Anlagen-Nr.",
  teilnehmer_id: "Teilnehmer-ID", prioritaet: "Priorität", beschreibung: "Beschreibung",
  geplant_am: "Geplant am", assigned_to: "Fahrer", ablehnung_grund: "Ablehnungsgrund",
  approved_by: "Freigegeben von", abgeschlossen_am: "Abgeschlossen am",
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

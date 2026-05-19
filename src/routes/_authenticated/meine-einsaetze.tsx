import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  Truck, CheckSquare, Clock, MapPin, KeyRound, Hash, User, Phone, Navigation,
  History as HistoryIcon, Flag, FolderOpen, ClipboardList, MapPinned, LogOut, Square, Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { useRole } from "@/hooks/use-role";
import {
  listMeineEinsaetze, abschliessenEinsatz, listEinsatzHistorie, setEinsatzZeit,
} from "@/lib/einsaetze.functions";
import {
  listSchluesselForEinsatz, uebernehmenSchluessel, rueckgabeAnfragen,
} from "@/lib/schluesselbuch.functions";
import { useDomainModules } from "@/hooks/use-domain-modules";
import { HoldButton } from "@/components/hold-button";
import { EinsatzDateienDialog } from "@/components/einsatz-dateien-dialog";
import { EinsatzBerichtDialog } from "@/components/einsatz-bericht-dialog";
import { KundenInfoDialog } from "@/components/kunden-info-dialog";

export const Route = createFileRoute("/_authenticated/meine-einsaetze")({
  component: MeineEinsaetzePage,
});

type Einsatz = any;

const STATUS_META: Record<string, { label: string; cls: string }> = {
  in_bearbeitung: { label: "Aktiv",         cls: "bg-blue-500/15 text-blue-400 border border-blue-500/30" },
  abgeschlossen:  { label: "Abgeschlossen", cls: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30" },
  freigegeben:    { label: "Neu",           cls: "bg-amber-500/15 text-amber-400 border border-amber-500/30" },
  wartet_freigabe:{ label: "Wartend",       cls: "bg-amber-500/15 text-amber-400 border border-amber-500/30" },
  abgelehnt:      { label: "Abgelehnt",     cls: "bg-red-500/15 text-red-400 border border-red-500/30" },
};

function fmt(d?: string | null) {
  if (!d) return "–";
  return new Date(d).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function MeineEinsaetzePage() {
  const { loading: roleLoading, isFahrer, isAdmin } = useRole();
  const { user } = useAuth();
  const qc = useQueryClient();
  const list = useServerFn(listMeineEinsaetze);
  const abschliessen = useServerFn(abschliessenEinsatz);
  const setZeit = useServerFn(setEinsatzZeit);
  const { data: modules } = useDomainModules();
  const schluesselbuchOn = modules?.has("schluesselbuch") ?? false;

  const { data, refetch, isLoading } = useQuery({
    queryKey: ["meine-einsaetze"],
    queryFn: () => list(),
  });

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`einsaetze-fahrer-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "einsaetze", filter: `assigned_to=eq.${user.id}` },
        (payload) => {
          qc.invalidateQueries({ queryKey: ["meine-einsaetze"] });
          if (payload.eventType === "INSERT") {
            const e: any = payload.new;
            toast.success(`Neuer Einsatz: ${e.einsatzgrund}`, {
              description: e.kunden_name ?? e.address ?? undefined,
            });
          }
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, qc]);

  const [tab, setTab] = useState("aktiv");
  const [history, setHistory] = useState<Einsatz | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [dateienFor, setDateienFor] = useState<string | null>(null);
  const [berichtFor, setBerichtFor] = useState<Einsatz | null>(null);
  const [infoFor, setInfoFor] = useState<string | null>(null);

  const einsaetze: Einsatz[] = data?.einsaetze ?? [];
  const profiles: Record<string, string> = data?.profiles ?? {};

  const isAktiv = (e: Einsatz) => ["in_bearbeitung", "freigegeben"].includes(e.status);
  const isErledigt = (e: Einsatz) => ["abgeschlossen", "abgelehnt"].includes(e.status);

  const counts = useMemo(() => ({
    aktiv: einsaetze.filter(isAktiv).length,
    erledigt: einsaetze.filter(isErledigt).length,
  }), [einsaetze]);

  const filtered = useMemo(() => {
    if (tab === "aktiv") return einsaetze.filter(isAktiv);
    if (tab === "erledigt") return einsaetze.filter(isErledigt);
    return einsaetze;
  }, [einsaetze, tab]);

  if (!roleLoading && !isFahrer && !isAdmin) {
    return (
      <div className="p-4 md:p-8 max-w-2xl">
        <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
          Diese Ansicht ist für Fahrer gedacht.
        </div>
      </div>
    );
  }

  async function complete(id: string) {
    setBusy(id);
    try {
      await abschliessen({ data: { id } });
      toast.success("Einsatz abgeschlossen");
      refetch();
    } catch (e: any) {
      toast.error(e.message ?? "Fehler");
    } finally { setBusy(null); }
  }

  async function setTime(id: string, feld: "vor_ort" | "abfahrt" | "ende") {
    try {
      await setZeit({ data: { id, feld } });
      qc.invalidateQueries({ queryKey: ["meine-einsaetze"] });
    } catch (e: any) { toast.error(e.message ?? "Fehler"); }
  }

  return (
    <div className="p-4 md:p-8 space-y-5 max-w-3xl">
      <header className="space-y-1">
        <div className="text-[11px] uppercase tracking-widest text-muted-foreground flex items-center gap-2">
          <Truck className="size-3.5" /> Fahrer
        </div>
        <h1 className="text-2xl md:text-3xl font-bold">Meine Einsätze</h1>
        <p className="text-sm text-muted-foreground">
          Alle dir zugewiesenen Einsätze auf einen Blick.
        </p>
      </header>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full md:w-auto">
          <TabsTrigger value="aktiv" className="flex-1 md:flex-none gap-2">
            Aktiv <Badge variant="secondary" className="ml-1">{counts.aktiv}</Badge>
          </TabsTrigger>
          <TabsTrigger value="erledigt" className="flex-1 md:flex-none gap-2">
            Erledigt <Badge variant="secondary" className="ml-1">{counts.erledigt}</Badge>
          </TabsTrigger>
          <TabsTrigger value="alle" className="flex-1 md:flex-none">Alle</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
          Lade Einsätze…
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center">
          <div className="mx-auto size-12 rounded-full bg-muted grid place-items-center">
            <Flag className="size-5 text-muted-foreground" />
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            {tab === "aktiv" ? "Aktuell keine offenen Einsätze." : "Keine Einträge."}
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((e) => {
            const meta = STATUS_META[e.status] ?? { label: e.status, cls: "bg-muted text-muted-foreground" };
            const mapsUrl = e.address
              ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(e.address)}`
              : null;
            return (
              <li
                key={e.id}
                className="rounded-xl border border-border bg-card p-4 md:p-5 space-y-3"
                style={{ boxShadow: "var(--shadow-card)" }}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${meta.cls}`}>
                    {meta.label}
                  </span>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="size-3" /> {fmt(e.assigned_at ?? e.created_at)}
                  </span>
                </div>

                <div>
                  <h2 className="text-lg font-semibold leading-tight">{e.einsatzgrund}</h2>
                  {e.beschreibung && (
                    <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{e.beschreibung}</p>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                  {e.kunden_name && <InfoRow icon={User} value={e.kunden_name} />}
                  {e.address && <InfoRow icon={MapPin} value={e.address} />}
                  {e.key_number && <InfoRow icon={KeyRound} value={`Schlüssel ${e.key_number}`} />}
                  {e.anlagen_nr && <InfoRow icon={Hash} value={`Anlage ${e.anlagen_nr}`} />}
                  {e.teilnehmer_id && <InfoRow icon={Phone} value={`TN ${e.teilnehmer_id}`} />}
                </div>

                <div className="text-xs text-muted-foreground">
                  Erstellt von <span className="text-foreground/80 font-medium">{profiles[e.created_by] ?? "–"}</span>
                  {e.abgeschlossen_am && <> · Abgeschlossen {fmt(e.abgeschlossen_am)}</>}
                </div>

                {isAktiv(e) && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-border">
                    <HoldButton label="Vor Ort" value={e.vor_ort_am}
                      icon={<MapPinned className="size-4" />}
                      onComplete={() => setTime(e.id, "vor_ort")} />
                    <HoldButton label="Abfahrt" value={e.abfahrt_am}
                      icon={<LogOut className="size-4" />}
                      onComplete={() => setTime(e.id, "abfahrt")} />
                    <HoldButton label="Einsatz Ende" value={e.einsatz_ende_am}
                      icon={<Square className="size-4" />}
                      onComplete={() => setTime(e.id, "ende")} />
                  </div>
                )}

                {!isAktiv(e) && (e.vor_ort_am || e.abfahrt_am || e.einsatz_ende_am) && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-border text-xs">
                    <TimeBadge label="Vor Ort" value={e.vor_ort_am} />
                    <TimeBadge label="Abfahrt" value={e.abfahrt_am} />
                    <TimeBadge label="Ende" value={e.einsatz_ende_am} />
                  </div>
                )}

                <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
                  {mapsUrl && (
                    <a href={mapsUrl} target="_blank" rel="noreferrer" className="flex-1 sm:flex-none">
                      <Button variant="outline" size="sm" className="w-full gap-1.5">
                        <Navigation className="size-4" /> Navigation
                      </Button>
                    </a>
                  )}
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setDateienFor(e.id)}>
                    <FolderOpen className="size-4" /> Dateien
                  </Button>
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setInfoFor(e.id)}>
                    <Info className="size-4" /> Infos
                  </Button>
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setBerichtFor(e)}>
                    <ClipboardList className="size-4" /> Bericht
                  </Button>
                  <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => setHistory(e)}>
                    <HistoryIcon className="size-4" /> Verlauf
                  </Button>
                  {isAktiv(e) && (
                    <Button
                      size="sm"
                      className="ml-auto gap-1.5"
                      disabled={busy === e.id}
                      onClick={() => complete(e.id)}
                    >
                      <CheckSquare className="size-4" /> Abschließen
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <HistoryDialog einsatz={history} onClose={() => setHistory(null)} />
      <EinsatzDateienDialog einsatzId={dateienFor} open={!!dateienFor} onClose={() => setDateienFor(null)} />
      <EinsatzBerichtDialog einsatz={berichtFor} open={!!berichtFor} onClose={() => setBerichtFor(null)} />
      <KundenInfoDialog einsatzId={infoFor} open={!!infoFor} onClose={() => setInfoFor(null)} />
    </div>
  );
}

function InfoRow({ icon: Icon, value }: { icon: any; value: string }) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <Icon className="size-4 text-muted-foreground shrink-0" />
      <span className="truncate">{value}</span>
    </div>
  );
}

function TimeBadge({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="rounded-md border border-border bg-muted/30 px-2 py-1.5 flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums">{value ? fmt(value) : "–"}</span>
    </div>
  );
}

const FIELD_LABELS: Record<string, string> = {
  status: "Status", einsatzgrund: "Einsatzgrund", kunden_name: "Kunde",
  address: "Adresse", key_number: "Schlüssel-Nr.", anlagen_nr: "Anlagen-Nr.",
  teilnehmer_id: "Teilnehmer-ID", beschreibung: "Beschreibung",
  assigned_to: "Fahrer", abgeschlossen_am: "Abgeschlossen am",
  vor_ort_am: "Vor Ort", abfahrt_am: "Abfahrt", einsatz_ende_am: "Einsatz Ende",
  bericht: "Bericht",
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
          <DialogTitle>Verlauf</DialogTitle>
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
import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Building2, Plus, Search, Loader2, Trash2, CalendarClock, User, MapPin, KeyRound,
  MessageSquarePlus, TriangleAlert, CheckCircle2, CircleDot, ExternalLink,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { KundeSuche, type KundeHit } from "@/components/kunde-suche";
import {
  listAuftraege, createAuftrag, updateAuftrag, deleteAuftrag, getAuftrag, addNotiz, deleteNotiz, listTeam,
  AUFTRAG_TYPEN, AUFTRAG_STATUS, AUFTRAG_PRIO, type AuftragRow, type NotizRow,
} from "@/lib/service-center.functions";

export const Route = createFileRoute("/_authenticated/service-center")({
  head: () => ({
    meta: [
      { title: "Service Center – AlarmDesk" },
      { name: "description", content: "Anfragen und Aufträge mit Nummer, Frist und Zuständigkeit zentral bearbeiten." },
      { property: "og:title", content: "Service Center" },
      { property: "og:description", content: "Auftragsannahme und Nachverfolgung in der Alarmzentrale." },
    ],
  }),
  component: ServiceCenterPage,
});

const TYP_LABEL: Record<string, string> = Object.fromEntries(AUFTRAG_TYPEN.map((t) => [t.value, t.label]));
const STATUS_LABEL: Record<string, string> = Object.fromEntries(AUFTRAG_STATUS.map((t) => [t.value, t.label]));
const PRIO_CLS: Record<string, string> = {
  hoch: "bg-red-500/15 text-red-400 border border-red-500/30",
  normal: "bg-sky-500/15 text-sky-400 border border-sky-500/30",
  niedrig: "bg-muted text-muted-foreground",
};
const STATUS_CLS: Record<string, string> = {
  offen: "bg-amber-500/15 text-amber-400 border border-amber-500/30",
  in_bearbeitung: "bg-blue-500/15 text-blue-400 border border-blue-500/30",
  wartet_kunde: "bg-violet-500/15 text-violet-400 border border-violet-500/30",
  erledigt: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
  abgebrochen: "bg-muted text-muted-foreground",
};

function heute() {
  return new Date().toISOString().slice(0, 10);
}
function fmtDate(d?: string | null) {
  if (!d) return "–";
  return new Date(`${d}T12:00:00`).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}
function fmtZeit(d?: string | null) {
  if (!d) return "–";
  return new Date(d).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}
function ueberfaellig(a: AuftragRow) {
  return !!a.faellig_am && a.faellig_am < heute() && a.status !== "erledigt" && a.status !== "abgebrochen";
}

function ServiceCenterPage() {
  const listFn = useServerFn(listAuftraege);
  const [eingabe, setEingabe] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("offen");
  const [nurUeberfaellig, setNurUeberfaellig] = useState(false);
  const [neu, setNeu] = useState(false);
  const [geoeffnet, setGeoeffnet] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setQ(eingabe.trim()), 300);
    return () => clearTimeout(t);
  }, [eingabe]);

  const { data, isFetching } = useQuery({
    queryKey: ["service-auftraege", status, q, nurUeberfaellig],
    queryFn: () =>
      listFn({
        data: {
          q,
          nurUeberfaellig,
          status: status === "alle" ? undefined : [status],
        },
      }),
  });
  const rows = ((data as any)?.rows ?? []) as AuftragRow[];

  const { data: allData } = useQuery({
    queryKey: ["service-auftraege", "alle"],
    queryFn: () => listFn({ data: { q: "", nurUeberfaellig: false } }),
  });
  const alle = ((allData as any)?.rows ?? []) as AuftragRow[];
  const zahl = (s: string) => alle.filter((a) => a.status === s).length;
  const offenUeberfaellig = alle.filter(ueberfaellig).length;

  return (
    <div className="p-6 lg:p-8 space-y-5 max-w-6xl">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
            <Building2 className="size-3.5" /> Auftragsannahme
          </div>
          <h1 className="text-3xl font-bold mt-1">Service Center</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Anfragen, Störungen und Lieferungen bekommen eine Nummer, eine Frist und eine zuständige Person.
            Aus einem Auftrag lässt sich direkt ein Einsatz anlegen.
          </p>
        </div>
        <Button onClick={() => setNeu(true)} className="gap-1.5">
          <Plus className="size-4" /> Neuer Auftrag
        </Button>
      </header>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Kennzahl label="Offen" wert={zahl("offen")} icon={CircleDot} />
        <Kennzahl label="In Bearbeitung" wert={zahl("in_bearbeitung")} icon={Loader2} />
        <Kennzahl label="Überfällig" wert={offenUeberfaellig} icon={TriangleAlert} warnung />
        <Kennzahl label="Erledigt" wert={zahl("erledigt")} icon={CheckCircle2} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Tabs value={status} onValueChange={setStatus}>
          <TabsList>
            <TabsTrigger value="offen">Offen</TabsTrigger>
            <TabsTrigger value="in_bearbeitung">In Bearbeitung</TabsTrigger>
            <TabsTrigger value="wartet_kunde">Wartet auf Kunde</TabsTrigger>
            <TabsTrigger value="erledigt">Erledigt</TabsTrigger>
            <TabsTrigger value="alle">Alle</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative flex-1 min-w-52">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Nummer, Betreff, Kunde, Schlüssel-Nr. ..."
            value={eingabe}
            onChange={(e) => setEingabe(e.target.value)}
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <Switch checked={nurUeberfaellig} onCheckedChange={(v: boolean) => setNurUeberfaellig(v)} />
          nur überfällige
        </label>
      </div>

      {isFetching && rows.length === 0 ? (
        <div className="grid place-items-center py-16 text-muted-foreground gap-2">
          <Loader2 className="size-5 animate-spin" />
          <span className="text-sm">Aufträge werden geladen ...</span>
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center space-y-3">
          <div className="mx-auto size-12 rounded-full bg-muted grid place-items-center">
            <Building2 className="size-5 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">
            {q || status !== "offen" || nurUeberfaellig
              ? "Keine Aufträge für diese Auswahl."
              : "Noch keine Aufträge erfasst."}
          </p>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setNeu(true)}>
            <Plus className="size-4" /> Auftrag erfassen
          </Button>
        </div>
      ) : (
        <ul className="space-y-2">
          {rows.map((a) => (
            <li key={a.id}>
              <button
                type="button"
                onClick={() => setGeoeffnet(a.id)}
                className="w-full text-left rounded-xl border border-border bg-card p-4 hover:border-primary/50 transition-colors"
                style={{ boxShadow: "var(--shadow-card)" }}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
                    #{a.nummer}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${STATUS_CLS[a.status] ?? STATUS_CLS.offen}`}>
                    {STATUS_LABEL[a.status] ?? a.status}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${PRIO_CLS[a.prioritaet] ?? PRIO_CLS.normal}`}>
                    {a.prioritaet}
                  </span>
                  <Badge variant="outline" className="text-[10px]">{TYP_LABEL[a.typ] ?? a.typ}</Badge>
                  <span className="ml-auto text-xs text-muted-foreground flex items-center gap-1">
                    <CalendarClock className="size-3" />
                    <span className={ueberfaellig(a) ? "text-red-400 font-medium" : ""}>
                      {a.faellig_am ? `fällig ${fmtDate(a.faellig_am)}` : "ohne Frist"}
                    </span>
                  </span>
                </div>
                <div className="mt-2 text-base font-semibold leading-tight">{a.betreff}</div>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  {a.kunden_name && (
                    <span className="flex items-center gap-1"><User className="size-3" /> {a.kunden_name}</span>
                  )}
                  {a.address && <span className="flex items-center gap-1"><MapPin className="size-3" /> {a.address}</span>}
                  {a.key_number && <span className="flex items-center gap-1"><KeyRound className="size-3" /> {a.key_number}</span>}
                  {a.zugewiesen_name && <span>· {a.zugewiesen_name}</span>}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      <NeuerAuftragDialog open={neu} onClose={() => setNeu(false)} />
      <AuftragDialog auftragId={geoeffnet} onClose={() => setGeoeffnet(null)} />
    </div>
  );
}

function Kennzahl({
  label, wert, icon: Icon, warnung,
}: { label: string; wert: number; icon: any; warnung?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4" style={{ boxShadow: "var(--shadow-card)" }}>
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground">
        <Icon className={`size-3.5 ${warnung ? "text-red-400" : "text-primary"}`} /> {label}
      </div>
      <div className={`text-2xl font-bold mt-1 ${warnung && wert > 0 ? "text-red-400" : ""}`}>{wert}</div>
    </div>
  );
}

function NeuerAuftragDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const createFn = useServerFn(createAuftrag);
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    betreff: "",
    beschreibung: "",
    typ: "anfrage",
    prioritaet: "normal",
    faellig_am: "",
    kunden_name: "",
    address: "",
    key_number: "",
    teilnehmer_id: "",
  });

  function set(feld: string, wert: string) {
    setForm((f) => ({ ...f, [feld]: wert }));
  }
  function uebernehmen(hit: KundeHit) {
    setForm((f) => ({
      ...f,
      kunden_name: hit.kunden_name ?? "",
      address: hit.address ?? "",
      key_number: hit.key_number ?? "",
      teilnehmer_id: hit.teilnehmer_id ?? "",
    }));
  }

  async function speichern() {
    if (!form.betreff.trim()) {
      toast.error("Bitte einen Betreff angeben.");
      return;
    }
    setBusy(true);
    try {
      const res = await createFn({
        data: {
          betreff: form.betreff.trim(),
          beschreibung: form.beschreibung.trim() || null,
          typ: form.typ,
          prioritaet: form.prioritaet,
          faellig_am: form.faellig_am || null,
          kunden_name: form.kunden_name || null,
          address: form.address || null,
          key_number: form.key_number || null,
          teilnehmer_id: form.teilnehmer_id || null,
          zugewiesen_an: null,
          zugewiesen_name: null,
        },
      });
      toast.success(`Auftrag #${(res as any).auftrag.nummer} angelegt.`);
      queryClient.invalidateQueries({ queryKey: ["service-auftraege"] });
      setForm({ betreff: "", beschreibung: "", typ: "anfrage", prioritaet: "normal", faellig_am: "", kunden_name: "", address: "", key_number: "", teilnehmer_id: "" });
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Neuer Auftrag</DialogTitle>
          <DialogDescription>Der Auftrag bekommt automatisch die nächste freie Nummer.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <KundeSuche onPick={uebernehmen} label="Kunde / Objekt übernehmen (optional)" />

          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs">Betreff *</Label>
              <Input value={form.betreff} onChange={(e) => set("betreff", e.target.value)} placeholder="z. B. Funkmelder funktioniert nicht" />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs">Beschreibung</Label>
              <Textarea rows={3} value={form.beschreibung} onChange={(e) => set("beschreibung", e.target.value)} placeholder="Was wurde gemeldet? Wer hat angerufen?" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Art</Label>
              <Select value={form.typ} onValueChange={(v) => set("typ", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {AUFTRAG_TYPEN.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Dringlichkeit</Label>
              <Select value={form.prioritaet} onValueChange={(v) => set("prioritaet", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {AUFTRAG_PRIO.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Fällig bis</Label>
              <Input type="date" value={form.faellig_am} onChange={(e) => set("faellig_am", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Kunde</Label>
              <Input value={form.kunden_name} onChange={(e) => set("kunden_name", e.target.value)} />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs">Adresse</Label>
              <Input value={form.address} onChange={(e) => set("address", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Schlüssel-Nr.</Label>
              <Input value={form.key_number} onChange={(e) => set("key_number", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Teilnehmer-Nr.</Label>
              <Input value={form.teilnehmer_id} onChange={(e) => set("teilnehmer_id", e.target.value)} />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Abbrechen</Button>
          <Button onClick={speichern} disabled={busy} className="gap-1.5">
            {busy && <Loader2 className="size-4 animate-spin" />} Auftrag anlegen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AuftragDialog({ auftragId, onClose }: { auftragId: string | null; onClose: () => void }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const getFn = useServerFn(getAuftrag);
  const updateFn = useServerFn(updateAuftrag);
  const deleteFn = useServerFn(deleteAuftrag);
  const notizFn = useServerFn(addNotiz);
  const notizLoeschFn = useServerFn(deleteNotiz);
  const teamFn = useServerFn(listTeam);

  const [notiz, setNotiz] = useState("");
  const [busy, setBusy] = useState(false);

  const { data, isFetching } = useQuery({
    queryKey: ["service-auftrag", auftragId],
    queryFn: () => getFn({ data: { id: auftragId! } }),
    enabled: !!auftragId,
  });
  const auftrag = (data as any)?.auftrag as AuftragRow | undefined;
  const notizen = ((data as any)?.notizen ?? []) as NotizRow[];

  const { data: teamData } = useQuery({
    queryKey: ["service-team"],
    queryFn: () => teamFn(),
    enabled: !!auftragId,
  });
  const team = ((teamData as any)?.team ?? []) as Array<{ id: string; name: string }>;

  async function ändern(patch: Record<string, unknown>, meldung = "Auftrag aktualisiert.") {
    if (!auftrag) return;
    setBusy(true);
    try {
      await updateFn({ data: { id: auftrag.id, ...patch } as any });
      toast.success(meldung);
      queryClient.invalidateQueries({ queryKey: ["service-auftrag", auftrag.id] });
      queryClient.invalidateQueries({ queryKey: ["service-auftraege"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function notizSpeichern() {
    if (!auftrag || !notiz.trim()) return;
    setBusy(true);
    try {
      await notizFn({ data: { auftrag_id: auftrag.id, text: notiz.trim() } });
      setNotiz("");
      queryClient.invalidateQueries({ queryKey: ["service-auftrag", auftrag.id] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function entfernen() {
    if (!auftrag) return;
    if (!window.confirm(`Auftrag #${auftrag.nummer} wirklich löschen?`)) return;
    setBusy(true);
    try {
      await deleteFn({ data: { id: auftrag.id } });
      toast.success("Auftrag gelöscht.");
      queryClient.invalidateQueries({ queryKey: ["service-auftraege"] });
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <Dialog open={!!auftragId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[88vh] overflow-y-auto">
        {isFetching || !auftrag ? (
          <div className="grid place-items-center py-16 text-muted-foreground gap-2">
            <Loader2 className="size-5 animate-spin" />
            <span className="text-sm">Auftrag wird geladen ...</span>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-sm px-2 py-0.5 rounded-md bg-muted">#{auftrag.nummer}</span>
                {auftrag.betreff}
              </DialogTitle>
              <DialogDescription>
                Angelegt {fmtZeit(auftrag.created_at)}
                {auftrag.erstellt_von_name ? ` von ${auftrag.erstellt_von_name}` : ""} ·{" "}
                {TYP_LABEL[auftrag.typ] ?? auftrag.typ}
              </DialogDescription>
            </DialogHeader>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Status</Label>
                <Select value={auftrag.status} onValueChange={(v) => ändern({ status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {AUFTRAG_STATUS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Dringlichkeit</Label>
                <Select value={auftrag.prioritaet} onValueChange={(v) => ändern({ prioritaet: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {AUFTRAG_PRIO.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Zuständig</Label>
                <Select
                  value={auftrag.zugewiesen_an ?? "none"}
                  onValueChange={(v) =>
                    ändern(
                      v === "none"
                        ? { zugewiesen_an: null, zugewiesen_name: null }
                        : { zugewiesen_an: v, zugewiesen_name: team.find((t) => t.id === v)?.name ?? null },
                    )
                  }
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Niemand</SelectItem>
                    {team.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Fällig bis</Label>
                <Input
                  type="date"
                  value={auftrag.faellig_am ?? ""}
                  onChange={(e) => ändern({ faellig_am: e.target.value || null })}
                />
              </div>
            </div>

            {auftrag.beschreibung && (
              <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm whitespace-pre-wrap">
                {auftrag.beschreibung}
              </div>
            )}

            <div className="rounded-lg border border-border p-3 text-sm space-y-1">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Objekt</div>
              <div className="flex flex-wrap gap-x-5 gap-y-1">
                {auftrag.kunden_name && <span className="flex items-center gap-1"><User className="size-3" /> {auftrag.kunden_name}</span>}
                {auftrag.address && <span className="flex items-center gap-1"><MapPin className="size-3" /> {auftrag.address}</span>}
                {auftrag.key_number && <span className="flex items-center gap-1"><KeyRound className="size-3" /> {auftrag.key_number}</span>}
                {!auftrag.kunden_name && !auftrag.address && !auftrag.key_number && (
                  <span className="text-muted-foreground">Kein Objekt hinterlegt.</span>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Notizen & Verlauf ({notizen.length})
              </div>
              <ul className="space-y-2 max-h-56 overflow-y-auto">
                {notizen.map((n) => (
                  <li key={n.id} className="rounded-lg border border-border p-3 text-sm group">
                    <div className="whitespace-pre-wrap">{n.text}</div>
                    <div className="mt-1 text-[11px] text-muted-foreground flex items-center gap-2">
                      <span>{fmtZeit(n.created_at)}{n.erstellt_von_name ? ` · ${n.erstellt_von_name}` : ""}</span>
                      <button
                        type="button"
                        className="ml-auto opacity-0 group-hover:opacity-100 text-destructive inline-flex items-center gap-1"
                        onClick={async () => {
                          try {
                            await notizLoeschFn({ data: { id: n.id } });
                            queryClient.invalidateQueries({ queryKey: ["service-auftrag", auftrag.id] });
                          } catch (e) {
                            toast.error((e as Error).message);
                          }
                        }}
                      >
                        <Trash2 className="size-3" /> entfernen
                      </button>
                    </div>
                  </li>
                ))}
                {notizen.length === 0 && (
                  <li className="text-sm text-muted-foreground">Noch keine Notizen.</li>
                )}
              </ul>
              <div className="flex gap-2">
                <Textarea
                  rows={2}
                  value={notiz}
                  onChange={(e) => setNotiz(e.target.value)}
                  placeholder="Was ist passiert? Was wurde veranlasst?"
                />
                <Button onClick={notizSpeichern} disabled={busy || !notiz.trim()} className="gap-1.5 shrink-0">
                  <MessageSquarePlus className="size-4" /> Notieren
                </Button>
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="ghost" className="text-destructive gap-1.5" onClick={entfernen} disabled={busy}>
                <Trash2 className="size-4" /> Löschen
              </Button>
              <Button
                variant="outline"
                className="gap-1.5"
                onClick={() =>
                  navigate({
                    to: "/einsatz-erstellen",
                    search: {
                      kunde: auftrag.kunden_name ?? "",
                      adresse: auftrag.address ?? "",
                      key: auftrag.key_number ?? "",
                      teilnehmer: auftrag.teilnehmer_id ?? "",
                      grund: auftrag.betreff,
                    } as any,
                  })
                }
              >
                <ExternalLink className="size-4" /> Einsatz anlegen
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

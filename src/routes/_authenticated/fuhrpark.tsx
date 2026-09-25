import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Truck, Plus, Search, Loader2, Trash2, CalendarClock, TriangleAlert, CheckCircle2,
  CarFront, Gauge, Wrench, PlusCircle, CircleDot, Pencil,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  listFahrzeuge, getFahrzeug, createFahrzeug, updateFahrzeug, deleteFahrzeug,
  createTermin, updateTermin, deleteTermin, createSchaden, updateSchaden, deleteSchaden,
  addKmEintrag, deleteKmEintrag,
  FAHRZEUG_STATUS, TANKARTEN, TERMIN_ARTEN, SCHADEN_SCHWERE, SCHADEN_STATUS,
  type FahrzeugRow, type TerminRow, type SchadenRow, type KmEintragRow,
} from "@/lib/fuhrpark.functions";

export const Route = createFileRoute("/_authenticated/fuhrpark")({
  head: () => ({
    meta: [
      { title: "Fuhrpark – AlarmDesk" },
      { name: "description", content: "Fahrzeuge, HU- und Inspektionstermine, Schäden und Kilometerstände verwalten." },
      { property: "og:title", content: "Fuhrpark" },
      { property: "og:description", content: "Fahrzeuge, Termine und Schäden in der Alarmzentrale." },
    ],
  }),
  component: FuhrparkPage,
});

const STATUS_CLS: Record<string, string> = {
  aktiv: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
  werkstatt: "bg-amber-500/15 text-amber-400 border border-amber-500/30",
  ausgemustert: "bg-muted text-muted-foreground",
};
const TERMIN_ART: Record<string, string> = Object.fromEntries(TERMIN_ARTEN.map((t) => [t.value, t.label]));
const SCHADEN_ST: Record<string, string> = Object.fromEntries(SCHADEN_STATUS.map((t) => [t.value, t.label]));
const SCHADEN_CLS: Record<string, string> = {
  offen: "bg-red-500/15 text-red-400 border border-red-500/30",
  in_reparatur: "bg-amber-500/15 text-amber-400 border border-amber-500/30",
  behandelt: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
};
const SCHWERE_CLS: Record<string, string> = {
  leicht: "bg-muted text-muted-foreground",
  mittel: "bg-amber-500/15 text-amber-400 border border-amber-500/30",
  schwer: "bg-red-500/15 text-red-400 border border-red-500/30",
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
function fmtKm(km?: number | null) {
  if (km == null) return "–";
  return `${km.toLocaleString("de-DE")} km`;
}

function FuhrparkPage() {
  const listFn = useServerFn(listFahrzeuge);
  const queryClient = useQueryClient();
  const [eingabe, setEingabe] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("alle");
  const [neu, setNeu] = useState(false);
  const [geoeffnet, setGeoeffnet] = useState<string | null>(null);
  const [bearbeite, setBearbeite] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setQ(eingabe.trim()), 300);
    return () => clearTimeout(t);
  }, [eingabe]);

  const { data, isFetching } = useQuery({
    queryKey: ["fuhrpark", q, status],
    queryFn: () =>
      listFn({ data: { q, status: status === "alle" ? undefined : [status] } }),
  });
  const rows = ((data as any)?.rows ?? []) as FahrzeugRow[];

  const { data: allData } = useQuery({
    queryKey: ["fuhrpark", "alle"],
    queryFn: () => listFn({ data: { q: "" } }),
  });
  const alle = ((allData as any)?.rows ?? []) as FahrzeugRow[];
  const heuteStr = heute();
  const ueberfaelligTermine = alle.filter((f) => f.naechster_termin && f.naechster_termin.faellig_am < heuteStr).length;
  const aktiv = alle.filter((f) => f.status === "aktiv").length;
  const werkstatt = alle.filter((f) => f.status === "werkstatt").length;

  const aktuelles = geoeffnet ? alle.find((f) => f.id === geoeffnet) ?? null : null;

  return (
    <div className="p-6 lg:p-8 space-y-5 max-w-6xl">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
            <Truck className="size-3.5" /> Fahrzeugverwaltung
          </div>
          <h1 className="text-3xl font-bold mt-1">Fuhrpark</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Alle Fahrzeuge mit HU- und Inspektionsterminen, Schäden und Kilometerständen an einem Ort.
            Überfällige Termine fallen sofort auf.
          </p>
        </div>
        <Button onClick={() => setNeu(true)} className="gap-1.5">
          <Plus className="size-4" /> Neues Fahrzeug
        </Button>
      </header>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Kennzahl label="Fahrzeuge aktiv" wert={aktiv} icon={CarFront} />
        <Kennzahl label="In der Werkstatt" wert={werkstatt} icon={Wrench} />
        <Kennzahl label="Termine überfällig" wert={ueberfaelligTermine} icon={TriangleAlert} warnung />
        <Kennzahl label="Gesamt" wert={alle.length} icon={CircleDot} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Tabs value={status} onValueChange={setStatus}>
          <TabsList>
            <TabsTrigger value="alle">Alle</TabsTrigger>
            <TabsTrigger value="aktiv">Aktiv</TabsTrigger>
            <TabsTrigger value="werkstatt">Werkstatt</TabsTrigger>
            <TabsTrigger value="ausgemustert">Ausgemustert</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative flex-1 min-w-52">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Kennzeichen, Bezeichnung, Marke, Fahrer ..."
            value={eingabe}
            onChange={(e) => setEingabe(e.target.value)}
          />
        </div>
      </div>

      {isFetching && rows.length === 0 ? (
        <div className="grid place-items-center py-16 text-muted-foreground gap-2">
          <Loader2 className="size-5 animate-spin" />
          <span className="text-sm">Fahrzeuge werden geladen ...</span>
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center space-y-3">
          <div className="mx-auto size-12 rounded-full bg-muted grid place-items-center">
            <Truck className="size-5 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">
            {q || status !== "alle"
              ? "Keine Fahrzeuge für diese Auswahl."
              : "Noch keine Fahrzeuge erfasst."}
          </p>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setNeu(true)}>
            <Plus className="size-4" /> Fahrzeug anlegen
          </Button>
        </div>
      ) : (
        <ul className="grid sm:grid-cols-2 gap-2">
          {rows.map((f) => {
            const tOverdue = f.naechster_termin && f.naechster_termin.faellig_am < heuteStr;
            return (
              <li key={f.id}>
                <button
                  type="button"
                  onClick={() => { setGeoeffnet(f.id); setBearbeite(false); }}
                  className="w-full text-left rounded-xl border border-border bg-card p-4 hover:border-primary/50 transition-colors"
                  style={{ boxShadow: "var(--shadow-card)" }}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-bold px-2 py-0.5 rounded-md bg-primary/10 text-primary">
                      {f.kennzeichen}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${STATUS_CLS[f.status] ?? STATUS_CLS.aktiv}`}>
                      {FAHRZEUG_STATUS.find((s) => s.value === f.status)?.label ?? f.status}
                    </span>
                    {tOverdue && (
                      <span className="ml-auto text-xs font-medium text-red-400 flex items-center gap-1">
                        <TriangleAlert className="size-3" /> Termin überfällig
                      </span>
                    )}
                  </div>
                  <div className="mt-2 text-base font-semibold leading-tight">
                    {f.bezeichnung || [f.marke, f.modell].filter(Boolean).join(" ") || f.kennzeichen}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Gauge className="size-3" /> {fmtKm(f.km_stand)}</span>
                    {f.hauptfahrer && <span>· {f.hauptfahrer}</span>}
                    {f.naechster_termin && (
                      <span className={`flex items-center gap-1 ${tOverdue ? "text-red-400 font-medium" : ""}`}>
                        <CalendarClock className="size-3" />
                        {TERMIN_ART[f.naechster_termin.art] ?? f.naechster_termin.art}: {fmtDate(f.naechster_termin.faellig_am)}
                      </span>
                    )}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <NeuesFahrzeugDialog open={neu} onClose={() => setNeu(false)} />
      {geoeffnet && (
        <FahrzeugDialog
          fahrzeugId={geoeffnet}
          initialKm={aktuelles?.km_stand ?? null}
          initialBearbeiten={bearbeite}
          onBearbeitenChange={setBearbeite}
          onClose={() => { setGeoeffnet(null); setBearbeite(false); }}
        />
      )}
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

function NeuesFahrzeugDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const createFn = useServerFn(createFahrzeug);
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    kennzeichen: "", bezeichnung: "", art: "Dienstfahrzeug", marke: "", modell: "",
    baujahr: "", vin: "", km_stand: "", tankart: "benzin", hauptfahrer: "", notizen: "",
  });

  function set(feld: string, wert: string) {
    setForm((f) => ({ ...f, [feld]: wert }));
  }

  async function speichern() {
    if (!form.kennzeichen.trim()) {
      toast.error("Bitte ein Kennzeichen angeben.");
      return;
    }
    setBusy(true);
    try {
      await createFn({
        data: {
          kennzeichen: form.kennzeichen.trim(),
          bezeichnung: form.bezeichnung.trim() || null,
          art: form.art.trim() || null,
          marke: form.marke.trim() || null,
          modell: form.modell.trim() || null,
          baujahr: form.baujahr ? Number(form.baujahr) : null,
          vin: form.vin.trim() || null,
          km_stand: form.km_stand ? Number(form.km_stand) : null,
          tankart: form.tankart,
          hauptfahrer: form.hauptfahrer.trim() || null,
          notizen: form.notizen.trim() || null,
          status: "aktiv",
        },
      });
      toast.success("Fahrzeug angelegt.");
      queryClient.invalidateQueries({ queryKey: ["fuhrpark"] });
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
          <DialogTitle>Neues Fahrzeug</DialogTitle>
          <DialogDescription>Kennzeichen ist Pflicht, alles andere kann nachgetragen werden.</DialogDescription>
        </DialogHeader>

        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Kennzeichen *</Label>
            <Input value={form.kennzeichen} onChange={(e) => set("kennzeichen", e.target.value)} placeholder="z. B. B-AB 1234" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Bezeichnung</Label>
            <Input value={form.bezeichnung} onChange={(e) => set("bezeichnung", e.target.value)} placeholder="z. B. Revierwagen 1" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Art</Label>
            <Input value={form.art} onChange={(e) => set("art", e.target.value)} placeholder="z. B. Streifenfahrzeug" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Marke</Label>
            <Input value={form.marke} onChange={(e) => set("marke", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Modell</Label>
            <Input value={form.modell} onChange={(e) => set("modell", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Baujahr</Label>
            <Input type="number" value={form.baujahr} onChange={(e) => set("baujahr", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Fin-Nr. (VIN)</Label>
            <Input value={form.vin} onChange={(e) => set("vin", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Kilometerstand</Label>
            <Input type="number" value={form.km_stand} onChange={(e) => set("km_stand", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Antrieb</Label>
            <Select value={form.tankart} onValueChange={(v) => set("tankart", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TANKARTEN.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Hauptfahrer</Label>
            <Input value={form.hauptfahrer} onChange={(e) => set("hauptfahrer", e.target.value)} />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label className="text-xs">Notizen</Label>
            <Textarea rows={2} value={form.notizen} onChange={(e) => set("notizen", e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Abbrechen</Button>
          <Button onClick={speichern} disabled={busy} className="gap-1.5">
            {busy && <Loader2 className="size-4 animate-spin" />} Fahrzeug anlegen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FahrzeugDialog({
  fahrzeugId, initialKm, initialBearbeiten, onBearbeitenChange, onClose,
}: {
  fahrzeugId: string;
  initialKm: number | null;
  initialBearbeiten: boolean;
  onBearbeitenChange: (v: boolean) => void;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const getFn = useServerFn(getFahrzeug);
  const updateFn = useServerFn(updateFahrzeug);
  const deleteFn = useServerFn(deleteFahrzeug);
  const terminNeuFn = useServerFn(createTermin);
  const terminUpdateFn = useServerFn(updateTermin);
  const terminDeleteFn = useServerFn(deleteTermin);
  const schadenNeuFn = useServerFn(createSchaden);
  const schadenUpdateFn = useServerFn(updateSchaden);
  const schadenDeleteFn = useServerFn(deleteSchaden);
  const kmNeuFn = useServerFn(addKmEintrag);
  const kmDeleteFn = useServerFn(deleteKmEintrag);

  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState("stamm");

  const { data, isFetching } = useQuery({
    queryKey: ["fuhrpark-fahrzeug", fahrzeugId],
    queryFn: () => getFn({ data: { id: fahrzeugId } }),
  });
  const fahrzeug = (data as any)?.fahrzeug as FahrzeugRow | undefined;
  const termine = ((data as any)?.termine ?? []) as TerminRow[];
  const schaeden = ((data as any)?.schaeden ?? []) as SchadenRow[];
  const kmLog = ((data as any)?.kmLog ?? []) as KmEintragRow[];

  const [form, setForm] = useState<Record<string, string>>({});
  useEffect(() => {
    if (fahrzeug) {
      setForm({
        kennzeichen: fahrzeug.kennzeichen ?? "",
        bezeichnung: fahrzeug.bezeichnung ?? "",
        art: fahrzeug.art ?? "",
        marke: fahrzeug.marke ?? "",
        modell: fahrzeug.modell ?? "",
        baujahr: fahrzeug.baujahr != null ? String(fahrzeug.baujahr) : "",
        vin: fahrzeug.vin ?? "",
        km_stand: fahrzeug.km_stand != null ? String(fahrzeug.km_stand) : "",
        tankart: fahrzeug.tankart ?? "benzin",
        status: fahrzeug.status ?? "aktiv",
        hauptfahrer: fahrzeug.hauptfahrer ?? "",
        notizen: fahrzeug.notizen ?? "",
      });
    }
  }, [fahrzeug?.id, fahrzeug?.updated_at]);

  // Neuer Termin / Schaden / KM
  const [nTermin, setNTermin] = useState({ art: "inspektion", faellig_am: "", km_stand: "", kosten: "", beschreibung: "" });
  const [nSchaden, setNSchaden] = useState({ gemeldet_am: heute(), beschreibung: "", schwere: "leicht", kosten: "", notizen: "" });
  const [nKm, setNKm] = useState({ km_stand: "", notiert_am: heute(), notizen: "" });

  async function speichernStamm() {
    if (!fahrzeug) return;
    if (!form.kennzeichen.trim()) {
      toast.error("Bitte ein Kennzeichen angeben.");
      return;
    }
    setBusy(true);
    try {
      await updateFn({
        data: {
          id: fahrzeug.id,
          kennzeichen: form.kennzeichen.trim(),
          bezeichnung: form.bezeichnung.trim() || null,
          art: form.art.trim() || null,
          marke: form.marke.trim() || null,
          modell: form.modell.trim() || null,
          baujahr: form.baujahr ? Number(form.baujahr) : null,
          vin: form.vin.trim() || null,
          km_stand: form.km_stand ? Number(form.km_stand) : null,
          tankart: form.tankart,
          status: form.status,
          hauptfahrer: form.hauptfahrer.trim() || null,
          notizen: form.notizen.trim() || null,
        },
      });
      toast.success("Fahrzeug gespeichert.");
      queryClient.invalidateQueries({ queryKey: ["fuhrpark-fahrzeug", fahrzeug.id] });
      queryClient.invalidateQueries({ queryKey: ["fuhrpark"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function entfernen() {
    if (!fahrzeug) return;
    if (!window.confirm(`Fahrzeug ${fahrzeug.kennzeichen} inkl. aller Termine, Schäden und KM-Einträge wirklich löschen?`)) return;
    setBusy(true);
    try {
      await deleteFn({ data: { id: fahrzeug.id } });
      toast.success("Fahrzeug gelöscht.");
      queryClient.invalidateQueries({ queryKey: ["fuhrpark"] });
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
      setBusy(false);
    }
  }

  async function run(fn: () => Promise<unknown>, meldung: string) {
    setBusy(true);
    try {
      await fn();
      toast.success(meldung);
      queryClient.invalidateQueries({ queryKey: ["fuhrpark-fahrzeug", fahrzeugId] });
      queryClient.invalidateQueries({ queryKey: ["fuhrpark"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (isFetching || !fahrzeug) {
    return (
      <Dialog open onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-3xl">
          <div className="grid place-items-center py-16 text-muted-foreground gap-2">
            <Loader2 className="size-5 animate-spin" />
            <span className="text-sm">Fahrzeug wird geladen ...</span>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const ueberfaelligTermine = termine.filter((t) => !t.erledigt_am && t.faellig_am && t.faellig_am < heute());
  const offeneSchaeden = schaeden.filter((s) => s.status !== "behandelt");

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-sm font-bold px-2 py-0.5 rounded-md bg-primary/10 text-primary">{fahrzeug.kennzeichen}</span>
            {fahrzeug.bezeichnung || [fahrzeug.marke, fahrzeug.modell].filter(Boolean).join(" ") || "Fahrzeug"}
          </DialogTitle>
          <DialogDescription>
            Angelegt {fmtZeit(fahrzeug.created_at)}
            {fahrzeug.erstellt_von_name ? ` von ${fahrzeug.erstellt_von_name}` : ""} · {fmtKm(fahrzeug.km_stand)}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="stamm">Stammdaten</TabsTrigger>
            <TabsTrigger value="termine">
              Termine{ueberfaelligTermine.length > 0 && <span className="ml-1 text-red-400">({ueberfaelligTermine.length})</span>}
            </TabsTrigger>
            <TabsTrigger value="schaeden">
              Schäden{offeneSchaeden.length > 0 && <span className="ml-1 text-red-400">({offeneSchaeden.length})</span>}
            </TabsTrigger>
            <TabsTrigger value="km">Kilometerstände</TabsTrigger>
          </TabsList>

          <div className="mt-4 space-y-4">
            {tab === "stamm" && (
              <>
                {initialBearbeiten ? (
                  <>
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Kennzeichen *</Label>
                        <Input value={form.kennzeichen} onChange={(e) => setForm((f) => ({ ...f, kennzeichen: e.target.value }))} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Bezeichnung</Label>
                        <Input value={form.bezeichnung} onChange={(e) => setForm((f) => ({ ...f, bezeichnung: e.target.value }))} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Art</Label>
                        <Input value={form.art} onChange={(e) => setForm((f) => ({ ...f, art: e.target.value }))} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Status</Label>
                        <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {FAHRZEUG_STATUS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Marke</Label>
                        <Input value={form.marke} onChange={(e) => setForm((f) => ({ ...f, marke: e.target.value }))} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Modell</Label>
                        <Input value={form.modell} onChange={(e) => setForm((f) => ({ ...f, modell: e.target.value }))} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Baujahr</Label>
                        <Input type="number" value={form.baujahr} onChange={(e) => setForm((f) => ({ ...f, baujahr: e.target.value }))} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Fin-Nr. (VIN)</Label>
                        <Input value={form.vin} onChange={(e) => setForm((f) => ({ ...f, vin: e.target.value }))} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Kilometerstand</Label>
                        <Input type="number" value={form.km_stand} onChange={(e) => setForm((f) => ({ ...f, km_stand: e.target.value }))} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Antrieb</Label>
                        <Select value={form.tankart} onValueChange={(v) => setForm((f) => ({ ...f, tankart: v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {TANKARTEN.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1 sm:col-span-2">
                        <Label className="text-xs">Hauptfahrer</Label>
                        <Input value={form.hauptfahrer} onChange={(e) => setForm((f) => ({ ...f, hauptfahrer: e.target.value }))} />
                      </div>
                      <div className="space-y-1 sm:col-span-2">
                        <Label className="text-xs">Notizen</Label>
                        <Textarea rows={2} value={form.notizen} onChange={(e) => setForm((f) => ({ ...f, notizen: e.target.value }))} />
                      </div>
                    </div>
                    <DialogFooter className="gap-2">
                      <Button variant="ghost" onClick={() => onBearbeitenChange(false)}>Abbrechen</Button>
                      <Button onClick={speichernStamm} disabled={busy} className="gap-1.5">
                        {busy && <Loader2 className="size-4 animate-spin" />} Speichern
                      </Button>
                    </DialogFooter>
                  </>
                ) : (
                  <>
                    <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                      <Zeile label="Art" wert={fahrzeug.art || "–"} />
                      <Zeile label="Status" wert={FAHRZEUG_STATUS.find((s) => s.value === fahrzeug.status)?.label ?? fahrzeug.status} />
                      <Zeile label="Marke / Modell" wert={[fahrzeug.marke, fahrzeug.modell].filter(Boolean).join(" ") || "–"} />
                      <Zeile label="Baujahr" wert={fahrzeug.baujahr ? String(fahrzeug.baujahr) : "–"} />
                      <Zeile label="Fin-Nr. (VIN)" wert={fahrzeug.vin || "–"} />
                      <Zeile label="Antrieb" wert={TANKARTEN.find((t) => t.value === fahrzeug.tankart)?.label ?? fahrzeug.tankart} />
                      <Zeile label="Kilometerstand" wert={fmtKm(fahrzeug.km_stand)} />
                      <Zeile label="Hauptfahrer" wert={fahrzeug.hauptfahrer || "–"} />
                      {fahrzeug.notizen && <Zeile label="Notizen" wert={fahrzeug.notizen} voll />}
                    </div>
                    <DialogFooter className="gap-2">
                      <Button variant="ghost" onClick={entfernen} disabled={busy} className="text-red-400 hover:text-red-300 gap-1.5">
                        <Trash2 className="size-4" /> Löschen
                      </Button>
                      <Button variant="outline" onClick={() => onBearbeitenChange(true)} className="gap-1.5">
                        <Pencil className="size-4" /> Bearbeiten
                      </Button>
                    </DialogFooter>
                  </>
                )}
              </>
            )}

            {tab === "termine" && (
              <>
                <div className="rounded-xl border border-border bg-card/50 p-3 space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Neuer Termin</div>
                  <div className="grid sm:grid-cols-4 gap-2">
                    <Select value={nTermin.art} onValueChange={(v) => setNTermin((t) => ({ ...t, art: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {TERMIN_ARTEN.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Input type="date" value={nTermin.faellig_am} onChange={(e) => setNTermin((t) => ({ ...t, faellig_am: e.target.value }))} placeholder="fällig am" />
                    <Input type="number" value={nTermin.km_stand} onChange={(e) => setNTermin((t) => ({ ...t, km_stand: e.target.value }))} placeholder="KM (optional)" />
                    <Input type="number" step="0.01" value={nTermin.kosten} onChange={(e) => setNTermin((t) => ({ ...t, kosten: e.target.value }))} placeholder="Kosten € (optional)" />
                  </div>
                  <Input value={nTermin.beschreibung} onChange={(e) => setNTermin((t) => ({ ...t, beschreibung: e.target.value }))} placeholder="Beschreibung / Werkstatt (optional)" />
                  <Button size="sm" className="gap-1.5" disabled={busy}
                    onClick={() =>
                      run(async () => {
                        await terminNeuFn({
                          data: {
                            fahrzeug_id: fahrzeug.id,
                            art: nTermin.art,
                            faellig_am: nTermin.faellig_am || null,
                            km_stand: nTermin.km_stand ? Number(nTermin.km_stand) : null,
                            kosten: nTermin.kosten ? Number(nTermin.kosten) : null,
                            beschreibung: nTermin.beschreibung.trim() || null,
                          },
                        });
                        setNTermin({ art: "inspektion", faellig_am: "", km_stand: "", kosten: "", beschreibung: "" });
                      }, "Termin angelegt.")
                    }
                  >
                    <PlusCircle className="size-4" /> Termin anlegen
                  </Button>
                </div>

                {termine.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">Noch keine Termine erfasst.</p>
                ) : (
                  <ul className="space-y-2">
                    {termine.map((t) => {
                      const faellig = !t.erledigt_am && t.faellig_am && t.faellig_am < heute();
                      return (
                        <li key={t.id} className="rounded-xl border border-border bg-card p-3 flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className="text-[10px]">{TERMIN_ART[t.art] ?? t.art}</Badge>
                          <span className={`text-sm ${faellig ? "text-red-400 font-semibold" : ""}`}>
                            {t.faellig_am ? fmtDate(t.faellig_am) : "ohne Datum"}
                            {faellig ? " · überfällig" : ""}
                          </span>
                          {t.km_stand != null && <span className="text-xs text-muted-foreground">· {fmtKm(t.km_stand)}</span>}
                          {t.kosten != null && <span className="text-xs text-muted-foreground">· {t.kosten.toLocaleString("de-DE", { style: "currency", currency: "EUR" })}</span>}
                          <span className="ml-auto flex items-center gap-1">
                            {t.erledigt_am ? (
                              <span className="text-xs text-emerald-400 flex items-center gap-1">
                                <CheckCircle2 className="size-3" /> erledigt {fmtDate(t.erledigt_am.slice(0, 10))}
                              </span>
                            ) : (
                              <Button size="sm" variant="outline" disabled={busy}
                                onClick={() => run(async () => {
                                  await terminUpdateFn({ data: { id: t.id, erledigt: true } });
                                  if (t.km_stand != null) {
                                    await kmNeuFn({ data: { fahrzeug_id: fahrzeug.id, km_stand: t.km_stand, notizen: `${TERMIN_ART[t.art] ?? t.art} durchgeführt` } });
                                  }
                                }, "Termin erledigt.")}
                              >
                                erledigt
                              </Button>
                            )}
                            <Button size="icon" variant="ghost" className="size-8 text-muted-foreground hover:text-red-400" disabled={busy}
                              onClick={() => { if (window.confirm("Termin wirklich löschen?")) run(async () => { await terminDeleteFn({ data: { id: t.id } }); }, "Termin gelöscht."); }}>
                              <Trash2 className="size-3.5" />
                            </Button>
                          </span>
                          {t.beschreibung && <span className="w-full text-xs text-muted-foreground">{t.beschreibung}</span>}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </>
            )}

            {tab === "schaeden" && (
              <>
                <div className="rounded-xl border border-border bg-card/50 p-3 space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Neuer Schaden</div>
                  <div className="grid sm:grid-cols-3 gap-2">
                    <Input type="date" value={nSchaden.gemeldet_am} onChange={(e) => setNSchaden((s) => ({ ...s, gemeldet_am: e.target.value }))} />
                    <Select value={nSchaden.schwere} onValueChange={(v) => setNSchaden((s) => ({ ...s, schwere: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {SCHADEN_SCHWERE.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Input type="number" step="0.01" value={nSchaden.kosten} onChange={(e) => setNSchaden((s) => ({ ...s, kosten: e.target.value }))} placeholder="Kosten € (optional)" />
                  </div>
                  <Input value={nSchaden.beschreibung} onChange={(e) => setNSchaden((s) => ({ ...s, beschreibung: e.target.value }))} placeholder="Was ist passiert? *" />
                  <Textarea rows={2} value={nSchaden.notizen} onChange={(e) => setNSchaden((s) => ({ ...s, notizen: e.target.value }))} placeholder="Notizen (optional)" />
                  <Button size="sm" className="gap-1.5" disabled={busy || !nSchaden.beschreibung.trim()}
                    onClick={() =>
                      run(async () => {
                        await schadenNeuFn({
                          data: {
                            fahrzeug_id: fahrzeug.id,
                            gemeldet_am: nSchaden.gemeldet_am || null,
                            beschreibung: nSchaden.beschreibung.trim(),
                            schwere: nSchaden.schwere,
                            kosten: nSchaden.kosten ? Number(nSchaden.kosten) : null,
                            notizen: nSchaden.notizen.trim() || null,
                          },
                        });
                        setNSchaden({ gemeldet_am: heute(), beschreibung: "", schwere: "leicht", kosten: "", notizen: "" });
                      }, "Schaden gemeldet.")
                    }
                  >
                    <PlusCircle className="size-4" /> Schaden melden
                  </Button>
                </div>

                {schaeden.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">Keine Schäden erfasst.</p>
                ) : (
                  <ul className="space-y-2">
                    {schaeden.map((s) => (
                      <li key={s.id} className="rounded-xl border border-border bg-card p-3 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${SCHADEN_CLS[s.status] ?? SCHADEN_CLS.offen}`}>
                            {SCHADEN_ST[s.status] ?? s.status}
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${SCHWERE_CLS[s.schwere] ?? SCHWERE_CLS.leicht}`}>
                            {SCHADEN_SCHWERE.find((x) => x.value === s.schwere)?.label ?? s.schwere}
                          </span>
                          <span className="text-xs text-muted-foreground">{fmtDate(s.gemeldet_am)}{s.gemeldet_von_name ? ` · gemeldet von ${s.gemeldet_von_name}` : ""}</span>
                          {s.kosten != null && <span className="text-xs text-muted-foreground">· {s.kosten.toLocaleString("de-DE", { style: "currency", currency: "EUR" })}</span>}
                          <Button size="icon" variant="ghost" className="ml-auto size-8 text-muted-foreground hover:text-red-400" disabled={busy}
                            onClick={() => { if (window.confirm("Schaden wirklich löschen?")) run(async () => { await schadenDeleteFn({ data: { id: s.id } }); }, "Schaden gelöscht."); }}>
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                        <p className="text-sm">{s.beschreibung}</p>
                        {s.notizen && <p className="text-xs text-muted-foreground whitespace-pre-wrap">{s.notizen}</p>}
                        <div className="grid sm:grid-cols-3 gap-2">
                          <Select value={s.status} onValueChange={(v) => run(async () => { await schadenUpdateFn({ data: { id: s.id, status: v } }); }, "Schaden aktualisiert.")}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {SCHADEN_STATUS.map((st) => <SelectItem key={st.value} value={st.value}>{st.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <Select value={s.schwere} onValueChange={(v) => run(async () => { await schadenUpdateFn({ data: { id: s.id, schwere: v } }); }, "Schaden aktualisiert.")}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {SCHADEN_SCHWERE.map((st) => <SelectItem key={st.value} value={st.value}>{st.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <Input type="number" step="0.01" defaultValue={s.kosten ?? ""} onBlur={(e) => {
                            const wert = e.target.value ? Number(e.target.value) : null;
                            if (wert !== s.kosten) run(async () => { await schadenUpdateFn({ data: { id: s.id, kosten: wert } }); }, "Kosten gespeichert.");
                          }} placeholder="Kosten €" />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}

            {tab === "km" && (
              <>
                <div className="rounded-xl border border-border bg-card/50 p-3 space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Kilometerstand erfassen</div>
                  <div className="grid sm:grid-cols-3 gap-2">
                    <Input type="number" value={nKm.km_stand} onChange={(e) => setNKm((k) => ({ ...k, km_stand: e.target.value }))} placeholder={`Km-Stand (aktuell ${fahrzeug.km_stand ?? 0})`} />
                    <Input type="date" value={nKm.notiert_am} onChange={(e) => setNKm((k) => ({ ...k, notiert_am: e.target.value }))} />
                    <Input value={nKm.notizen} onChange={(e) => setNKm((k) => ({ ...k, notizen: e.target.value }))} placeholder="Notiz (optional)" />
                  </div>
                  <Button size="sm" className="gap-1.5" disabled={busy || !nKm.km_stand}
                    onClick={() =>
                      run(async () => {
                        await kmNeuFn({ data: { fahrzeug_id: fahrzeug.id, km_stand: Number(nKm.km_stand), notiert_am: nKm.notiert_am || null, notizen: nKm.notizen.trim() || null } });
                        setNKm({ km_stand: "", notiert_am: heute(), notizen: "" });
                      }, "Kilometerstand erfasst.")
                    }
                  >
                    <PlusCircle className="size-4" /> Erfassen
                  </Button>
                </div>

                {kmLog.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">Noch keine Kilometerstände erfasst.</p>
                ) : (
                  <ul className="space-y-1">
                    {kmLog.map((k) => (
                      <li key={k.id} className="rounded-lg border border-border bg-card px-3 py-2 flex items-center gap-3 text-sm">
                        <span className="font-mono font-semibold">{fmtKm(k.km_stand)}</span>
                        <span className="text-xs text-muted-foreground">{fmtDate(k.notiert_am)}{k.notiert_von_name ? ` · ${k.notiert_von_name}` : ""}</span>
                        {k.notizen && <span className="text-xs text-muted-foreground truncate">· {k.notizen}</span>}
                        <Button size="icon" variant="ghost" className="ml-auto size-7 text-muted-foreground hover:text-red-400" disabled={busy}
                          onClick={() => run(async () => { await kmDeleteFn({ data: { id: k.id } }); }, "Eintrag gelöscht.")}>
                          <Trash2 className="size-3" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function Zeile({ label, wert, voll }: { label: string; wert: string; voll?: boolean }) {
  return (
    <div className={voll ? "sm:col-span-2" : ""}>
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="whitespace-pre-wrap">{wert}</div>
    </div>
  );
}

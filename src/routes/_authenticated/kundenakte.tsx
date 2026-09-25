import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";
import {
  Search, ArrowLeft, FolderOpen, KeyRound, DoorOpen, Truck, Plus, Download, Pencil, Trash2, Loader2, Upload, Contact,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { safeUUID } from "@/lib/utils";
import { searchKunden, getKundenakte, type KundenKennung } from "@/lib/kundenakte.functions";
import { createDatei, softDeleteDatei, getDateiSignedUrl } from "@/lib/dateien.functions";
import { upsertSchluesselBestand, deleteSchluesselBestand } from "@/lib/schluesselbestand.functions";
import { createDossier, getDossier } from "@/lib/objektdossier.functions";
import { DossierAnsicht } from "@/components/objekt-dossier-view";
import { DateiEditDialog, type DateiLike } from "@/components/datei-edit-dialog";

const searchSchema = z.object({
  name: z.string().optional(),
  tn: z.string().optional(),
  anl: z.string().optional(),
  key: z.string().optional(),
  addr: z.string().optional(),
});

export const Route = createFileRoute("/_authenticated/kundenakte")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({
    meta: [
      { title: "Kundenakte — AlarmDesk" },
      { name: "description", content: "Alles zu einem Kunden an einem Ort: Dateien, Schlüssel, Objektdossier und Einsätze." },
    ],
  }),
  component: KundenaktePage,
});

const fmt = (d?: string | null) =>
  d ? new Date(d).toLocaleString("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "–";

function KundenaktePage() {
  const s = Route.useSearch();
  if (s.name || s.tn || s.anl) return <Akte k={{ name: s.name ?? "", tn: s.tn, anl: s.anl, key: s.key, addr: s.addr }} />;
  return <Suche />;
}

function Suche() {
  const navigate = useNavigate();
  const fn = useServerFn(searchKunden);
  const [q, setQ] = useState("");
  const [sub, setSub] = useState("");
  const [neu, setNeu] = useState(false);
  const { data, isFetching } = useQuery({
    queryKey: ["kundenakte-suche", sub],
    queryFn: () => fn({ data: { q: sub } }),
    enabled: !!sub,
  });
  const oeffnen = (k: KundenKennung) =>
    navigate({ to: "/kundenakte", search: { name: k.name || undefined, tn: k.tn || undefined, anl: k.anl || undefined, key: k.key || undefined, addr: k.addr || undefined } });

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-5xl">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2"><Contact className="size-6" /> Kundenakte</h1>
          <p className="text-sm text-muted-foreground">Kunde suchen und Dateien, Schlüssel, Objektdossier und Einsätze an einem Ort verwalten.</p>
        </div>
        <Button onClick={() => setNeu(true)} className="gap-2"><Plus className="size-4" /> Neuer Kunde</Button>
      </div>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); setSub(q.trim()); }}>
        <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, Adresse, Teilnehmer-, Anlagen- oder Schlüsselnummer…" />
        <Button type="submit" className="gap-2">{isFetching ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />} Suchen</Button>
      </form>
      {sub && !isFetching && (data?.treffer.length ?? 0) === 0 && (
        <p className="text-sm text-muted-foreground">Kein Kunde gefunden.</p>
      )}
      <div className="grid gap-2">
        {(data?.treffer ?? []).map((t, i) => (
          <button key={i} onClick={() => oeffnen(t)} className="text-left rounded-lg border bg-card p-3 hover:bg-accent transition">
            <div className="font-medium">{t.name}</div>
            <div className="text-xs text-muted-foreground">
              {[t.addr, t.tn && `TN ${t.tn}`, t.anl && `Anl. ${t.anl}`, t.key && `🔑 ${t.key}`].filter(Boolean).join(" · ")}
            </div>
            <div className="flex gap-2 mt-2 flex-wrap">
              <Badge variant="secondary">{t.dateien} Dateien</Badge>
              <Badge variant="secondary">{t.schluessel} Schlüssel</Badge>
              <Badge variant="secondary">{t.einsaetze} Einsätze</Badge>
              {t.dossier && <Badge>Objektdossier</Badge>}
            </div>
          </button>
        ))}
      </div>
      <NeuerKundeDialog open={neu} onOpenChange={setNeu} onDone={oeffnen} />
    </div>
  );
}

function NeuerKundeDialog({ open, onOpenChange, onDone }: { open: boolean; onOpenChange: (v: boolean) => void; onDone: (k: KundenKennung) => void }) {
  const create = useServerFn(createDossier);
  const [f, setF] = useState({ kunden_name: "", address: "", teilnehmer_id: "", anlagen_nr: "", key_number: "" });
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!f.kunden_name.trim()) return toast.error("Bitte einen Kundennamen angeben.");
    setBusy(true);
    try {
      await create({ data: { ...f, address: f.address || null, teilnehmer_id: f.teilnehmer_id || null, anlagen_nr: f.anlagen_nr || null, key_number: f.key_number || null } as any });
      toast.success("Kunde angelegt");
      onOpenChange(false);
      onDone({ name: f.kunden_name.trim(), tn: f.teilnehmer_id || null, anl: f.anlagen_nr || null, key: f.key_number || null, addr: f.address || null });
      setF({ kunden_name: "", address: "", teilnehmer_id: "", anlagen_nr: "", key_number: "" });
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Neuer Kunde</DialogTitle><DialogDescription>Danach kannst du direkt Dateien, Schlüssel und Objektinfos ergänzen.</DialogDescription></DialogHeader>
        <div className="grid gap-3">
          <Feld label="Kundenname *" v={f.kunden_name} on={(v) => setF({ ...f, kunden_name: v })} />
          <Feld label="Adresse" v={f.address} on={(v) => setF({ ...f, address: v })} />
          <div className="grid grid-cols-3 gap-2">
            <Feld label="Teilnehmer-Nr." v={f.teilnehmer_id} on={(v) => setF({ ...f, teilnehmer_id: v })} />
            <Feld label="Anlagen-Nr." v={f.anlagen_nr} on={(v) => setF({ ...f, anlagen_nr: v })} />
            <Feld label="Schlüssel-Nr." v={f.key_number} on={(v) => setF({ ...f, key_number: v })} />
          </div>
        </div>
        <DialogFooter><Button onClick={save} disabled={busy}>{busy && <Loader2 className="size-4 animate-spin mr-2" />}Anlegen</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Feld({ label, v, on }: { label: string; v: string; on: (v: string) => void }) {
  return <div className="grid gap-1"><Label>{label}</Label><Input value={v} onChange={(e) => on(e.target.value)} maxLength={200} /></div>;
}

function Akte({ k }: { k: KundenKennung }) {
  const fn = useServerFn(getKundenakte);
  const qc = useQueryClient();
  const qk = ["kundenakte", k];
  const { data, isLoading, error } = useQuery({ queryKey: qk, queryFn: () => fn({ data: k as any }) });
  const refresh = () => qc.invalidateQueries({ queryKey: ["kundenakte"] });

  if (isLoading) return <div className="p-6 flex items-center gap-2 text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Kundenakte wird geladen…</div>;
  if (error || !data) return <div className="p-6 text-destructive">{(error as any)?.message ?? "Fehler beim Laden"}</div>;
  const { kopf } = data;

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-6xl">
      <Link to="/kundenakte" search={{}} className="text-sm text-muted-foreground inline-flex items-center gap-1 hover:text-foreground"><ArrowLeft className="size-4" /> Zur Suche</Link>
      <div className="rounded-xl border bg-card p-4">
        <h1 className="text-2xl font-semibold">{kopf.name || "(ohne Namen)"}</h1>
        <div className="text-sm text-muted-foreground mt-1">
          {[kopf.addr, kopf.tn && `Teilnehmer-Nr. ${kopf.tn}`, kopf.anl && `Anlagen-Nr. ${kopf.anl}`, kopf.key && `Schlüssel-Nr. ${kopf.key}`].filter(Boolean).join(" · ") || "Keine weiteren Angaben"}
        </div>
        {kopf.hinweise.length > 0 && (
          <div className="mt-3 rounded-md bg-muted p-2 text-sm space-y-1">
            {kopf.hinweise.map((h, i) => <div key={i}>ℹ️ {h}</div>)}
          </div>
        )}
      </div>

      <Tabs defaultValue="uebersicht">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="uebersicht">Übersicht</TabsTrigger>
          <TabsTrigger value="dateien">Dateien ({data.dateien.length})</TabsTrigger>
          <TabsTrigger value="schluessel">Schlüssel ({data.schluessel.length})</TabsTrigger>
          <TabsTrigger value="dossier">Objektdossier</TabsTrigger>
          <TabsTrigger value="einsaetze">Einsätze ({data.einsaetze.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="uebersicht">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Kachel icon={FolderOpen} label="Dateien" wert={data.dateien.length} />
            <Kachel icon={KeyRound} label="Schlüssel" wert={data.schluessel.length} />
            <Kachel icon={DoorOpen} label="Objektdossier" wert={data.dossier ? "vorhanden" : "fehlt"} />
            <Kachel icon={Truck} label="Einsätze" wert={data.einsaetze.length} />
          </div>
          <p className="text-sm text-muted-foreground mt-3">Letzter Einsatz: {fmt(data.einsaetze[0]?.created_at)}</p>
        </TabsContent>

        <TabsContent value="dateien"><DateienTab kopf={kopf} dateien={data.dateien} refresh={refresh} /></TabsContent>
        <TabsContent value="schluessel"><SchluesselTab kopf={kopf} data={data} refresh={refresh} /></TabsContent>
        <TabsContent value="dossier"><DossierTab kopf={kopf} dossier={data.dossier} refresh={refresh} /></TabsContent>
        <TabsContent value="einsaetze">
          <div className="grid gap-2">
            {data.einsaetze.length === 0 && <p className="text-sm text-muted-foreground">Noch keine Einsätze.</p>}
            {data.einsaetze.map((e: any) => (
              <div key={e.id} className="rounded-lg border p-3 flex justify-between gap-2 flex-wrap">
                <div>
                  <div className="font-medium">{e.einsatzgrund}</div>
                  <div className="text-xs text-muted-foreground">{fmt(e.created_at)}{e.assigned_to ? ` · Fahrer: ${data.fahrer[e.assigned_to] ?? "–"}` : ""}</div>
                </div>
                <Badge variant="outline">{e.status}</Badge>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Kachel({ icon: Icon, label, wert }: { icon: any; label: string; wert: any }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="text-xs text-muted-foreground flex items-center gap-1"><Icon className="size-4" /> {label}</div>
      <div className="text-xl font-semibold mt-1">{wert}</div>
    </div>
  );
}

function DateienTab({ kopf, dateien, refresh }: { kopf: any; dateien: any[]; refresh: () => void }) {
  const sign = useServerFn(getDateiSignedUrl);
  const del = useServerFn(softDeleteDatei);
  const create = useServerFn(createDatei);
  const [edit, setEdit] = useState<DateiLike | null>(null);
  const [busy, setBusy] = useState(false);
  const [ordner, setOrdner] = useState("");

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Nicht angemeldet");
      for (const file of Array.from(files)) {
        const ext = file.name.split(".").pop() ?? "bin";
        const path = `${user.id}/${safeUUID()}.${ext}`;
        const up = await supabase.storage.from("dateien").upload(path, file, { contentType: file.type || "application/octet-stream" });
        if (up.error) throw up.error;
        await create({ data: {
          filename: file.name, storage_path: path, mime_type: file.type || null, size_bytes: file.size,
          kunden_name: kopf.name || null, address: kopf.addr || null, key_number: kopf.key || null,
          teilnehmer_id: kopf.tn || null, anlagen_nr: kopf.anl || null, folder: ordner || null,
        } });
      }
      toast.success("Hochgeladen");
      refresh();
    } catch (e: any) { toast.error(e.message ?? "Upload fehlgeschlagen"); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2 items-end flex-wrap">
        <div className="grid gap-1"><Label>Ordner (optional)</Label><Input value={ordner} onChange={(e) => setOrdner(e.target.value)} className="w-48" /></div>
        <Button asChild disabled={busy} className="gap-2">
          <label className="cursor-pointer">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />} Dateien hochladen
            <input type="file" multiple className="hidden" onChange={(e) => { upload(e.target.files); e.target.value = ""; }} />
          </label>
        </Button>
      </div>
      {dateien.length === 0 && <p className="text-sm text-muted-foreground">Noch keine Dateien.</p>}
      <div className="grid gap-2">
        {dateien.map((d) => (
          <div key={d.id} className="rounded-lg border p-3 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="font-medium truncate">{d.filename}</div>
              <div className="text-xs text-muted-foreground">{[d.folder, fmt(d.created_at), d.notiz].filter(Boolean).join(" · ")}</div>
            </div>
            <div className="flex gap-1 shrink-0">
              {d.storage_path && (
                <Button size="sm" variant="ghost" title="Öffnen" onClick={async () => {
                  try { const { url } = await sign({ data: { storage_path: d.storage_path } }); window.open(url, "_blank"); }
                  catch (e: any) { toast.error(e.message); }
                }}><Download className="size-4" /></Button>
              )}
              <Button size="sm" variant="ghost" title="Bearbeiten" onClick={() => setEdit(d)}><Pencil className="size-4" /></Button>
              <Button size="sm" variant="ghost" title="Löschen" onClick={async () => {
                if (!confirm("Diese Datei wirklich löschen?")) return;
                try { await del({ data: { id: d.id } }); toast.success("Gelöscht"); refresh(); } catch (e: any) { toast.error(e.message); }
              }}><Trash2 className="size-4 text-destructive" /></Button>
            </div>
          </div>
        ))}
      </div>
      {edit && <DateiEditDialog datei={edit} onClose={() => setEdit(null)} onDone={() => { setEdit(null); refresh(); }} />}
    </div>
  );
}

const LEER_S = { id: "", key_number: "", kategorie: "AZ", bezeichnung: "", schrank: "", fach: "", anzahl_soll: 1, notiz: "" };

function SchluesselTab({ kopf, data, refresh }: { kopf: any; data: any; refresh: () => void }) {
  const upsert = useServerFn(upsertSchluesselBestand);
  const del = useServerFn(deleteSchluesselBestand);
  const [form, setForm] = useState<typeof LEER_S | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!form?.key_number.trim()) return toast.error("Schlüsselnummer fehlt.");
    setBusy(true);
    try {
      await upsert({ data: {
        id: form.id || undefined, key_number: form.key_number.trim(), kategorie: form.kategorie as any,
        bezeichnung: form.bezeichnung || null, schrank: form.schrank || null, fach: form.fach || null,
        anzahl_soll: Number(form.anzahl_soll) || 1, notiz: form.notiz || null,
        kunden_name: kopf.name || null, address: kopf.addr || null,
      } as any });
      toast.success("Gespeichert"); setForm(null); refresh();
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-5">
      <div>
        <div className="flex justify-between items-center mb-2">
          <h3 className="font-semibold">Schlüsselbestand</h3>
          <Button size="sm" className="gap-2" onClick={() => setForm({ ...LEER_S, key_number: kopf.key ?? "" })}><Plus className="size-4" /> Schlüssel anlegen</Button>
        </div>
        {data.schluessel.length === 0 && <p className="text-sm text-muted-foreground">Kein Schlüssel hinterlegt.</p>}
        <div className="grid gap-2">
          {data.schluessel.map((s: any) => (
            <div key={s.id} className="rounded-lg border p-3 flex justify-between gap-2">
              <div>
                <div className="font-medium">🔑 {s.key_number} <Badge variant="outline" className="ml-1">{s.kategorie}</Badge></div>
                <div className="text-xs text-muted-foreground">{[s.bezeichnung, s.schrank && `Schrank ${s.schrank}`, s.fach && `Fach ${s.fach}`, `${s.anzahl_soll} Stück`, s.notiz].filter(Boolean).join(" · ")}</div>
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => setForm({ id: s.id, key_number: s.key_number, kategorie: s.kategorie, bezeichnung: s.bezeichnung ?? "", schrank: s.schrank ?? "", fach: s.fach ?? "", anzahl_soll: s.anzahl_soll, notiz: s.notiz ?? "" })}><Pencil className="size-4" /></Button>
                <Button size="sm" variant="ghost" onClick={async () => {
                  if (!confirm("Schlüssel aus dem Bestand löschen?")) return;
                  try { await del({ data: { id: s.id } }); refresh(); } catch (e: any) { toast.error(e.message); }
                }}><Trash2 className="size-4 text-destructive" /></Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="font-semibold mb-2">Schlüsselbuch</h3>
        {data.schluesselbuch.length === 0 && <p className="text-sm text-muted-foreground">Keine Ausgaben erfasst.</p>}
        <div className="grid gap-1">
          {data.schluesselbuch.map((b: any) => (
            <div key={b.id} className="text-sm rounded border px-3 py-2 flex justify-between gap-2">
              <span>🔑 {b.key_number} · {b.traeger_name}</span>
              <span className="text-muted-foreground">{fmt(b.ausgegeben_at)} · {b.status}</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="flex justify-between items-center mb-2">
          <h3 className="font-semibold">Übergabeprotokolle</h3>
          <Button size="sm" variant="outline" asChild><Link to="/schluesseluebergabe">Zur Schlüsselübergabe</Link></Button>
        </div>
        {data.protokolle.length === 0 && <p className="text-sm text-muted-foreground">Keine Protokolle.</p>}
        <div className="grid gap-1">
          {data.protokolle.map((p: any) => (
            <div key={p.id} className="text-sm rounded border px-3 py-2 flex justify-between gap-2">
              <span>Nr. {p.protokoll_nr} · {p.richtung}</span>
              <span className="text-muted-foreground">{fmt(p.created_at)}</span>
            </div>
          ))}
        </div>
      </div>

      <Dialog open={!!form} onOpenChange={(v) => !v && setForm(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{form?.id ? "Schlüssel bearbeiten" : "Schlüssel anlegen"}</DialogTitle><DialogDescription>Für {kopf.name}</DialogDescription></DialogHeader>
          {form && (
            <div className="grid gap-3">
              <div className="grid grid-cols-2 gap-2">
                <Feld label="Schlüssel-Nr. *" v={form.key_number} on={(v) => setForm({ ...form, key_number: v })} />
                <div className="grid gap-1"><Label>Kategorie</Label>
                  <Select value={form.kategorie} onValueChange={(v) => setForm({ ...form, kategorie: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{["AZ", "Malteser", "LüWa", "Sonstige"].map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <Feld label="Bezeichnung" v={form.bezeichnung} on={(v) => setForm({ ...form, bezeichnung: v })} />
              <div className="grid grid-cols-3 gap-2">
                <Feld label="Schrank" v={form.schrank} on={(v) => setForm({ ...form, schrank: v })} />
                <Feld label="Fach" v={form.fach} on={(v) => setForm({ ...form, fach: v })} />
                <Feld label="Anzahl" v={String(form.anzahl_soll)} on={(v) => setForm({ ...form, anzahl_soll: Number(v) || 0 })} />
              </div>
              <div className="grid gap-1"><Label>Notiz</Label><Textarea value={form.notiz} onChange={(e) => setForm({ ...form, notiz: e.target.value })} /></div>
            </div>
          )}
          <DialogFooter><Button onClick={save} disabled={busy}>Speichern</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DossierTab({ kopf, dossier, refresh }: { kopf: any; dossier: any; refresh: () => void }) {
  const create = useServerFn(createDossier);
  const get = useServerFn(getDossier);
  const navigate = useNavigate();
  const { data } = useQuery({
    queryKey: ["kundenakte-dossier", dossier?.id],
    queryFn: () => get({ data: { id: dossier.id } }),
    enabled: !!dossier?.id,
  });
  if (!dossier) {
    return (
      <div className="rounded-lg border p-4 space-y-2">
        <p className="text-sm text-muted-foreground">Für diesen Kunden gibt es noch kein Objektdossier.</p>
        <Button className="gap-2" onClick={async () => {
          try {
            const r = await create({ data: { kunden_name: kopf.name, address: kopf.addr, teilnehmer_id: kopf.tn, anlagen_nr: kopf.anl, key_number: kopf.key } as any });
            refresh();
            navigate({ to: "/objektdossier/$dossierId", params: { dossierId: r.dossier.id } });
          } catch (e: any) { toast.error(e.message); }
        }}><Plus className="size-4" /> Objektdossier anlegen</Button>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button asChild className="gap-2"><Link to="/objektdossier/$dossierId" params={{ dossierId: dossier.id }}><Pencil className="size-4" /> Bearbeiten & Kontakte</Link></Button>
      </div>
      {data ? <DossierAnsicht dossier={(data as any).dossier} kontakte={(data as any).kontakte} /> : <Loader2 className="size-4 animate-spin" />}
    </div>
  );
}

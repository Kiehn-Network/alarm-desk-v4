import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Nfc, Plus, Search, Loader2, Trash2, Pencil, Inbox, ShieldCheck, ExternalLink, PackageOpen } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  listFindo, saveAnhaenger, deleteAnhaenger, createMeldungIntern, updateMeldung, deleteMeldung,
  FINDO_PAKETE, ANHAENGER_STATUS, FUND_STATUS, FUND_WEGE, fidAnzeige,
} from "@/lib/findo.functions";

export const Route = createFileRoute("/_authenticated/findo-id")({
  head: () => ({
    meta: [
      { title: "Findo-ID – AlarmDesk" },
      { name: "description", content: "Findo-ID Schlüsselanhänger, Fundmeldungen und Rückführung verwalten." },
      { property: "og:title", content: "Findo-ID" },
      { property: "og:description", content: "Verlorene Schlüssel über die Alarmzentrale zurückführen." },
    ],
  }),
  component: FindoPage,
});

const lbl = (list: readonly { value: string; label: string }[], v: string) => list.find((x) => x.value === v)?.label ?? v;
const fmt = (s: string) => new Date(s).toLocaleString("de-DE", { timeZone: "Europe/Berlin", dateStyle: "short", timeStyle: "short" });
const OFFEN = ["gemeldet", "erwartet", "eingegangen", "informiert"];
const FUND_CLS: Record<string, string> = {
  gemeldet: "bg-destructive/15 text-destructive",
  erwartet: "bg-accent text-accent-foreground",
  eingegangen: "bg-primary/15 text-primary",
  informiert: "bg-primary/15 text-primary",
  zurueckgegeben: "bg-muted text-muted-foreground",
  abgeschlossen: "bg-muted text-muted-foreground",
};

type A = any;
const leer = { fid: "", besitzer_name: "", besitzer_telefon: "", besitzer_email: "", besitzer_adresse: "", paket: "basis", ersatz_lagerort: "", status: "aktiv", notizen: "" };

function FindoPage() {
  const qc = useQueryClient();
  const list = useServerFn(listFindo);
  const save = useServerFn(saveAnhaenger);
  const delA = useServerFn(deleteAnhaenger);
  const neuM = useServerFn(createMeldungIntern);
  const updM = useServerFn(updateMeldung);
  const delM = useServerFn(deleteMeldung);
  const q = useQuery({ queryKey: ["findo"], queryFn: () => list() });
  const reload = () => qc.invalidateQueries({ queryKey: ["findo"] });

  const [suche, setSuche] = useState("");
  const [edit, setEdit] = useState<(typeof leer & { id?: string }) | null>(null);
  const [eingang, setEingang] = useState<{ fid: string; weg: string; finder_name: string; finder_kontakt: string; fundort: string; nachricht: string } | null>(null);
  const [fall, setFall] = useState<{ id: string; status: string; notizen: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const anh: A[] = q.data?.anhaenger ?? [];
  const mel: A[] = q.data?.meldungen ?? [];
  const byId = useMemo(() => new Map(anh.map((a) => [a.id, a])), [anh]);
  const offen = mel.filter((m) => OFFEN.includes(m.status));
  const t = suche.trim().toLowerCase();
  const gefiltert = anh.filter((a) => !t || [a.fid, fidAnzeige(a.fid), a.besitzer_name, a.besitzer_telefon, a.besitzer_email].some((v) => String(v ?? "").toLowerCase().includes(t)));

  async function run(fn: () => Promise<unknown>, ok: string, close: () => void) {
    setBusy(true);
    try { await fn(); toast.success(ok); close(); reload(); } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold"><Nfc className="h-6 w-6 text-primary" /> Findo-ID</h1>
          <p className="text-sm text-muted-foreground">Schlüsselanhänger mit Chip-UID – Funde annehmen, Besitzer zuordnen, Rückgabe abstimmen.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild><a href="/findo" target="_blank" rel="noreferrer"><ExternalLink className="mr-2 h-4 w-4" />Fundseite für Finder</a></Button>
          <Button variant="outline" onClick={() => setEingang({ fid: "", weg: "post", finder_name: "", finder_kontakt: "", fundort: "", nachricht: "" })}><PackageOpen className="mr-2 h-4 w-4" />Eingang erfassen</Button>
          <Button onClick={() => setEdit({ ...leer })}><Plus className="mr-2 h-4 w-4" />Neuer Anhänger</Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        {[
          ["Anhänger", anh.length],
          ["Protect-Kunden", anh.filter((a) => a.paket === "protect").length],
          ["Offene Funde", offen.length],
          ["Zurückgegeben", mel.filter((m) => m.status === "zurueckgegeben").length],
        ].map(([k, v]) => (
          <div key={k as string} className="rounded-lg border bg-card p-4"><div className="text-xs text-muted-foreground">{k}</div><div className="text-2xl font-semibold">{v}</div></div>
        ))}
      </div>

      {q.isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : (
        <Tabs defaultValue={offen.length ? "funde" : "anhaenger"}>
          <TabsList>
            <TabsTrigger value="funde"><Inbox className="mr-2 h-4 w-4" />Fundmeldungen {offen.length > 0 && <Badge className="ml-2">{offen.length}</Badge>}</TabsTrigger>
            <TabsTrigger value="anhaenger"><Nfc className="mr-2 h-4 w-4" />Anhänger</TabsTrigger>
          </TabsList>

          <TabsContent value="funde" className="space-y-2">
            {mel.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Noch keine Fundmeldungen.</p>}
            {mel.map((m) => {
              const a = byId.get(m.anhaenger_id);
              return (
                <div key={m.id} className="flex flex-wrap items-start justify-between gap-3 rounded-lg border bg-card p-4">
                  <div className="space-y-1 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono font-medium">{a ? fidAnzeige(a.fid) : "?"}</span>
                      <span className={`rounded px-2 py-0.5 text-xs ${FUND_CLS[m.status] ?? ""}`}>{lbl(FUND_STATUS, m.status)}</span>
                      <Badge variant="outline">{lbl(FUND_WEGE, m.weg)}</Badge>
                      {a?.paket === "protect" && <Badge variant="secondary"><ShieldCheck className="mr-1 h-3 w-3" />Protect</Badge>}
                    </div>
                    <div><b>Besitzer:</b> {a?.besitzer_name ?? "–"} {a?.besitzer_telefon && <a className="text-primary underline" href={`tel:${a.besitzer_telefon}`}>{a.besitzer_telefon}</a>}</div>
                    {a?.paket === "protect" && a.ersatz_lagerort && <div><b>Ersatzschlüssel:</b> {a.ersatz_lagerort}</div>}
                    {(m.finder_name || m.finder_kontakt) && <div><b>Finder:</b> {[m.finder_name, m.finder_kontakt].filter(Boolean).join(" · ")}</div>}
                    {m.fundort && <div><b>Fundort:</b> {m.fundort}</div>}
                    {m.nachricht && <div className="text-muted-foreground">„{m.nachricht}"</div>}
                    {m.notizen && <div className="text-muted-foreground"><b>Notiz:</b> {m.notizen}</div>}
                    <div className="text-xs text-muted-foreground">{fmt(m.created_at)}{m.bearbeitet_von_name && ` · bearbeitet von ${m.bearbeitet_von_name}`}</div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => setFall({ id: m.id, status: m.status, notizen: m.notizen ?? "" })}>Bearbeiten</Button>
                    <Button size="icon" variant="ghost" onClick={() => confirm("Fundmeldung löschen?") && run(() => delM({ data: { id: m.id } }), "Gelöscht", () => {})}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
              );
            })}
          </TabsContent>

          <TabsContent value="anhaenger" className="space-y-3">
            <div className="relative max-w-sm"><Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-8" placeholder="FID, Name, Telefon…" value={suche} onChange={(e) => setSuche(e.target.value)} /></div>
            {gefiltert.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Keine Anhänger gefunden.</p>}
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {gefiltert.map((a) => (
                <div key={a.id} className="rounded-lg border bg-card p-4 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono font-medium">{fidAnzeige(a.fid)}</span>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => setEdit({ ...leer, ...Object.fromEntries(Object.entries(a).map(([k, v]) => [k, v ?? ""])) } as any)}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => confirm("Anhänger und alle Fundmeldungen löschen?") && run(() => delA({ data: { id: a.id } }), "Gelöscht", () => {})}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>
                  <div className="font-medium">{a.besitzer_name}</div>
                  <div className="text-muted-foreground">{[a.besitzer_telefon, a.besitzer_email].filter(Boolean).join(" · ")}</div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    <Badge variant={a.paket === "protect" ? "default" : "secondary"}>{lbl(FINDO_PAKETE, a.paket)}</Badge>
                    <Badge variant={a.status === "verloren" ? "destructive" : "outline"}>{lbl(ANHAENGER_STATUS, a.status)}</Badge>
                  </div>
                  {a.paket === "protect" && a.ersatz_lagerort && <div className="mt-1 text-xs text-muted-foreground">Ersatzschlüssel: {a.ersatz_lagerort}</div>}
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      )}

      {/* Anhänger anlegen/bearbeiten */}
      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{edit?.id ? "Anhänger bearbeiten" : "Neuer Findo-ID Anhänger"}</DialogTitle><DialogDescription>Die FID / Chip-UID steht auf der Rückseite des Anhängers.</DialogDescription></DialogHeader>
          {edit && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2"><Label>FID / UID *</Label><Input className="font-mono" placeholder="04 A8 7C 92 6F 13 80" value={edit.fid} onChange={(e) => setEdit({ ...edit, fid: e.target.value })} /></div>
              <div><Label>Besitzer *</Label><Input value={edit.besitzer_name} onChange={(e) => setEdit({ ...edit, besitzer_name: e.target.value })} /></div>
              <div><Label>Telefon</Label><Input value={edit.besitzer_telefon} onChange={(e) => setEdit({ ...edit, besitzer_telefon: e.target.value })} /></div>
              <div><Label>E-Mail</Label><Input value={edit.besitzer_email} onChange={(e) => setEdit({ ...edit, besitzer_email: e.target.value })} /></div>
              <div><Label>Adresse</Label><Input value={edit.besitzer_adresse} onChange={(e) => setEdit({ ...edit, besitzer_adresse: e.target.value })} /></div>
              <div><Label>Paket</Label>
                <Select value={edit.paket} onValueChange={(v) => setEdit({ ...edit, paket: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{FINDO_PAKETE.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent></Select>
              </div>
              <div><Label>Status</Label>
                <Select value={edit.status} onValueChange={(v) => setEdit({ ...edit, status: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{ANHAENGER_STATUS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent></Select>
              </div>
              {edit.paket === "protect" && (
                <div className="sm:col-span-2"><Label>Lagerort Ersatzschlüssel</Label><Input placeholder="z. B. Tresor 2, Fach 14 (ohne Namen am Schlüssel)" value={edit.ersatz_lagerort} onChange={(e) => setEdit({ ...edit, ersatz_lagerort: e.target.value })} /></div>
              )}
              <div className="sm:col-span-2"><Label>Notizen</Label><Textarea value={edit.notizen} onChange={(e) => setEdit({ ...edit, notizen: e.target.value })} /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEdit(null)}>Abbrechen</Button>
            <Button disabled={busy || !edit?.fid || !edit?.besitzer_name} onClick={() => edit && run(() => save({ data: { ...edit, id: edit.id || null } }), "Gespeichert", () => setEdit(null))}>Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Eingang erfassen */}
      <Dialog open={!!eingang} onOpenChange={(o) => !o && setEingang(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Eingang erfassen</DialogTitle><DialogDescription>Schlüssel kam per Post oder wurde abgegeben.</DialogDescription></DialogHeader>
          {eingang && (
            <div className="space-y-3">
              <div><Label>FID / UID *</Label><Input className="font-mono" value={eingang.fid} onChange={(e) => setEingang({ ...eingang, fid: e.target.value })} /></div>
              <div><Label>Weg</Label>
                <Select value={eingang.weg} onValueChange={(v) => setEingang({ ...eingang, weg: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{FUND_WEGE.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent></Select>
              </div>
              <div><Label>Finder (optional)</Label><Input value={eingang.finder_name} onChange={(e) => setEingang({ ...eingang, finder_name: e.target.value })} /></div>
              <div><Label>Notiz</Label><Textarea value={eingang.nachricht} onChange={(e) => setEingang({ ...eingang, nachricht: e.target.value })} /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEingang(null)}>Abbrechen</Button>
            <Button disabled={busy || !eingang?.fid} onClick={() => eingang && run(() => neuM({ data: eingang }), "Eingang erfasst", () => setEingang(null))}>Erfassen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Fall bearbeiten */}
      <Dialog open={!!fall} onOpenChange={(o) => !o && setFall(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Fundmeldung bearbeiten</DialogTitle></DialogHeader>
          {fall && (
            <div className="space-y-3">
              <div><Label>Status</Label>
                <Select value={fall.status} onValueChange={(v) => setFall({ ...fall, status: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{FUND_STATUS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent></Select>
              </div>
              <div><Label>Notiz (z. B. Identität geprüft, Abholung vereinbart)</Label><Textarea value={fall.notizen} onChange={(e) => setFall({ ...fall, notizen: e.target.value })} /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setFall(null)}>Abbrechen</Button>
            <Button disabled={busy} onClick={() => fall && run(() => updM({ data: fall }), "Gespeichert", () => setFall(null))}>Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Shirt, Plus, Search, Loader2, Trash2, Pencil, Undo2, CalendarClock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  listKleidung, saveArtikel, deleteArtikel, saveAusgabe, rueckgabeAusgabe, deleteAusgabe, heuteBerlin,
  KLEIDUNG_KATEGORIEN, KLEIDUNG_ZUSTAEND,
} from "@/lib/dienstkleidung.functions";

export const Route = createFileRoute("/_authenticated/dienstkleidung")({
  head: () => ({
    meta: [
      { title: "Dienstkleidung – AlarmDesk" },
      { name: "description", content: "Ausgabe von Dienstkleidung mit Größe und Zustand, Rückgabe und Fälligkeit, Verbleib je Mitarbeiter." },
      { property: "og:title", content: "Dienstkleidung" },
      { property: "og:description", content: "Dienstkleidung ausgeben, zurücknehmen und den Verbleib je Mitarbeiter verfolgen." },
    ],
  }),
  component: KleidungPage,
});

const lbl = (list: readonly { value: string; label: string }[], v: string) => list.find((x) => x.value === v)?.label ?? v;
const datum = (s: string | null) => (s ? new Date(s + "T12:00:00Z").toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" }) : "–");
const ZUSTAND_CLS: Record<string, string> = {
  neu: "bg-primary/15 text-primary",
  getragen: "bg-accent text-accent-foreground",
  abgenutzt: "bg-muted text-muted-foreground",
  defekt: "bg-destructive/15 text-destructive",
};

type A = any;
const leerAusgabe = { id: undefined as string | undefined, artikel_id: "", mitarbeiter_id: "", groesse: "", zustand: "neu", ausgegeben_am: "", rueckgabe_faellig: "", notizen: "" };
const leerArtikel = { id: undefined as string | undefined, name: "", kategorie: "poloshirt", groessen: "", notizen: "" };

function KleidungPage() {
  const qc = useQueryClient();
  const list = useServerFn(listKleidung);
  const saveA = useServerFn(saveArtikel);
  const delA = useServerFn(deleteArtikel);
  const saveG = useServerFn(saveAusgabe);
  const zurueck = useServerFn(rueckgabeAusgabe);
  const delG = useServerFn(deleteAusgabe);
  const q = useQuery({ queryKey: ["dienstkleidung"], queryFn: () => list() });
  const reload = () => qc.invalidateQueries({ queryKey: ["dienstkleidung"] });

  const [suche, setSuche] = useState("");
  const [editG, setEditG] = useState<typeof leerAusgabe | null>(null);
  const [editA, setEditA] = useState<typeof leerArtikel | null>(null);
  const [rueckG, setRueckG] = useState<{ id: string; name: string; zurueckgegeben_am: string; rueckgabe_zustand: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const artikel: A[] = q.data?.artikel ?? [];
  const ausgaben: A[] = q.data?.ausgaben ?? [];
  const mitarbeiter: A[] = q.data?.mitarbeiter ?? [];
  const artById = useMemo(() => new Map(artikel.map((a) => [a.id, a])), [artikel]);

  const offen = ausgaben.filter((g) => !g.zurueckgegeben_am);
  const ueberfaellig = offen.filter((g) => g.ueberfaellig);
  const t = suche.trim().toLowerCase();
  const gefiltert = ausgaben.filter((g) => {
    if (!t) return true;
    const a = artById.get(g.artikel_id);
    return [g.mitarbeiter_name, a?.name, a?.kategorie, g.groesse, g.notizen].some((v) => String(v ?? "").toLowerCase().includes(t));
  });

  async function run(fn: () => Promise<unknown>, ok: string, close: () => void) {
    setBusy(true);
    try { await fn(); toast.success(ok); close(); reload(); } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold"><Shirt className="h-6 w-6 text-primary" /> Dienstkleidung</h1>
          <p className="text-sm text-muted-foreground">Kleidung mit Größe und Zustand ausgeben, Rückgabe im Blick behalten, Verbleib je Mitarbeiter sehen.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setEditA({ ...leerArtikel })}><Plus className="mr-2 h-4 w-4" />Kleidungsart</Button>
          <Button onClick={() => setEditG({ ...leerAusgabe, ausgegeben_am: heuteBerlin() })}><Plus className="mr-2 h-4 w-4" />Neue Ausgabe</Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        {[
          ["Ausgegebene Teile", ausgaben.filter((g) => !g.zurueckgegeben_am).length],
          ["Offene Rückgaben", offen.filter((g) => g.rueckgabe_faellig).length],
          ["Überfällig", ueberfaellig.length],
          ["Mitarbeiter mit Kleidung", new Set(offen.map((g) => g.mitarbeiter_id)).size],
        ].map(([k, v]) => (
          <div key={k as string} className="rounded-lg border bg-card p-4">
            <div className="text-xs text-muted-foreground">{k}</div>
            <div className={`text-2xl font-semibold ${k === "Überfällig" && (v as number) > 0 ? "text-destructive" : ""}`}>{v}</div>
          </div>
        ))}
      </div>

      {q.isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : (
        <Tabs defaultValue="ausgaben">
          <TabsList>
            <TabsTrigger value="ausgaben"><Shirt className="mr-2 h-4 w-4" />Ausgaben {ueberfaellig.length > 0 && <Badge variant="destructive" className="ml-2">{ueberfaellig.length} überfällig</Badge>}</TabsTrigger>
            <TabsTrigger value="arten"><CalendarClock className="mr-2 h-4 w-4" />Kleidungsarten</TabsTrigger>
          </TabsList>

          <TabsContent value="ausgaben" className="space-y-3">
            <div className="relative max-w-sm"><Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-8" placeholder="Mitarbeiter, Kleidung, Größe…" value={suche} onChange={(e) => setSuche(e.target.value)} /></div>
            {gefiltert.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Noch keine Ausgaben erfasst.</p>}
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {gefiltert.map((g) => {
                const a = artById.get(g.artikel_id);
                return (
                  <div key={g.id} className={`rounded-lg border bg-card p-4 text-sm ${g.ueberfaellig ? "border-destructive/50" : ""}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-medium">{a?.name ?? "Gelöschte Kleidungsart"}</div>
                        <div className="text-muted-foreground">{a ? lbl(KLEIDUNG_KATEGORIEN, a.kategorie) : ""}</div>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        {!g.zurueckgegeben_am && (
                          <Button size="icon" variant="ghost" title="Zurücknehmen" onClick={() => setRueckG({ id: g.id, name: `${a?.name ?? "Kleidung"} · ${g.mitarbeiter_name}`, zurueckgegeben_am: heuteBerlin(), rueckgabe_zustand: g.zustand })}><Undo2 className="h-4 w-4" /></Button>
                        )}
                        <Button size="icon" variant="ghost" onClick={() => setEditG({
                          id: g.id, artikel_id: g.artikel_id, mitarbeiter_id: g.mitarbeiter_id,
                          groesse: g.groesse ?? "", zustand: g.zustand, ausgegeben_am: g.ausgegeben_am,
                          rueckgabe_faellig: g.rueckgabe_faellig ?? "", notizen: g.notizen ?? "",
                        })}><Pencil className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => confirm("Ausgabe löschen?") && run(() => delG({ data: { id: g.id } }), "Gelöscht", () => {})}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </div>
                    <div className="mt-2"><b>Mitarbeiter:</b> {g.mitarbeiter_name}</div>
                    <div className="flex flex-wrap gap-1">
                      {g.groesse && <Badge variant="outline">Größe {g.groesse}</Badge>}
                      <Badge variant="outline" className={ZUSTAND_CLS[g.zustand] ?? ""}>{lbl(KLEIDUNG_ZUSTAEND, g.zustand)}</Badge>
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      Ausgegeben: {datum(g.ausgegeben_am)}
                      {g.rueckgabe_faellig && <> · Rückgabe fällig: {datum(g.rueckgabe_faellig)}{g.ueberfaellig && <span className="ml-1 font-semibold text-destructive">überfällig</span>}</>}
                    </div>
                    {g.zurueckgegeben_am ? (
                      <div className="mt-1 text-xs text-muted-foreground">Zurück am {datum(g.zurueckgegeben_am)} · Zustand: {lbl(KLEIDUNG_ZUSTAEND, g.rueckgabe_zustand ?? g.zustand)}</div>
                    ) : g.notizen && <div className="mt-1 text-xs text-muted-foreground">{g.notizen}</div>}
                  </div>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="arten" className="space-y-3">
            {artikel.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Noch keine Kleidungsarten angelegt.</p>}
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {artikel.map((a) => {
                const offenAnz = ausgaben.filter((g) => g.artikel_id === a.id && !g.zurueckgegeben_am).length;
                return (
                  <div key={a.id} className="rounded-lg border bg-card p-4 text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-medium">{a.name}</div>
                        <div className="text-muted-foreground">{lbl(KLEIDUNG_KATEGORIEN, a.kategorie)}</div>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <Button size="icon" variant="ghost" onClick={() => setEditA({ id: a.id, name: a.name, kategorie: a.kategorie, groessen: a.groessen ?? "", notizen: a.notizen ?? "" })}><Pencil className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => confirm(`„${a.name}" und alle zugehörigen Ausgaben löschen?`) && run(() => delA({ data: { id: a.id } }), "Gelöscht", () => {})}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </div>
                    {a.groessen && <div className="mt-2 text-xs text-muted-foreground">Größen: {a.groessen}</div>}
                    <div className="mt-2"><Badge variant={offenAnz > 0 ? "default" : "secondary"}>{offenAnz} im Umlauf</Badge></div>
                    {a.notizen && <div className="mt-1 text-xs text-muted-foreground">{a.notizen}</div>}
                  </div>
                );
              })}
            </div>
          </TabsContent>
        </Tabs>
      )}

      {/* Ausgabe anlegen/bearbeiten */}
      <Dialog open={!!editG} onOpenChange={(o) => !o && setEditG(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editG?.id ? "Ausgabe bearbeiten" : "Kleidung ausgeben"}</DialogTitle><DialogDescription>Größe und Zustand festhalten, damit der Verbleib klar ist.</DialogDescription></DialogHeader>
          {editG && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div><Label>Kleidungsart *</Label>
                <Select value={editG.artikel_id || undefined} onValueChange={(v) => setEditG({ ...editG, artikel_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Wählen…" /></SelectTrigger>
                  <SelectContent>{artikel.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Mitarbeiter *</Label>
                <Select value={editG.mitarbeiter_id || undefined} onValueChange={(v) => setEditG({ ...editG, mitarbeiter_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Wählen…" /></SelectTrigger>
                  <SelectContent>{mitarbeiter.map((m) => <SelectItem key={m.id} value={m.id}>{m.display_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Größe</Label><Input placeholder="z. B. M, 52/54, 42" value={editG.groesse} onChange={(e) => setEditG({ ...editG, groesse: e.target.value })} /></div>
              <div><Label>Zustand bei Ausgabe</Label>
                <Select value={editG.zustand} onValueChange={(v) => setEditG({ ...editG, zustand: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{KLEIDUNG_ZUSTAEND.map((z) => <SelectItem key={z.value} value={z.value}>{z.label}</SelectItem>)}</SelectContent></Select>
              </div>
              <div><Label>Ausgegeben am *</Label><Input type="date" value={editG.ausgegeben_am} onChange={(e) => setEditG({ ...editG, ausgegeben_am: e.target.value })} /></div>
              <div><Label>Rückgabe fällig am</Label><Input type="date" value={editG.rueckgabe_faellig} onChange={(e) => setEditG({ ...editG, rueckgabe_faellig: e.target.value })} /></div>
              <div className="sm:col-span-2"><Label>Notizen</Label><Textarea placeholder="z. B. 2 Stück, mit Firmenlogo" value={editG.notizen} onChange={(e) => setEditG({ ...editG, notizen: e.target.value })} /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditG(null)}>Abbrechen</Button>
            <Button disabled={busy || !editG?.artikel_id || !editG?.mitarbeiter_id || !editG?.ausgegeben_am} onClick={() => editG && run(() => saveG({ data: { ...editG, rueckgabe_faellig: editG.rueckgabe_faellig || null } }), "Gespeichert", () => setEditG(null))}>Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rückgabe */}
      <Dialog open={!!rueckG} onOpenChange={(o) => !o && setRueckG(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Kleidung zurücknehmen</DialogTitle><DialogDescription>{rueckG?.name}</DialogDescription></DialogHeader>
          {rueckG && (
            <div className="space-y-3">
              <div><Label>Zurück am *</Label><Input type="date" value={rueckG.zurueckgegeben_am} onChange={(e) => setRueckG({ ...rueckG, zurueckgegeben_am: e.target.value })} /></div>
              <div><Label>Zustand bei Rückgabe</Label>
                <Select value={rueckG.rueckgabe_zustand} onValueChange={(v) => setRueckG({ ...rueckG, rueckgabe_zustand: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{KLEIDUNG_ZUSTAEND.map((z) => <SelectItem key={z.value} value={z.value}>{z.label}</SelectItem>)}</SelectContent></Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRueckG(null)}>Abbrechen</Button>
            <Button disabled={busy || !rueckG?.zurueckgegeben_am} onClick={() => rueckG && run(() => zurueck({ data: { id: rueckG.id, zurueckgegeben_am: rueckG.zurueckgegeben_am, rueckgabe_zustand: rueckG.rueckgabe_zustand } }), "Zurückgenommen", () => setRueckG(null))}>Zurücknehmen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Kleidungsart anlegen/bearbeiten */}
      <Dialog open={!!editA} onOpenChange={(o) => !o && setEditA(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editA?.id ? "Kleidungsart bearbeiten" : "Neue Kleidungsart"}</DialogTitle><DialogDescription>Z. B. „Poloshirt mit Logo" – Ausgaben verweisen darauf.</DialogDescription></DialogHeader>
          {editA && (
            <div className="space-y-3">
              <div><Label>Bezeichnung *</Label><Input placeholder="z. B. Poloshirt mit Logo" value={editA.name} onChange={(e) => setEditA({ ...editA, name: e.target.value })} /></div>
              <div><Label>Kategorie</Label>
                <Select value={editA.kategorie} onValueChange={(v) => setEditA({ ...editA, kategorie: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{KLEIDUNG_KATEGORIEN.map((k) => <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>)}</SelectContent></Select>
              </div>
              <div><Label>Übliche Größen</Label><Input placeholder="z. B. S, M, L, XL, 50/52" value={editA.groessen} onChange={(e) => setEditA({ ...editA, groessen: e.target.value })} /></div>
              <div><Label>Notizen</Label><Textarea value={editA.notizen} onChange={(e) => setEditA({ ...editA, notizen: e.target.value })} /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditA(null)}>Abbrechen</Button>
            <Button disabled={busy || !editA?.name} onClick={() => editA && run(() => saveA({ data: editA }), "Gespeichert", () => setEditA(null))}>Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import QRCode from "qrcode";
import {
  Plus, Pencil, Trash2, QrCode, AlertTriangle, History, Printer, Wand2,
  Search, Package, PackageCheck, PackageX, Boxes, ArrowDownToLine, ArrowUpFromLine,
  Activity, TrendingDown, TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  listLagerArtikel, upsertLagerArtikel, deleteLagerArtikel,
  listLagerBuchungen, getLagerSettings, saveLagerSettings,
  LAGER_KATEGORIEN, type LagerArtikel, type LagerBuchung,
} from "@/lib/lager.functions";

const EMPTY = {
  kategorie: "Sonstiges", bezeichnung: "", beschreibung: "", barcode: "", barcode_generiert: false,
  einheit: "Stk", lagerort: "", bestand: 0, mindestbestand: 0, alarm_email: "", aktiv: true,
};

function fmt(d?: string | null) {
  if (!d) return "–";
  return new Date(d).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function generateBarcode() {
  const rnd = Math.floor(Math.random() * 1_000_000).toString().padStart(6, "0");
  return `LG-${Date.now().toString(36).toUpperCase().slice(-5)}${rnd.slice(0, 3)}`;
}

const categoryTone: Record<string, string> = {
  EMA: "border-info/60 bg-info/40 text-info-foreground",
  BMA: "border-destructive/60 bg-destructive/40 text-destructive-foreground",
  GMA: "border-primary/60 bg-primary/40 text-primary-foreground",
  Kleinmaterial: "border-success/60 bg-success/40 text-success-foreground",
  Sonstiges: "border-border bg-muted/80 text-muted-foreground",
};

function CategoryBadge({ value }: { value?: string | null }) {
  const category = value || "Sonstiges";
  return <Badge variant="outline" className={categoryTone[category] ?? categoryTone.Sonstiges}>{category}</Badge>;
}

export function LagerArtikelPanel() {
  const qc = useQueryClient();
  const load = useServerFn(listLagerArtikel);
  const loadBookings = useServerFn(listLagerBuchungen);
  const save = useServerFn(upsertLagerArtikel);
  const del = useServerFn(deleteLagerArtikel);
  const [edit, setEdit] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);
  const [historyFor, setHistoryFor] = useState<LagerArtikel | null>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("alle");
  const [stockFilter, setStockFilter] = useState("alle");

  const { data, isLoading } = useQuery({ queryKey: ["lager-artikel"], queryFn: () => load({ data: {} } as any) });
  const { data: bookingData } = useQuery({ queryKey: ["lager-buchungen", "overview"], queryFn: () => loadBookings({ data: {} } as any) });
  const rows = (data?.rows ?? []) as LagerArtikel[];
  const bookings = (bookingData?.rows ?? []) as LagerBuchung[];
  const unterMelde = useMemo(() => rows.filter((r) => r.mindestbestand > 0 && r.bestand <= r.mindestbestand), [rows]);
  const movementStats = useMemo(() => ({
    incoming: bookings.filter((b) => b.richtung === "eingang").reduce((sum, b) => sum + b.menge, 0),
    outgoing: bookings.filter((b) => b.richtung === "ausgang").reduce((sum, b) => sum + b.menge, 0),
    count: bookings.length,
  }), [bookings]);
  const stats = useMemo(() => ({
    total: rows.length,
    active: rows.filter((r) => r.aktiv).length,
    low: unterMelde.length,
    units: rows.reduce((sum, r) => sum + Math.max(0, Number(r.bestand) || 0), 0),
  }), [rows, unterMelde.length]);
  const categoryStats = useMemo(() => LAGER_KATEGORIEN.map((name) => ({
    name,
    count: rows.filter((r) => (r.kategorie || "Sonstiges") === name).length,
  })).filter((item) => item.count > 0), [rows]);
  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((r) => {
      const matchesSearch = !term || [r.bezeichnung, r.barcode, r.lagerort, r.beschreibung, r.kategorie]
        .some((value) => String(value ?? "").toLowerCase().includes(term));
      const matchesCategory = category === "alle" || (r.kategorie || "Sonstiges") === category;
      const matchesStock = stockFilter === "alle"
        || (stockFilter === "kritisch" && r.mindestbestand > 0 && r.bestand <= r.mindestbestand)
        || (stockFilter === "aktiv" && r.aktiv)
        || (stockFilter === "inaktiv" && !r.aktiv);
      return matchesSearch && matchesCategory && matchesStock;
    });
  }, [rows, search, category, stockFilter]);

  async function handleSave() {
    if (!edit?.bezeichnung?.trim()) { toast.error("Bitte eine Bezeichnung angeben."); return; }
    if (!edit?.barcode?.trim()) { toast.error("Bitte einen Barcode scannen oder generieren."); return; }
    setBusy(true);
    try {
      await save({ data: edit } as any);
      toast.success("Artikel gespeichert");
      setEdit(null);
      qc.invalidateQueries({ queryKey: ["lager-artikel"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Fehler beim Speichern");
    } finally { setBusy(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm("Diesen Artikel wirklich löschen? Die Buchungshistorie wird mitgelöscht.")) return;
    try {
      await del({ data: { id } } as any);
      toast.success("Artikel gelöscht");
      qc.invalidateQueries({ queryKey: ["lager-artikel"] });
    } catch (e: any) { toast.error(e?.message ?? "Fehler"); }
  }

  async function printLabel(a: LagerArtikel) {
    try {
      const png = await QRCode.toDataURL(a.barcode, { width: 400, margin: 0 });
      const w = window.open("", "_blank", "width=460,height=420");
      if (!w) { toast.error("Popup wurde blockiert."); return; }
      const esc = (s: string) => s.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c] as string));
      w.document.write(`<html><head><title>Etikett ${esc(a.barcode)}</title>
        <style>
          @page { size: 57mm 32mm; margin: 0; }
          html,body { margin:0; padding:0; }
          .label { width:57mm; height:32mm; box-sizing:border-box; display:flex; align-items:center; gap:2mm; padding:2mm 2.5mm; font-family:Arial,Helvetica,sans-serif; overflow:hidden; }
          .qr { width:26mm; height:26mm; flex:0 0 auto; } .txt { min-width:0; }
          .name { font-size:9pt; font-weight:700; line-height:1.15; max-height:11mm; overflow:hidden; }
          .ort { font-size:7pt; color:#444; margin-top:.6mm; } .code { font-family:"Courier New",monospace; font-size:8pt; margin-top:1.2mm; word-break:break-all; }
          @media screen { body { background:#f4f4f5; padding:12px; } .label { background:#fff; border:1px solid #ddd; } }
        </style></head><body><div class="label"><img class="qr" src="${png}" /><div class="txt"><div class="name">${esc(a.bezeichnung)}</div>${a.lagerort ? `<div class="ort">${esc(a.lagerort)}</div>` : ""}<div class="code">${esc(a.barcode)}</div></div></div><script>window.onload = () => window.print();<\/script></body></html>`);
      w.document.close();
    } catch { toast.error("Etikett konnte nicht erzeugt werden."); }
  }

  return (
    <div className="space-y-6">
      <LagerAlarmSettings />

      <section aria-labelledby="lager-overview-heading" className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Bestandsübersicht</p>
            <h2 id="lager-overview-heading" className="text-xl font-semibold tracking-tight">Alles im Blick</h2>
          </div>
          {unterMelde.length > 0 && <Badge variant="outline" className="border-warning/40 bg-warning/10 text-warning-foreground"><AlertTriangle className="mr-1 size-3.5" />{unterMelde.length} unter Meldebestand</Badge>}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-lg border border-border bg-card p-4"><div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Artikel gesamt</span><Package className="size-4 text-primary" /></div><p className="mt-2 text-2xl font-semibold">{stats.total}</p><p className="text-xs text-muted-foreground">{stats.active} aktiv an der Station</p></div>
          <div className="rounded-lg border border-border bg-card p-4"><div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Einheiten im Bestand</span><Boxes className="size-4 text-primary" /></div><p className="mt-2 text-2xl font-semibold">{stats.units}</p><p className="text-xs text-muted-foreground">über alle Artikel</p></div>
          <div className="rounded-lg border border-border bg-card p-4"><div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Meldebestand</span><PackageX className="size-4 text-warning" /></div><p className="mt-2 text-2xl font-semibold">{stats.low}</p><p className="text-xs text-muted-foreground">sofort prüfen</p></div>
          <div className="rounded-lg border border-border bg-card p-4"><div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Kategorien</span><PackageCheck className="size-4 text-primary" /></div><p className="mt-2 text-2xl font-semibold">{categoryStats.length}</p><p className="text-xs text-muted-foreground">mit angelegten Artikeln</p></div>
        </div>
      </section>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Activity className="size-4 text-primary" />Lageraktivität</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/20 p-3"><div className="grid size-9 place-items-center rounded-md bg-success/10 text-success"><TrendingUp className="size-4" /></div><div><p className="text-xs text-muted-foreground">Eingebuchte Einheiten</p><p className="text-lg font-semibold">{movementStats.incoming}</p></div></div>
          <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/20 p-3"><div className="grid size-9 place-items-center rounded-md bg-warning/10 text-warning"><TrendingDown className="size-4" /></div><div><p className="text-xs text-muted-foreground">Ausgebuchte Einheiten</p><p className="text-lg font-semibold">{movementStats.outgoing}</p></div></div>
          <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/20 p-3"><div className="grid size-9 place-items-center rounded-md bg-info/10 text-info"><History className="size-4" /></div><div><p className="text-xs text-muted-foreground">Buchungen insgesamt</p><p className="text-lg font-semibold">{movementStats.count}</p></div></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Verteilung nach Kategorie</CardTitle></CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {LAGER_KATEGORIEN.map((name) => { const count = categoryStats.find((item) => item.name === name)?.count ?? 0; return <button key={name} type="button" onClick={() => setCategory(name)} className="flex cursor-pointer items-center justify-between rounded-lg border border-border p-3 text-left transition-colors hover:bg-muted/50"><CategoryBadge value={name} /><span className="font-semibold">{count}</span></button>; })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="gap-4 pb-4 lg:flex-row lg:items-center lg:justify-between">
          <div><CardTitle className="text-base">Artikel &amp; Bestände</CardTitle><p className="mt-1 text-sm text-muted-foreground">Suchen, nach Kategorie ordnen und Bestände schnell prüfen.</p></div>
          <Button size="sm" onClick={() => setEdit({ ...EMPTY })}><Plus className="size-4" /> Artikel anlegen</Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 rounded-lg border border-border bg-muted/30 p-3 lg:grid-cols-[minmax(240px,1fr)_190px_170px_auto]">
            <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9 bg-background" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Artikel, Barcode oder Lagerort suchen …" aria-label="Artikel suchen" /></div>
            <Select value={category} onValueChange={setCategory}><SelectTrigger className="bg-background"><SelectValue placeholder="Kategorie" /></SelectTrigger><SelectContent><SelectItem value="alle">Alle Kategorien</SelectItem>{LAGER_KATEGORIEN.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select>
            <Select value={stockFilter} onValueChange={setStockFilter}><SelectTrigger className="bg-background"><SelectValue placeholder="Bestandsstatus" /></SelectTrigger><SelectContent><SelectItem value="alle">Alle Status</SelectItem><SelectItem value="kritisch">Meldebestand</SelectItem><SelectItem value="aktiv">Nur aktive</SelectItem><SelectItem value="inaktiv">Nur inaktive</SelectItem></SelectContent></Select>
            <Button variant="ghost" onClick={() => { setSearch(""); setCategory("alle"); setStockFilter("alle"); }} disabled={!search && category === "alle" && stockFilter === "alle"}>Filter zurücksetzen</Button>
          </div>

          {categoryStats.length > 0 && <div className="flex flex-wrap gap-2">{categoryStats.map((item) => <Button key={item.name} type="button" variant="outline" size="sm" className="h-auto py-1.5" onClick={() => setCategory(item.name)}><CategoryBadge value={item.name} /><span className="text-xs text-muted-foreground">{item.count}</span></Button>)}</div>}
          {isLoading ? <div className="py-8 text-sm text-muted-foreground">Lade Artikel …</div> : rows.length === 0 ? <div className="py-8 text-sm text-muted-foreground">Noch keine Artikel angelegt.</div> : filteredRows.length === 0 ? <div className="py-8 text-center text-sm text-muted-foreground">Keine Artikel für diese Suche gefunden.</div> : (
            <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-sm"><thead><tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground"><th className="py-3 pr-3">Artikel</th><th className="py-3 pr-3">Kategorie</th><th className="py-3 pr-3">Barcode</th><th className="py-3 pr-3">Lagerort</th><th className="py-3 pr-3">Bestand</th><th className="py-3 pr-3">Meldebestand</th><th className="py-3 pr-3">Status</th><th className="py-3" /></tr></thead><tbody>
              {filteredRows.map((r) => { const low = r.mindestbestand > 0 && r.bestand <= r.mindestbestand; return <tr key={r.id} className="border-b border-border/70 last:border-0 hover:bg-muted/30"><td className="py-3 pr-3"><div className="font-medium">{r.bezeichnung}</div>{r.beschreibung && <div className="max-w-[220px] truncate text-xs text-muted-foreground">{r.beschreibung}</div>}</td><td className="py-3 pr-3"><CategoryBadge value={r.kategorie} /></td><td className="py-3 pr-3 font-mono text-xs">{r.barcode}{r.barcode_generiert && <Badge variant="outline" className="ml-2">generiert</Badge>}</td><td className="py-3 pr-3 text-muted-foreground">{r.lagerort ?? "–"}</td><td className={`py-3 pr-3 font-semibold ${low ? "text-warning" : ""}`}>{r.bestand} {r.einheit}</td><td className="py-3 pr-3 text-muted-foreground">{r.mindestbestand || "–"}</td><td className="py-3 pr-3">{r.aktiv ? <Badge variant="secondary">aktiv</Badge> : <Badge variant="destructive">inaktiv</Badge>}</td><td className="py-3 text-right whitespace-nowrap"><Button variant="ghost" size="icon" title="Etikett drucken" onClick={() => printLabel(r)}><Printer className="size-4" /></Button><Button variant="ghost" size="icon" title="Historie" onClick={() => setHistoryFor(r)}><History className="size-4" /></Button><Button variant="ghost" size="icon" title="Bearbeiten" onClick={() => setEdit({ id: r.id, kategorie: r.kategorie || "Sonstiges", bezeichnung: r.bezeichnung, beschreibung: r.beschreibung ?? "", barcode: r.barcode, barcode_generiert: r.barcode_generiert, einheit: r.einheit, lagerort: r.lagerort ?? "", bestand: r.bestand, mindestbestand: r.mindestbestand, alarm_email: r.alarm_email ?? "", aktiv: r.aktiv })}><Pencil className="size-4" /></Button><Button variant="ghost" size="icon" title="Löschen" onClick={() => handleDelete(r.id)}><Trash2 className="size-4 text-destructive" /></Button></td></tr>; })}
            </tbody></table></div>
          )}
          <p className="text-xs text-muted-foreground">{filteredRows.length} von {rows.length} Artikeln angezeigt</p>
        </CardContent>
      </Card>

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}><DialogContent className="max-w-xl"><DialogHeader><DialogTitle>{edit?.id ? "Artikel bearbeiten" : "Neuer Artikel"}</DialogTitle><DialogDescription>Artikel kategorisieren, Bestand pflegen und Barcode hinterlegen.</DialogDescription></DialogHeader>{edit && <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1"><div className="grid grid-cols-2 gap-3"><div className="col-span-2"><Label>Bezeichnung</Label><Input value={edit.bezeichnung} onChange={(e) => setEdit({ ...edit, bezeichnung: e.target.value })} /></div><div><Label>Kategorie</Label><Select value={edit.kategorie || "Sonstiges"} onValueChange={(value) => setEdit({ ...edit, kategorie: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{LAGER_KATEGORIEN.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></div><div><Label>Einheit</Label><Input value={edit.einheit} onChange={(e) => setEdit({ ...edit, einheit: e.target.value })} /></div></div><div><Label>Beschreibung</Label><Textarea rows={2} value={edit.beschreibung} onChange={(e) => setEdit({ ...edit, beschreibung: e.target.value })} /></div><div><Label className="flex items-center gap-2"><QrCode className="size-4" /> Barcode</Label><div className="flex gap-2"><Input className="font-mono" placeholder="Barcode scannen …" value={edit.barcode} onChange={(e) => setEdit({ ...edit, barcode: e.target.value, barcode_generiert: false })} onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }} /><Button type="button" variant="outline" onClick={() => setEdit({ ...edit, barcode: generateBarcode(), barcode_generiert: true })}><Wand2 className="size-4" /> Generieren</Button></div></div><div className="grid grid-cols-2 gap-3"><div><Label>Lagerort</Label><Input value={edit.lagerort} onChange={(e) => setEdit({ ...edit, lagerort: e.target.value })} /></div><div><Label>Bestand</Label><Input type="number" min={0} value={edit.bestand} onChange={(e) => setEdit({ ...edit, bestand: Number(e.target.value) })} /></div><div><Label>Meldebestand</Label><Input type="number" min={0} value={edit.mindestbestand} onChange={(e) => setEdit({ ...edit, mindestbestand: Number(e.target.value) })} /></div><div><Label>Abweichende Warn-E-Mail (optional)</Label><Input type="email" value={edit.alarm_email} onChange={(e) => setEdit({ ...edit, alarm_email: e.target.value })} /></div></div><div className="flex items-center justify-between rounded-lg border border-border px-3 py-2"><span className="text-sm">Aktiv (an der Lager-Station buchbar)</span><Switch checked={edit.aktiv} onCheckedChange={(v) => setEdit({ ...edit, aktiv: v })} /></div></div>}<DialogFooter><Button variant="outline" onClick={() => setEdit(null)}>Abbrechen</Button><Button onClick={handleSave} disabled={busy}>Speichern</Button></DialogFooter></DialogContent></Dialog>
      <BuchungsHistorie artikel={historyFor} onClose={() => setHistoryFor(null)} />
    </div>
  );
}

export function LagerAlarmSettings() {
  const qc = useQueryClient(); const load = useServerFn(getLagerSettings); const save = useServerFn(saveLagerSettings);
  const { data } = useQuery({ queryKey: ["lager-settings"], queryFn: () => load({ data: {} } as any) });
  const [email, setEmail] = useState<string | null>(null); const [aktiv, setAktiv] = useState<boolean | null>(null);
  const value = email ?? data?.alarm_email ?? ""; const active = aktiv ?? data?.alarm_aktiv ?? true;
  async function handleSave() { try { await save({ data: { alarm_email: value, alarm_aktiv: active } } as any); toast.success("Lager-Einstellungen gespeichert"); qc.invalidateQueries({ queryKey: ["lager-settings"] }); } catch (e: any) { toast.error(e?.message ?? "Fehler"); } }
  return <Card><CardHeader><CardTitle className="text-base">Lager-E-Mail &amp; Meldebestand</CardTitle></CardHeader><CardContent className="space-y-3"><p className="text-sm text-muted-foreground">Diese Domänen-Adresse erhält automatisch eine E-Mail, sobald ein Artikel seinen Meldebestand erreicht oder unterschreitet.</p><div className="space-y-2"><Label htmlFor="lager-alarm-email">Empfängeradresse für Lager-Warnungen</Label><Input id="lager-alarm-email" type="email" value={value} onChange={(e) => setEmail(e.target.value)} placeholder="lager@beispiel.de" /></div><div className="flex items-center justify-between rounded-lg border border-border px-3 py-2"><span className="text-sm">Benachrichtigung aktiv</span><Switch checked={active} onCheckedChange={setAktiv} /></div><Button onClick={handleSave}>Speichern</Button></CardContent></Card>;
}

function BuchungsHistorie({ artikel, onClose }: { artikel: LagerArtikel | null; onClose: () => void }) {
  const load = useServerFn(listLagerBuchungen);
  const { data, isLoading } = useQuery({ queryKey: ["lager-buchungen", artikel?.id], queryFn: () => load({ data: { artikel_id: artikel?.id } } as any), enabled: !!artikel });
  const rows = (data?.rows ?? []) as LagerBuchung[];
  return <Dialog open={!!artikel} onOpenChange={(o) => !o && onClose()}><DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>Buchungen – {artikel?.bezeichnung}</DialogTitle><DialogDescription>Die letzten 100 Ein- und Ausbuchungen.</DialogDescription></DialogHeader><div className="max-h-[60vh] overflow-y-auto">{isLoading ? <div className="text-sm text-muted-foreground">Lade…</div> : rows.length === 0 ? <div className="text-sm text-muted-foreground">Noch keine Buchungen.</div> : <table className="w-full text-sm"><thead><tr className="text-left text-xs uppercase tracking-wide text-muted-foreground"><th className="py-2 pr-3">Zeitpunkt</th><th className="py-2 pr-3">Person</th><th className="py-2 pr-3">Richtung</th><th className="py-2 pr-3">Menge</th><th className="py-2 pr-3">Bestand danach</th><th className="py-2 pr-3">Unterschrift</th></tr></thead><tbody>{rows.map((b) => <tr key={b.id} className="border-t border-border"><td className="py-2 pr-3 text-muted-foreground">{fmt(b.created_at)}</td><td className="py-2 pr-3">{b.person_name ?? "–"}</td><td className="py-2 pr-3"><Badge variant={b.richtung === "eingang" ? "secondary" : "outline"}>{b.richtung === "eingang" ? <><ArrowDownToLine className="mr-1 size-3" />Eingang</> : <><ArrowUpFromLine className="mr-1 size-3" />Ausgang</>}</Badge></td><td className="py-2 pr-3">{b.menge}</td><td className="py-2 pr-3">{b.bestand_nachher}</td><td className="py-2 pr-3">{b.signatur ? <img src={b.signatur} alt="Unterschrift" className="h-8" /> : "–"}</td></tr>)}</tbody></table>}</div></DialogContent></Dialog>;
}

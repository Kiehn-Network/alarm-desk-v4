import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import QRCode from "qrcode";
import { Plus, Pencil, Trash2, Printer, Truck, QrCode, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  listLagerFahrzeuge, upsertLagerFahrzeug, deleteLagerFahrzeug, type LagerFahrzeug,
} from "@/lib/lager.functions";

type EditState = {
  id?: string;
  kennzeichen: string;
  bezeichnung: string;
  fahrer: string;
  code: string;
  notiz: string;
  aktiv: boolean;
};

const EMPTY: EditState = { kennzeichen: "", bezeichnung: "", fahrer: "", code: "", notiz: "", aktiv: true };

function esc(value: string) {
  return value.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
}

export function LagerFahrzeugePanel() {
  const qc = useQueryClient();
  const load = useServerFn(listLagerFahrzeuge);
  const save = useServerFn(upsertLagerFahrzeug);
  const remove = useServerFn(deleteLagerFahrzeug);

  const [edit, setEdit] = useState<EditState | null>(null);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");

  const { data, isPending } = useQuery({ queryKey: ["lager-fahrzeuge"], queryFn: () => load() });
  const rows = useMemo(() => {
    const list = (data?.rows ?? []) as LagerFahrzeug[];
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((r) =>
      [r.kennzeichen, r.bezeichnung, r.fahrer, r.code].filter(Boolean).some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [data, search]);

  async function handleSave() {
    if (!edit) return;
    setBusy(true);
    try {
      await save({ data: { id: edit.id, kennzeichen: edit.kennzeichen, bezeichnung: edit.bezeichnung, fahrer: edit.fahrer, code: edit.code || null, notiz: edit.notiz, aktiv: edit.aktiv } });
      toast.success("Fahrzeug gespeichert.");
      setEdit(null);
      qc.invalidateQueries({ queryKey: ["lager-fahrzeuge"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Speichern fehlgeschlagen.");
    } finally { setBusy(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm("Fahrzeug wirklich löschen?")) return;
    try {
      await remove({ data: { id } });
      qc.invalidateQueries({ queryKey: ["lager-fahrzeuge"] });
      toast.success("Fahrzeug gelöscht.");
    } catch (e: any) { toast.error(e?.message ?? "Löschen fehlgeschlagen."); }
  }

  async function printCards(list: LagerFahrzeug[]) {
    if (!list.length) { toast.error("Keine Fahrzeuge zum Drucken."); return; }
    try {
      const cards = await Promise.all(list.map(async (f) => {
        const png = await QRCode.toDataURL(f.code, { width: 400, margin: 0 });
        return `<div class="card">
          <img class="qr" src="${png}" />
          <div class="txt">
            <div class="kz">${esc(f.kennzeichen)}</div>
            ${f.bezeichnung ? `<div class="sub">${esc(f.bezeichnung)}</div>` : ""}
            ${f.fahrer ? `<div class="sub">Fahrer: ${esc(f.fahrer)}</div>` : ""}
            <div class="code">${esc(f.code)}</div>
          </div>
        </div>`;
      }));
      const w = window.open("", "_blank", "width=900,height=700");
      if (!w) { toast.error("Bitte Pop-ups für den Druck erlauben."); return; }
      w.document.write(`<html><head><title>Fahrzeugliste</title><style>
        @page { size: A4; margin: 12mm; }
        body { font-family: system-ui, sans-serif; color: #111; }
        h1 { font-size: 16pt; margin: 0 0 2mm; }
        .meta { font-size: 9pt; color: #555; margin-bottom: 6mm; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6mm; }
        .card { display: flex; gap: 4mm; align-items: center; border: 1px solid #999; border-radius: 3mm; padding: 4mm; break-inside: avoid; }
        .qr { width: 26mm; height: 26mm; flex: 0 0 auto; }
        .txt { min-width: 0; }
        .kz { font-size: 13pt; font-weight: 700; }
        .sub { font-size: 9pt; color: #333; }
        .code { font-family: ui-monospace, monospace; font-size: 8pt; color: #555; margin-top: 1mm; }
      </style></head><body>
        <h1>Fahrzeugliste Lager</h1>
        <div class="meta">${list.length} Fahrzeug(e) · Stand ${new Date().toLocaleString("de-DE")}</div>
        <div class="grid">${cards.join("")}</div>
        <script>window.onload = () => window.print();<\/script>
      </body></html>`);
      w.document.close();
    } catch { toast.error("Druckansicht konnte nicht erzeugt werden."); }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2"><Truck className="size-5" /> Fahrzeuge</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="w-56 pl-8" placeholder="Suchen …" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Button variant="outline" onClick={() => printCards(rows)}>
              <Printer className="size-4" /> Liste drucken
            </Button>
            <Button onClick={() => setEdit({ ...EMPTY })}><Plus className="size-4" /> Fahrzeug</Button>
          </div>
        </CardHeader>
        <CardContent>
          {isPending ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Fahrzeuge werden geladen …</div>
          ) : rows.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Noch keine Fahrzeuge angelegt.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-muted-foreground">
                  <tr className="border-b border-border">
                    <th className="py-2 pr-3">Kennzeichen</th>
                    <th className="py-2 pr-3">Bezeichnung</th>
                    <th className="py-2 pr-3">Fahrer</th>
                    <th className="py-2 pr-3">QR-Code</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 text-right">Aktionen</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-b border-border/70 last:border-0 hover:bg-muted/30">
                      <td className="py-3 pr-3 font-semibold">{r.kennzeichen}</td>
                      <td className="py-3 pr-3">{r.bezeichnung ?? "–"}</td>
                      <td className="py-3 pr-3 text-muted-foreground">{r.fahrer ?? "–"}</td>
                      <td className="py-3 pr-3 font-mono text-xs">{r.code}</td>
                      <td className="py-3 pr-3">{r.aktiv ? <Badge variant="secondary">aktiv</Badge> : <Badge variant="destructive">inaktiv</Badge>}</td>
                      <td className="py-3 text-right whitespace-nowrap">
                        <Button variant="ghost" size="icon" title="QR-Code drucken" onClick={() => printCards([r])}><Printer className="size-4" /></Button>
                        <Button variant="ghost" size="icon" title="Bearbeiten" onClick={() => setEdit({ id: r.id, kennzeichen: r.kennzeichen, bezeichnung: r.bezeichnung ?? "", fahrer: r.fahrer ?? "", code: r.code, notiz: r.notiz ?? "", aktiv: r.aktiv })}><Pencil className="size-4" /></Button>
                        <Button variant="ghost" size="icon" title="Löschen" onClick={() => handleDelete(r.id)}><Trash2 className="size-4 text-destructive" /></Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{edit?.id ? "Fahrzeug bearbeiten" : "Neues Fahrzeug"}</DialogTitle>
            <DialogDescription>Jedes Fahrzeug erhält einen eigenen QR-Code für die Lager-Station.</DialogDescription>
          </DialogHeader>
          {edit && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Kennzeichen</Label><Input value={edit.kennzeichen} onChange={(e) => setEdit({ ...edit, kennzeichen: e.target.value.toUpperCase() })} placeholder="HH-AD 123" /></div>
                <div><Label>Bezeichnung</Label><Input value={edit.bezeichnung} onChange={(e) => setEdit({ ...edit, bezeichnung: e.target.value })} placeholder="Servicewagen 1" /></div>
              </div>
              <div><Label>Fahrer (optional)</Label><Input value={edit.fahrer} onChange={(e) => setEdit({ ...edit, fahrer: e.target.value })} /></div>
              {edit.id && (
                <div>
                  <Label className="flex items-center gap-2"><QrCode className="size-4" /> QR-Code</Label>
                  <Input className="font-mono" value={edit.code} onChange={(e) => setEdit({ ...edit, code: e.target.value })} />
                </div>
              )}
              <div><Label>Notiz</Label><Textarea rows={2} value={edit.notiz} onChange={(e) => setEdit({ ...edit, notiz: e.target.value })} /></div>
              <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                <span className="text-sm">Aktiv</span>
                <Switch checked={edit.aktiv} onCheckedChange={(v) => setEdit({ ...edit, aktiv: v })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEdit(null)}>Abbrechen</Button>
            <Button onClick={handleSave} disabled={busy}>Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

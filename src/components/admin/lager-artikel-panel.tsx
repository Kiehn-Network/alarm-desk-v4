import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import QRCode from "qrcode";
import { Plus, Pencil, Trash2, QrCode, AlertTriangle, History, Printer, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  listLagerArtikel, upsertLagerArtikel, deleteLagerArtikel,
  listLagerBuchungen, getLagerSettings, saveLagerSettings,
  type LagerArtikel, type LagerBuchung,
} from "@/lib/lager.functions";

const EMPTY = {
  bezeichnung: "", beschreibung: "", barcode: "", barcode_generiert: false,
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

export function LagerArtikelPanel() {
  const qc = useQueryClient();
  const load = useServerFn(listLagerArtikel);
  const save = useServerFn(upsertLagerArtikel);
  const del = useServerFn(deleteLagerArtikel);
  const [edit, setEdit] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);
  const [historyFor, setHistoryFor] = useState<LagerArtikel | null>(null);

  const { data, isLoading } = useQuery({ queryKey: ["lager-artikel"], queryFn: () => load({ data: {} } as any) });
  const rows = (data?.rows ?? []) as LagerArtikel[];
  const unterMelde = useMemo(() => rows.filter((r) => r.mindestbestand > 0 && r.bestand <= r.mindestbestand), [rows]);

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
      const png = await QRCode.toDataURL(a.barcode, { width: 320, margin: 1 });
      const w = window.open("", "_blank", "width=420,height=520");
      if (!w) { toast.error("Popup wurde blockiert."); return; }
      w.document.write(`<html><head><title>Etikett ${a.barcode}</title></head>
        <body style="font-family:Arial,sans-serif;text-align:center;padding:24px">
          <img src="${png}" style="width:260px;height:260px" />
          <div style="font-size:18px;font-weight:700;margin-top:12px">${a.bezeichnung}</div>
          <div style="font-family:monospace;font-size:16px;margin-top:4px">${a.barcode}</div>
          <script>window.onload = () => window.print();<\/script>
        </body></html>`);
      w.document.close();
    } catch { toast.error("Etikett konnte nicht erzeugt werden."); }
  }

  return (
    <div className="space-y-6">
      <LagerAlarmSettings />

      {unterMelde.length > 0 && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm flex items-center gap-2">
          <AlertTriangle className="size-4 text-amber-500" />
          {unterMelde.length} Artikel liegen auf oder unter dem Meldebestand.
        </div>
      )}

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base">Lager-Artikel</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Artikel mit vorhandenem Barcode erfassen oder einen neuen Code generieren und als Etikett drucken.
            </p>
          </div>
          <Button size="sm" onClick={() => setEdit({ ...EMPTY })}><Plus className="size-4" /> Artikel</Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-sm text-muted-foreground">Lade…</div>
          ) : rows.length === 0 ? (
            <div className="text-sm text-muted-foreground">Noch keine Artikel angelegt.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-2 pr-3">Artikel</th>
                    <th className="py-2 pr-3">Barcode</th>
                    <th className="py-2 pr-3">Lagerort</th>
                    <th className="py-2 pr-3">Bestand</th>
                    <th className="py-2 pr-3">Meldebestand</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const low = r.mindestbestand > 0 && r.bestand <= r.mindestbestand;
                    return (
                      <tr key={r.id} className="border-t border-border">
                        <td className="py-2 pr-3 font-medium">{r.bezeichnung}</td>
                        <td className="py-2 pr-3 font-mono text-xs">
                          {r.barcode}
                          {r.barcode_generiert && <Badge variant="outline" className="ml-2">generiert</Badge>}
                        </td>
                        <td className="py-2 pr-3 text-muted-foreground">{r.lagerort ?? "–"}</td>
                        <td className={`py-2 pr-3 font-semibold ${low ? "text-amber-500" : ""}`}>{r.bestand} {r.einheit}</td>
                        <td className="py-2 pr-3 text-muted-foreground">{r.mindestbestand || "–"}</td>
                        <td className="py-2 pr-3">
                          {r.aktiv ? <Badge variant="secondary">aktiv</Badge> : <Badge variant="destructive">inaktiv</Badge>}
                        </td>
                        <td className="py-2 text-right whitespace-nowrap">
                          <Button variant="ghost" size="icon" title="Etikett drucken" onClick={() => printLabel(r)}><Printer className="size-4" /></Button>
                          <Button variant="ghost" size="icon" title="Historie" onClick={() => setHistoryFor(r)}><History className="size-4" /></Button>
                          <Button variant="ghost" size="icon" title="Bearbeiten" onClick={() => setEdit({
                            id: r.id, bezeichnung: r.bezeichnung, beschreibung: r.beschreibung ?? "",
                            barcode: r.barcode, barcode_generiert: r.barcode_generiert, einheit: r.einheit,
                            lagerort: r.lagerort ?? "", bestand: r.bestand, mindestbestand: r.mindestbestand,
                            alarm_email: r.alarm_email ?? "", aktiv: r.aktiv,
                          })}><Pencil className="size-4" /></Button>
                          <Button variant="ghost" size="icon" title="Löschen" onClick={() => handleDelete(r.id)}><Trash2 className="size-4 text-destructive" /></Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{edit?.id ? "Artikel bearbeiten" : "Neuer Artikel"}</DialogTitle>
            <DialogDescription>Vorhandenen Barcode scannen oder einen eigenen Code generieren.</DialogDescription>
          </DialogHeader>
          {edit && (
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              <div>
                <Label>Bezeichnung</Label>
                <Input value={edit.bezeichnung} onChange={(e) => setEdit({ ...edit, bezeichnung: e.target.value })} />
              </div>
              <div>
                <Label>Beschreibung</Label>
                <Textarea rows={2} value={edit.beschreibung} onChange={(e) => setEdit({ ...edit, beschreibung: e.target.value })} />
              </div>
              <div>
                <Label className="flex items-center gap-2"><QrCode className="size-4" /> Barcode</Label>
                <div className="flex gap-2">
                  <Input
                    className="font-mono"
                    placeholder="Barcode scannen …"
                    value={edit.barcode}
                    onChange={(e) => setEdit({ ...edit, barcode: e.target.value, barcode_generiert: false })}
                    onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }}
                  />
                  <Button type="button" variant="outline" onClick={() => setEdit({ ...edit, barcode: generateBarcode(), barcode_generiert: true })}>
                    <Wand2 className="size-4" /> Generieren
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Einheit</Label>
                  <Input value={edit.einheit} onChange={(e) => setEdit({ ...edit, einheit: e.target.value })} />
                </div>
                <div>
                  <Label>Lagerort</Label>
                  <Input value={edit.lagerort} onChange={(e) => setEdit({ ...edit, lagerort: e.target.value })} />
                </div>
                <div>
                  <Label>Bestand</Label>
                  <Input type="number" min={0} value={edit.bestand} onChange={(e) => setEdit({ ...edit, bestand: Number(e.target.value) })} />
                </div>
                <div>
                  <Label>Meldebestand</Label>
                  <Input type="number" min={0} value={edit.mindestbestand} onChange={(e) => setEdit({ ...edit, mindestbestand: Number(e.target.value) })} />
                </div>
              </div>
              <div>
                <Label>Abweichende Warn-E-Mail (optional)</Label>
                <Input type="email" placeholder="Standard: Lager-Adresse der Domäne" value={edit.alarm_email} onChange={(e) => setEdit({ ...edit, alarm_email: e.target.value })} />
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                <span className="text-sm">Aktiv (an der Lager-Station buchbar)</span>
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

      <BuchungsHistorie artikel={historyFor} onClose={() => setHistoryFor(null)} />
    </div>
  );
}

function LagerAlarmSettings() {
  const qc = useQueryClient();
  const load = useServerFn(getLagerSettings);
  const save = useServerFn(saveLagerSettings);
  const { data } = useQuery({ queryKey: ["lager-settings"], queryFn: () => load({ data: {} } as any) });
  const [email, setEmail] = useState<string | null>(null);
  const [aktiv, setAktiv] = useState<boolean | null>(null);
  const value = email ?? data?.alarm_email ?? "";
  const active = aktiv ?? data?.alarm_aktiv ?? true;

  async function handleSave() {
    try {
      await save({ data: { alarm_email: value, alarm_aktiv: active } } as any);
      toast.success("Lager-Einstellungen gespeichert");
      qc.invalidateQueries({ queryKey: ["lager-settings"] });
    } catch (e: any) { toast.error(e?.message ?? "Fehler"); }
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Meldebestand-Benachrichtigung</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Sobald ein Artikel seinen Meldebestand erreicht oder unterschreitet, geht automatisch eine E-Mail raus.
        </p>
        <div>
          <Label>E-Mail-Adresse</Label>
          <Input type="email" value={value} onChange={(e) => setEmail(e.target.value)} placeholder="lager@beispiel.de" />
        </div>
        <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
          <span className="text-sm">Benachrichtigung aktiv</span>
          <Switch checked={active} onCheckedChange={setAktiv} />
        </div>
        <Button onClick={handleSave}>Speichern</Button>
      </CardContent>
    </Card>
  );
}

function BuchungsHistorie({ artikel, onClose }: { artikel: LagerArtikel | null; onClose: () => void }) {
  const load = useServerFn(listLagerBuchungen);
  const { data, isLoading } = useQuery({
    queryKey: ["lager-buchungen", artikel?.id],
    queryFn: () => load({ data: { artikel_id: artikel!.id } } as any),
    enabled: !!artikel,
  });
  const rows = (data?.rows ?? []) as LagerBuchung[];

  return (
    <Dialog open={!!artikel} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Buchungen – {artikel?.bezeichnung}</DialogTitle>
          <DialogDescription>Die letzten 100 Ein- und Ausbuchungen.</DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto">
          {isLoading ? (
            <div className="text-sm text-muted-foreground">Lade…</div>
          ) : rows.length === 0 ? (
            <div className="text-sm text-muted-foreground">Noch keine Buchungen.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-3">Zeitpunkt</th>
                  <th className="py-2 pr-3">Person</th>
                  <th className="py-2 pr-3">Richtung</th>
                  <th className="py-2 pr-3">Menge</th>
                  <th className="py-2 pr-3">Bestand danach</th>
                  <th className="py-2 pr-3">Unterschrift</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((b) => (
                  <tr key={b.id} className="border-t border-border">
                    <td className="py-2 pr-3 text-muted-foreground">{fmt(b.created_at)}</td>
                    <td className="py-2 pr-3">{b.person_name ?? "–"}</td>
                    <td className="py-2 pr-3">
                      <Badge variant={b.richtung === "eingang" ? "secondary" : "outline"}>
                        {b.richtung === "eingang" ? "Eingang" : "Ausgang"}
                      </Badge>
                    </td>
                    <td className="py-2 pr-3">{b.menge}</td>
                    <td className="py-2 pr-3">{b.bestand_nachher}</td>
                    <td className="py-2 pr-3">
                      {b.signatur ? <img src={b.signatur} alt="Unterschrift" className="h-8" /> : "–"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

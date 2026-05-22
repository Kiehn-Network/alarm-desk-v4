import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  listKontrollpunkte, upsertKontrollpunkt, deleteKontrollpunkt,
  listRundgaenge,
} from "@/lib/owks.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, ScanLine } from "lucide-react";

export const Route = createFileRoute("/_authenticated/revier-center/owks/nfc-punkte")({
  component: NfcPunkteSeite,
});

const TAG_TYPES = [
  { v: "ntag213", l: "NTAG213" },
  { v: "ntag215", l: "NTAG215" },
  { v: "ntag216", l: "NTAG216" },
  { v: "mifare_classic", l: "MIFARE Classic" },
  { v: "mifare_ultralight", l: "MIFARE Ultralight" },
  { v: "desfire", l: "DESFire" },
  { v: "sonstige", l: "Sonstige" },
];

function NfcPunkteSeite() {
  const qc = useQueryClient();
  const listFn = useServerFn(listKontrollpunkte);
  const listRg = useServerFn(listRundgaenge);
  const upFn = useServerFn(upsertKontrollpunkt);
  const delFn = useServerFn(deleteKontrollpunkt);
  const [rundgangFilter, setRundgangFilter] = useState<string>("all");
  const rgQ = useQuery({ queryKey: ["owks-rundgaenge"], queryFn: () => listRg() });
  const q = useQuery({
    queryKey: ["owks-kp", rundgangFilter],
    queryFn: () => listFn({ data: { rundgang_id: rundgangFilter === "all" ? null : rundgangFilter } }),
  });
  const empty = { rundgang_id: "", objekt_id: null, bezeichnung: "", raum: "", reihenfolge: 0, nfc_uid: "", nfc_tag_typ: "ntag213" as const, notizen: "" };
  const [form, setForm] = useState<any>(empty);
  const [editId, setEditId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const save = useMutation({
    mutationFn: () => upFn({ data: { ...form, id: editId ?? undefined } }),
    onSuccess: () => { toast.success("Gespeichert"); setOpen(false); setEditId(null); setForm(empty); qc.invalidateQueries({ queryKey: ["owks-kp"] }); },
    onError: (e: any) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["owks-kp"] }),
  });

  async function scanNfc() {
    const NDEFReaderCtor = (window as any).NDEFReader;
    if (!NDEFReaderCtor) { toast.error("Web-NFC nicht verfügbar (Chrome/Android über HTTPS)"); return; }
    try {
      const reader = new NDEFReaderCtor();
      await reader.scan();
      toast.info("Tag an Gerät halten…");
      reader.onreading = (e: any) => {
        setForm((f: any) => ({ ...f, nfc_uid: e.serialNumber || f.nfc_uid }));
        toast.success(`Erkannt: ${e.serialNumber}`);
      };
    } catch (err: any) { toast.error(err.message ?? "NFC-Scan fehlgeschlagen"); }
  }

  return (
    <div className="p-6 lg:p-8 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-semibold">NFC-Kontrollpunkte</h2>
        <div className="flex items-center gap-2">
          <Select value={rundgangFilter} onValueChange={setRundgangFilter}>
            <SelectTrigger className="w-[220px]"><SelectValue placeholder="Rundgang filtern" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Rundgänge</SelectItem>
              {(rgQ.data ?? []).map((r: any) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditId(null); setForm(empty); } }}>
            <DialogTrigger asChild><Button size="sm"><Plus className="size-4 mr-1" />Neuer Kontrollpunkt</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editId ? "Kontrollpunkt bearbeiten" : "Neuer Kontrollpunkt"}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Rundgang</Label>
                  <Select value={form.rundgang_id} onValueChange={(v) => setForm({ ...form, rundgang_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Rundgang wählen" /></SelectTrigger>
                    <SelectContent>
                      {(rgQ.data ?? []).map((r: any) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label>Bezeichnung</Label><Input value={form.bezeichnung} onChange={(e) => setForm({ ...form, bezeichnung: e.target.value })} /></div>
                  <div><Label>Raum</Label><Input value={form.raum ?? ""} onChange={(e) => setForm({ ...form, raum: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label>Reihenfolge</Label><Input type="number" value={form.reihenfolge} onChange={(e) => setForm({ ...form, reihenfolge: parseInt(e.target.value || "0") })} /></div>
                  <div>
                    <Label>NFC-Tag-Typ</Label>
                    <Select value={form.nfc_tag_typ} onValueChange={(v) => setForm({ ...form, nfc_tag_typ: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{TAG_TYPES.map((t) => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>NFC-UID</Label>
                  <div className="flex gap-2">
                    <Input value={form.nfc_uid ?? ""} onChange={(e) => setForm({ ...form, nfc_uid: e.target.value })} placeholder="z. B. 04:A1:B2:C3:D4:E5:F6" />
                    <Button type="button" variant="outline" onClick={scanNfc}><ScanLine className="size-4 mr-1" />Scannen</Button>
                  </div>
                </div>
                <div><Label>Notizen</Label><Textarea value={form.notizen ?? ""} onChange={(e) => setForm({ ...form, notizen: e.target.value })} /></div>
              </div>
              <DialogFooter><Button onClick={() => save.mutate()} disabled={save.isPending || !form.rundgang_id || !form.bezeichnung}>Speichern</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr><th className="p-3 text-left">#</th><th className="p-3 text-left">Bezeichnung</th><th className="p-3 text-left">Raum</th><th className="p-3 text-left">NFC-UID</th><th className="p-3 text-left">Typ</th><th className="p-3"></th></tr>
          </thead>
          <tbody>
            {(q.data ?? []).map((kp: any) => (
              <tr key={kp.id} className="border-t border-border">
                <td className="p-3 text-muted-foreground">{kp.reihenfolge}</td>
                <td className="p-3 font-medium">{kp.bezeichnung}</td>
                <td className="p-3 text-muted-foreground">{kp.raum ?? "—"}</td>
                <td className="p-3 font-mono text-xs">{kp.nfc_uid ?? "—"}</td>
                <td className="p-3 text-xs uppercase">{kp.nfc_tag_typ}</td>
                <td className="p-3 text-right">
                  <Button size="icon" variant="ghost" onClick={() => { setEditId(kp.id); setForm({ ...kp }); setOpen(true); }}><Pencil className="size-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => confirm("Löschen?") && del.mutate(kp.id)}><Trash2 className="size-4 text-destructive" /></Button>
                </td>
              </tr>
            ))}
            {(q.data ?? []).length === 0 && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Noch keine Kontrollpunkte angelegt.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  listBestreifungsplaene, upsertBestreifungsplan, deleteBestreifungsplan,
  listRundgaenge, listObjekte,
} from "@/lib/owks.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Plus, Trash2, Pencil } from "lucide-react";

export const Route = createFileRoute("/_authenticated/revier-center/owks/bestreifungsplaene")({
  component: BestreifungsplaeneSeite,
});

const WT = [
  { v: 1, l: "Mo" }, { v: 2, l: "Di" }, { v: 3, l: "Mi" }, { v: 4, l: "Do" },
  { v: 5, l: "Fr" }, { v: 6, l: "Sa" }, { v: 7, l: "So" },
];

function BestreifungsplaeneSeite() {
  const qc = useQueryClient();
  const listFn = useServerFn(listBestreifungsplaene);
  const listRg = useServerFn(listRundgaenge);
  const listObj = useServerFn(listObjekte);
  const upFn = useServerFn(upsertBestreifungsplan);
  const delFn = useServerFn(deleteBestreifungsplan);
  const q = useQuery({ queryKey: ["owks-plaene"], queryFn: () => listFn() });
  const rgQ = useQuery({ queryKey: ["owks-rundgaenge"], queryFn: () => listRg() });
  const objQ = useQuery({ queryKey: ["owks-objekte"], queryFn: () => listObj() });

  const empty = {
    rundgang_id: "", objekt_id: null,
    zeit_von: "20:00", zeit_bis: "06:00",
    durchgaenge: 1, min_dauer_minuten: null, max_dauer_minuten: null,
    unterschreitung_unzulaessig: false,
    reihenfolge_modus: "ignorieren" as const,
    manuell_buchen: false,
    wochentage: [1, 2, 3, 4, 5, 6, 7],
    intervall_wochen: 1,
    gueltig_ab: new Date().toISOString().slice(0, 10),
    gueltig_bis: null,
    ferien_modus: "ignorieren",
    aktiv: true,
  };
  const [form, setForm] = useState<any>(empty);
  const [editId, setEditId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const save = useMutation({
    mutationFn: () => upFn({ data: { ...form, id: editId ?? undefined } }),
    onSuccess: () => { toast.success("Gespeichert"); setOpen(false); setEditId(null); setForm(empty); qc.invalidateQueries({ queryKey: ["owks-plaene"] }); },
    onError: (e: any) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["owks-plaene"] }),
  });

  function toggleWt(v: number) {
    const set = new Set<number>(form.wochentage);
    set.has(v) ? set.delete(v) : set.add(v);
    setForm({ ...form, wochentage: Array.from(set).sort() });
  }

  return (
    <div className="p-6 lg:p-8 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Bestreifungspläne</h2>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditId(null); setForm(empty); } }}>
          <DialogTrigger asChild><Button size="sm"><Plus className="size-4 mr-1" />Neuer Plan</Button></DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>{editId ? "Plan bearbeiten" : "Neuer Bestreifungsplan"}</DialogTitle></DialogHeader>
            <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Rundgang</Label>
                  <Select value={form.rundgang_id} onValueChange={(v) => setForm({ ...form, rundgang_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Rundgang wählen" /></SelectTrigger>
                    <SelectContent>{(rgQ.data ?? []).map((r: any) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Objekt (optional)</Label>
                  <Select value={form.objekt_id ?? "none"} onValueChange={(v) => setForm({ ...form, objekt_id: v === "none" ? null : v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— kein Objekt —</SelectItem>
                      {(objQ.data ?? []).map((o: any) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div><Label>Zeit von</Label><Input type="time" value={form.zeit_von} onChange={(e) => setForm({ ...form, zeit_von: e.target.value })} /></div>
                <div><Label>Zeit bis</Label><Input type="time" value={form.zeit_bis} onChange={(e) => setForm({ ...form, zeit_bis: e.target.value })} /></div>
                <div><Label>Durchgänge</Label><Input type="number" min={1} value={form.durchgaenge} onChange={(e) => setForm({ ...form, durchgaenge: parseInt(e.target.value || "1") })} /></div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div><Label>Min. Dauer (min)</Label><Input type="number" value={form.min_dauer_minuten ?? ""} onChange={(e) => setForm({ ...form, min_dauer_minuten: e.target.value ? parseInt(e.target.value) : null })} /></div>
                <div><Label>Max. Dauer (min)</Label><Input type="number" value={form.max_dauer_minuten ?? ""} onChange={(e) => setForm({ ...form, max_dauer_minuten: e.target.value ? parseInt(e.target.value) : null })} /></div>
                <div>
                  <Label>Reihenfolge</Label>
                  <Select value={form.reihenfolge_modus} onValueChange={(v) => setForm({ ...form, reihenfolge_modus: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ignorieren">Ignorieren</SelectItem>
                      <SelectItem value="warnen">Warnen</SelectItem>
                      <SelectItem value="strikt">Strikt</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Wochentage</Label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {WT.map((d) => (
                    <label key={d.v} className={`flex items-center gap-1 px-3 py-1.5 rounded-md border cursor-pointer text-xs ${form.wochentage.includes(d.v) ? "bg-primary text-primary-foreground border-primary" : "border-border"}`}>
                      <input type="checkbox" className="hidden" checked={form.wochentage.includes(d.v)} onChange={() => toggleWt(d.v)} />
                      {d.l}
                    </label>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div><Label>Intervall (Wochen)</Label><Input type="number" min={1} value={form.intervall_wochen} onChange={(e) => setForm({ ...form, intervall_wochen: parseInt(e.target.value || "1") })} /></div>
                <div><Label>Gültig ab</Label><Input type="date" value={form.gueltig_ab} onChange={(e) => setForm({ ...form, gueltig_ab: e.target.value })} /></div>
                <div><Label>Gültig bis</Label><Input type="date" value={form.gueltig_bis ?? ""} onChange={(e) => setForm({ ...form, gueltig_bis: e.target.value || null })} /></div>
              </div>
              <div className="flex gap-4 pt-2">
                <label className="flex items-center gap-2 text-sm"><Checkbox checked={form.unterschreitung_unzulaessig} onCheckedChange={(v) => setForm({ ...form, unterschreitung_unzulaessig: !!v })} />Unterschreitung unzulässig</label>
                <label className="flex items-center gap-2 text-sm"><Checkbox checked={form.manuell_buchen} onCheckedChange={(v) => setForm({ ...form, manuell_buchen: !!v })} />Manuell buchen</label>
                <label className="flex items-center gap-2 text-sm"><Checkbox checked={form.aktiv} onCheckedChange={(v) => setForm({ ...form, aktiv: !!v })} />Aktiv</label>
              </div>
            </div>
            <DialogFooter><Button onClick={() => save.mutate()} disabled={save.isPending || !form.rundgang_id}>Speichern</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr><th className="p-3 text-left">Rundgang</th><th className="p-3 text-left">Objekt</th><th className="p-3 text-left">Zeit</th><th className="p-3 text-left">Durchg.</th><th className="p-3 text-left">Tage</th><th className="p-3 text-left">Status</th><th className="p-3"></th></tr>
          </thead>
          <tbody>
            {(q.data ?? []).map((p: any) => (
              <tr key={p.id} className="border-t border-border">
                <td className="p-3 font-medium">{p.owks_rundgaenge?.name ?? "—"}</td>
                <td className="p-3 text-muted-foreground">{p.owks_objekte?.name ?? "—"}</td>
                <td className="p-3">{String(p.zeit_von).slice(0,5)}–{String(p.zeit_bis).slice(0,5)}</td>
                <td className="p-3">{p.durchgaenge}</td>
                <td className="p-3 text-xs">{(p.wochentage ?? []).map((d: number) => WT.find((w) => w.v === d)?.l).join(",")}</td>
                <td className="p-3 text-xs">{p.aktiv ? "Aktiv" : "Inaktiv"}</td>
                <td className="p-3 text-right">
                  <Button size="icon" variant="ghost" onClick={() => { setEditId(p.id); setForm({ ...p, gueltig_ab: p.gueltig_ab, gueltig_bis: p.gueltig_bis }); setOpen(true); }}><Pencil className="size-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => confirm("Löschen?") && del.mutate(p.id)}><Trash2 className="size-4 text-destructive" /></Button>
                </td>
              </tr>
            ))}
            {(q.data ?? []).length === 0 && <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Noch keine Pläne angelegt.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
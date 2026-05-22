import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { listRundgaenge, upsertRundgang, deleteRundgang, listObjekte } from "@/lib/owks.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Trash2, Pencil } from "lucide-react";

export const Route = createFileRoute("/_authenticated/revier-center/owks/rundgaenge")({
  component: RundgaengeSeite,
});

function RundgaengeSeite() {
  const qc = useQueryClient();
  const listFn = useServerFn(listRundgaenge);
  const upFn = useServerFn(upsertRundgang);
  const delFn = useServerFn(deleteRundgang);
  const objFn = useServerFn(listObjekte);
  const q = useQuery({ queryKey: ["owks-rundgaenge"], queryFn: () => listFn() });
  const objQ = useQuery({ queryKey: ["owks-objekte"], queryFn: () => objFn() });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ name: "", rundgang_nr: "", objekt_id: null, beschreibung: "" });
  const [editId, setEditId] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: async () => upFn({ data: { ...form, id: editId ?? undefined } }),
    onSuccess: () => { toast.success("Gespeichert"); setOpen(false); setEditId(null); qc.invalidateQueries({ queryKey: ["owks-rundgaenge"] }); },
    onError: (e: any) => toast.error(e.message),
  });
  const del = useMutation({ mutationFn: async (id: string) => delFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["owks-rundgaenge"] }) });

  return (
    <div className="p-6 lg:p-8 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Rundgangsverwaltung</h2>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditId(null); setForm({ name: "", rundgang_nr: "", objekt_id: null, beschreibung: "" }); } }}>
          <DialogTrigger asChild><Button size="sm"><Plus className="size-4 mr-1" />Neuer Rundgang</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editId ? "Rundgang bearbeiten" : "Neuer Rundgang"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>Rundgang-Nr.</Label><Input value={form.rundgang_nr ?? ""} onChange={(e) => setForm({ ...form, rundgang_nr: e.target.value })} /></div>
              <div>
                <Label>Objekt</Label>
                <Select value={form.objekt_id ?? ""} onValueChange={(v) => setForm({ ...form, objekt_id: v || null })}>
                  <SelectTrigger><SelectValue placeholder="Objekt wählen…" /></SelectTrigger>
                  <SelectContent>
                    {(objQ.data ?? []).map((o: any) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Beschreibung</Label><Textarea value={form.beschreibung ?? ""} onChange={(e) => setForm({ ...form, beschreibung: e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={() => save.mutate()} disabled={save.isPending || !form.name}>Speichern</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr><th className="p-3 text-left">Rundgang</th><th className="p-3 text-left">Nr.</th><th className="p-3 text-left">Kontrollpunkte</th><th className="p-3 text-left">Objekt</th><th className="p-3"></th></tr>
          </thead>
          <tbody>
            {(q.data ?? []).map((r: any) => {
              const obj = (objQ.data ?? []).find((o: any) => o.id === r.objekt_id);
              const kp = r.owks_kontrollpunkte?.[0]?.count ?? 0;
              return (
                <tr key={r.id} className="border-t border-border">
                  <td className="p-3 font-medium">{r.name}</td>
                  <td className="p-3 text-muted-foreground">{r.rundgang_nr ?? "—"}</td>
                  <td className="p-3">{kp}</td>
                  <td className="p-3 text-muted-foreground">{obj?.name ?? "—"}</td>
                  <td className="p-3 text-right">
                    <Button size="icon" variant="ghost" onClick={() => { setEditId(r.id); setForm(r); setOpen(true); }}><Pencil className="size-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => { if (confirm("Löschen?")) del.mutate(r.id); }}><Trash2 className="size-4 text-destructive" /></Button>
                  </td>
                </tr>
              );
            })}
            {(q.data ?? []).length === 0 && <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Noch keine Rundgänge angelegt.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

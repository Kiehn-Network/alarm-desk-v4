import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { listObjekte, upsertObjekt, deleteObjekt } from "@/lib/owks.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Trash2, Pencil } from "lucide-react";

export const Route = createFileRoute("/_authenticated/revier-center/owks/objekte")({
  component: ObjekteSeite,
});

function ObjekteSeite() {
  const qc = useQueryClient();
  const listFn = useServerFn(listObjekte);
  const upFn = useServerFn(upsertObjekt);
  const delFn = useServerFn(deleteObjekt);
  const q = useQuery({ queryKey: ["owks-objekte"], queryFn: () => listFn() });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ name: "", kunden_name: "", adresse: "", ort: "", plz: "", notizen: "" });
  const [editId, setEditId] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: async () => upFn({ data: { ...form, id: editId ?? undefined } }),
    onSuccess: () => { toast.success("Gespeichert"); setOpen(false); setEditId(null); qc.invalidateQueries({ queryKey: ["owks-objekte"] }); },
    onError: (e: any) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: async (id: string) => delFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["owks-objekte"] }),
  });

  return (
    <div className="p-6 lg:p-8 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Objekte</h2>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditId(null); setForm({ name: "", kunden_name: "", adresse: "", ort: "", plz: "", notizen: "" }); } }}>
          <DialogTrigger asChild><Button size="sm"><Plus className="size-4 mr-1" />Neues Objekt</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editId ? "Objekt bearbeiten" : "Neues Objekt"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>Kunde</Label><Input value={form.kunden_name ?? ""} onChange={(e) => setForm({ ...form, kunden_name: e.target.value })} /></div>
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2"><Label>Adresse</Label><Input value={form.adresse ?? ""} onChange={(e) => setForm({ ...form, adresse: e.target.value })} /></div>
                <div><Label>PLZ</Label><Input value={form.plz ?? ""} onChange={(e) => setForm({ ...form, plz: e.target.value })} /></div>
              </div>
              <div><Label>Ort</Label><Input value={form.ort ?? ""} onChange={(e) => setForm({ ...form, ort: e.target.value })} /></div>
              <div><Label>Notizen</Label><Textarea value={form.notizen ?? ""} onChange={(e) => setForm({ ...form, notizen: e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={() => save.mutate()} disabled={save.isPending || !form.name}>Speichern</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr><th className="p-3 text-left">Name</th><th className="p-3 text-left">Kunde</th><th className="p-3 text-left">Adresse</th><th className="p-3"></th></tr>
          </thead>
          <tbody>
            {(q.data ?? []).map((o: any) => (
              <tr key={o.id} className="border-t border-border">
                <td className="p-3 font-medium">{o.name}</td>
                <td className="p-3 text-muted-foreground">{o.kunden_name ?? "—"}</td>
                <td className="p-3 text-muted-foreground">{[o.adresse, o.plz, o.ort].filter(Boolean).join(", ") || "—"}</td>
                <td className="p-3 text-right">
                  <Button size="icon" variant="ghost" onClick={() => { setEditId(o.id); setForm(o); setOpen(true); }}><Pencil className="size-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => { if (confirm("Löschen?")) del.mutate(o.id); }}><Trash2 className="size-4 text-destructive" /></Button>
                </td>
              </tr>
            ))}
            {(q.data ?? []).length === 0 && <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">Noch keine Objekte angelegt.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

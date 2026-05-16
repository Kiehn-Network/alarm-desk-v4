import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listMitarbeiter, createMitarbeiter, updateMitarbeiter, deleteMitarbeiter,
} from "@/lib/rohrservice.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Users } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/notdienst/rohrservice/mitarbeiter")({
  component: MitarbeiterSeite,
});

function MitarbeiterSeite() {
  const qc = useQueryClient();
  const listFn = useServerFn(listMitarbeiter);
  const createFn = useServerFn(createMitarbeiter);
  const updFn = useServerFn(updateMitarbeiter);
  const delFn = useServerFn(deleteMitarbeiter);

  const { data } = useQuery({ queryKey: ["rs-mitarbeiter"], queryFn: () => listFn() });
  const mitarbeiter = (data?.mitarbeiter ?? []) as any[];

  const [name, setName] = useState("");
  const [t1, setT1] = useState("");
  const [t2, setT2] = useState("");

  const create = useMutation({
    mutationFn: () => createFn({ data: { name, telefon_1: t1 || null, telefon_2: t2 || null } }),
    onSuccess: () => {
      toast.success("Mitarbeiter angelegt");
      setName(""); setT1(""); setT2("");
      qc.invalidateQueries({ queryKey: ["rs-mitarbeiter"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Fehler"),
  });

  const upd = useMutation({
    mutationFn: (m: any) => updFn({ data: m }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rs-mitarbeiter"] }),
  });

  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rs-mitarbeiter"] }),
  });

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="text-center">
        <h1 className="text-2xl md:text-3xl font-bold text-primary flex items-center justify-center gap-2">
          <Users className="size-6" /> Mitarbeiter
        </h1>
        <p className="text-muted-foreground text-sm">Für die Notdienst-Auswahl</p>
      </div>

      <div className="rounded-lg border border-border bg-card p-4 space-y-3" style={{ boxShadow: "var(--shadow-card)" }}>
        <div className="text-sm font-semibold">Neuer Mitarbeiter</div>
        <div className="grid sm:grid-cols-3 gap-3">
          <div className="space-y-1.5"><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Telefon 1</Label><Input value={t1} onChange={(e) => setT1(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Telefon 2</Label><Input value={t2} onChange={(e) => setT2(e.target.value)} /></div>
        </div>
        <Button onClick={() => create.mutate()} disabled={!name.trim() || create.isPending}>
          <Plus className="size-4 mr-1" /> Hinzufügen
        </Button>
      </div>

      <div className="rounded-lg border border-border bg-card overflow-x-auto" style={{ boxShadow: "var(--shadow-card)" }}>
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-3">Name</th>
              <th className="text-left px-4 py-3">Telefon 1</th>
              <th className="text-left px-4 py-3">Telefon 2</th>
              <th className="text-right px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {mitarbeiter.length === 0 && <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">Keine Mitarbeiter.</td></tr>}
            {mitarbeiter.map((m) => (
              <tr key={m.id} className="border-t border-border">
                <td className="px-4 py-2">
                  <Input defaultValue={m.name} onBlur={(e) => e.target.value !== m.name && upd.mutate({ id: m.id, name: e.target.value })} />
                </td>
                <td className="px-4 py-2">
                  <Input defaultValue={m.telefon_1 ?? ""} onBlur={(e) => e.target.value !== (m.telefon_1 ?? "") && upd.mutate({ id: m.id, telefon_1: e.target.value || null })} />
                </td>
                <td className="px-4 py-2">
                  <Input defaultValue={m.telefon_2 ?? ""} onBlur={(e) => e.target.value !== (m.telefon_2 ?? "") && upd.mutate({ id: m.id, telefon_2: e.target.value || null })} />
                </td>
                <td className="px-4 py-2 text-right">
                  <Button size="sm" variant="destructive" onClick={() => { if (confirm("Mitarbeiter löschen?")) del.mutate(m.id); }}>
                    <Trash2 className="size-3.5" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
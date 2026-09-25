import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Phone, Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { listDienstTelefone, saveDienstTelefon, deleteDienstTelefon } from "@/lib/dienst-telefone.functions";

export function DienstTelefonePanel() {
  const qc = useQueryClient();
  const list = useServerFn(listDienstTelefone);
  const save = useServerFn(saveDienstTelefon);
  const del = useServerFn(deleteDienstTelefon);
  const { data } = useQuery({ queryKey: ["dienst-telefone"], queryFn: () => list() });
  const [name, setName] = useState("");
  const [nummer, setNummer] = useState("");
  const refresh = () => qc.invalidateQueries({ queryKey: ["dienst-telefone"] });

  const add = async () => {
    try { await save({ data: { name, nummer, aktiv: true } }); setName(""); setNummer(""); refresh(); toast.success("Telefon angelegt"); }
    catch (e: any) { toast.error(e?.message ?? "Fehler"); }
  };

  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2"><Phone className="size-4" /> Diensttelefone</h2>
        <p className="text-sm text-muted-foreground">Fahrer wählen in „Meine Einsätze“, welches Telefon sie dabei haben. Diese Nummer erscheint im Dashboard beim Anruf-Button.</p>
      </div>
      <div className="flex flex-wrap gap-2 rounded-xl border border-border bg-card p-3">
        <Input className="flex-1 min-w-40" placeholder="Name, z. B. Revier Nord" value={name} onChange={(e) => setName(e.target.value)} />
        <Input className="flex-1 min-w-40" type="tel" placeholder="+49 170 1234567" value={nummer} onChange={(e) => setNummer(e.target.value)} />
        <Button onClick={add} disabled={!name.trim() || nummer.trim().length < 3}><Plus className="size-4 mr-1" />Hinzufügen</Button>
      </div>
      <div className="rounded-xl border border-border bg-card divide-y divide-border">
        {(data?.telefone ?? []).length === 0 && <p className="p-4 text-sm text-muted-foreground">Noch keine Telefone hinterlegt.</p>}
        {(data?.telefone ?? []).map((t) => (
          <div key={t.id} className="flex items-center gap-3 p-3">
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{t.name}</div>
              <div className="text-sm text-muted-foreground">{t.nummer}</div>
            </div>
            <Switch checked={t.aktiv} onCheckedChange={async (v) => { await save({ data: { id: t.id, name: t.name, nummer: t.nummer, aktiv: v } }); refresh(); }} aria-label="Aktiv" />
            <Button variant="ghost" size="icon" aria-label="Löschen" onClick={async () => {
              if (!confirm(`„${t.name}“ löschen?`)) return;
              await del({ data: { id: t.id } }); refresh();
            }}><Trash2 className="size-4" /></Button>
          </div>
        ))}
      </div>
    </div>
  );
}

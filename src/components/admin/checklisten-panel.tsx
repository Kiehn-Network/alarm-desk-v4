import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ListChecks, Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  listChecklistenVorlagen, saveChecklistenVorlage, deleteChecklistenVorlage,
} from "@/lib/checklisten.functions";

type Punkt = { text: string; required: boolean };
type Vorlage = {
  id?: string;
  name: string;
  einsatz_typ: "av_einsatz" | "hausnotruf" | "beide";
  punkte: Punkt[];
  aktiv: boolean;
};

const TYP_LABEL: Record<string, string> = {
  beide: "Beide Einsatzarten",
  av_einsatz: "AV-Einsatz",
  hausnotruf: "Hausnotruf",
};

function emptyVorlage(): Vorlage {
  return { name: "", einsatz_typ: "beide", punkte: [{ text: "", required: true }], aktiv: true };
}

export function ChecklistenPanel() {
  const qc = useQueryClient();
  const listFn = useServerFn(listChecklistenVorlagen);
  const saveFn = useServerFn(saveChecklistenVorlage);
  const deleteFn = useServerFn(deleteChecklistenVorlage);
  const { data, isLoading } = useQuery({
    queryKey: ["checklisten-vorlagen"],
    queryFn: () => listFn(),
  });
  const vorlagen = (data?.vorlagen ?? []) as any[];

  const [edit, setEdit] = useState<Vorlage | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!edit) return;
    if (!edit.name.trim()) { toast.error("Bitte einen Namen angeben"); return; }
    const punkte = edit.punkte.filter((p) => p.text.trim());
    if (punkte.length === 0) { toast.error("Mindestens einen Prüfpunkt angeben"); return; }
    setBusy(true);
    try {
      await saveFn({
        data: {
          id: edit.id,
          name: edit.name.trim(),
          einsatz_typ: edit.einsatz_typ,
          punkte: punkte.map((p) => ({ text: p.text.trim(), required: p.required })),
          aktiv: edit.aktiv,
        },
      });
      toast.success("Checkliste gespeichert");
      setEdit(null);
      qc.invalidateQueries({ queryKey: ["checklisten-vorlagen"] });
    } catch (e: any) {
      toast.error(e.message ?? "Fehler");
    } finally { setBusy(false); }
  }

  async function del(id: string) {
    if (!window.confirm("Checkliste wirklich löschen?")) return;
    try {
      await deleteFn({ data: { id } });
      toast.success("Checkliste gelöscht");
      qc.invalidateQueries({ queryKey: ["checklisten-vorlagen"] });
    } catch (e: any) { toast.error(e.message ?? "Fehler"); }
  }

  async function toggleAktiv(v: any, aktiv: boolean) {
    try {
      await saveFn({
        data: {
          id: v.id,
          name: v.name,
          einsatz_typ: v.einsatz_typ,
          punkte: (v.punkte ?? []).map((p: any) => ({ text: p.text, required: !!p.required })),
          aktiv,
        },
      });
      qc.invalidateQueries({ queryKey: ["checklisten-vorlagen"] });
    } catch (e: any) { toast.error(e.message ?? "Fehler"); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <ListChecks className="size-5" /> Checklisten
          </h2>
          <p className="text-sm text-muted-foreground">
            Vorlagen pro Einsatztyp. Pflichtpunkte (*) müssen vom Fahrer abgehakt werden, bevor die Checkliste abgeschlossen werden kann.
          </p>
        </div>
        <Button className="gap-1.5" onClick={() => setEdit(emptyVorlage())}>
          <Plus className="size-4" /> Neue Checkliste
        </Button>
      </div>

      {isLoading ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">Lade…</div>
      ) : vorlagen.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Noch keine Checklisten angelegt.
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card divide-y divide-border">
          {vorlagen.map((v) => (
            <div key={v.id} className="p-4 flex items-center gap-3 flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <div className="font-medium flex items-center gap-2 flex-wrap">
                  {v.name}
                  {!v.aktiv && <Badge variant="secondary">Inaktiv</Badge>}
                </div>
                <div className="text-sm text-muted-foreground">
                  {TYP_LABEL[v.einsatz_typ] ?? v.einsatz_typ} · {(v.punkte ?? []).length} Punkte
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Aktiv</span>
                <Switch checked={!!v.aktiv} onCheckedChange={(c) => toggleAktiv(v, c)} />
                <Button variant="outline" size="icon" onClick={() => setEdit({
                  id: v.id,
                  name: v.name,
                  einsatz_typ: v.einsatz_typ,
                  punkte: (v.punkte ?? []).map((p: any) => ({ text: p.text, required: !!p.required })),
                  aktiv: !!v.aktiv,
                })}>
                  <Pencil className="size-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={() => del(v.id)}>
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{edit?.id ? "Checkliste bearbeiten" : "Neue Checkliste"}</DialogTitle>
            <DialogDescription>
              Definiere die Prüfpunkte, die der Fahrer am Einsatz abhaken soll.
            </DialogDescription>
          </DialogHeader>

          {edit && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input
                  value={edit.name}
                  placeholder="z. B. Schließkontrolle Objekt"
                  onChange={(e) => setEdit({ ...edit, name: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Einsatzart</Label>
                <Select value={edit.einsatz_typ} onValueChange={(val: any) => setEdit({ ...edit, einsatz_typ: val })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="beide">Beide Einsatzarten</SelectItem>
                    <SelectItem value="av_einsatz">AV-Einsatz</SelectItem>
                    <SelectItem value="hausnotruf">Hausnotruf</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Prüfpunkte</Label>
                {edit.punkte.map((p, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      value={p.text}
                      placeholder={`Punkt ${i + 1}`}
                      onChange={(e) => {
                        const punkte = [...edit.punkte];
                        punkte[i] = { ...punkte[i], text: e.target.value };
                        setEdit({ ...edit, punkte });
                      }}
                    />
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground whitespace-nowrap">
                      <Checkbox
                        checked={p.required}
                        onCheckedChange={(v) => {
                          const punkte = [...edit.punkte];
                          punkte[i] = { ...punkte[i], required: v === true };
                          setEdit({ ...edit, punkte });
                        }}
                      />
                      Pflicht
                    </label>
                    <Button
                      variant="ghost" size="icon"
                      disabled={edit.punkte.length <= 1}
                      onClick={() => setEdit({ ...edit, punkte: edit.punkte.filter((_, j) => j !== i) })}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="outline" size="sm" className="gap-1.5"
                  onClick={() => setEdit({ ...edit, punkte: [...edit.punkte, { text: "", required: false }] })}
                >
                  <Plus className="size-3.5" /> Punkt hinzufügen
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={edit.aktiv} onCheckedChange={(c) => setEdit({ ...edit, aktiv: c })} />
                <Label>Aktiv (am Einsatz auswählbar)</Label>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEdit(null)}>Abbrechen</Button>
            <Button onClick={save} disabled={busy}>Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

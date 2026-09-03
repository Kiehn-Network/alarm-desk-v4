import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Nfc, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  listLagerPersonen, upsertLagerPerson, deleteLagerPerson, type LagerPerson,
} from "@/lib/lager.functions";

const EMPTY = { name: "", personalnummer: "", transponder_id: "", aktiv: true, notiz: "" };

function fmt(d?: string | null) {
  if (!d) return "–";
  return new Date(d).toLocaleString("de-DE", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export function LagerBenutzerPanel() {
  const qc = useQueryClient();
  const load = useServerFn(listLagerPersonen);
  const save = useServerFn(upsertLagerPerson);
  const del = useServerFn(deleteLagerPerson);
  const [edit, setEdit] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);
  const scanRef = useRef<HTMLInputElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["lager-personen"],
    queryFn: () => load({ data: {} } as any),
  });
  const rows = (data?.rows ?? []) as LagerPerson[];

  // Beim Öffnen des Dialogs direkt auf das Transponder-Feld fokussieren (USB-Leser)
  useEffect(() => {
    if (edit) setTimeout(() => scanRef.current?.focus(), 120);
  }, [edit]);

  async function handleSave() {
    if (!edit?.name?.trim()) { toast.error("Bitte einen Namen angeben."); return; }
    if (!edit?.transponder_id?.trim()) { toast.error("Bitte einen Transponder scannen."); return; }
    setBusy(true);
    try {
      await save({ data: edit } as any);
      toast.success("Lager-Benutzer gespeichert");
      setEdit(null);
      qc.invalidateQueries({ queryKey: ["lager-personen"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Fehler beim Speichern");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Diesen Lager-Benutzer wirklich löschen?")) return;
    try {
      await del({ data: { id } } as any);
      toast.success("Gelöscht");
      qc.invalidateQueries({ queryKey: ["lager-personen"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Fehler");
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-base">Lager-Benutzer</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Benutzer für die Lager-Station. Anmeldung erfolgt ausschließlich über den Transponder – Rolle: Technik.
          </p>
        </div>
        <Button size="sm" onClick={() => setEdit({ ...EMPTY })}>
          <Plus className="size-4" /> Lager-Benutzer
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-sm text-muted-foreground">Lade…</div>
        ) : rows.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            Noch keine Lager-Benutzer angelegt. Lege einen Benutzer an und scanne dabei seinen Transponder.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-3">Name</th>
                  <th className="py-2 pr-3">Pers.-Nr.</th>
                  <th className="py-2 pr-3">Transponder</th>
                  <th className="py-2 pr-3">Rolle</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Letzter Login</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-border">
                    <td className="py-2 pr-3 font-medium">{r.name}</td>
                    <td className="py-2 pr-3 text-muted-foreground">{r.personalnummer ?? "–"}</td>
                    <td className="py-2 pr-3 font-mono">{r.transponder_id}</td>
                    <td className="py-2 pr-3">
                      <Badge variant="outline" className="gap-1">
                        <Wrench className="size-3" /> Technik
                      </Badge>
                    </td>
                    <td className="py-2 pr-3">
                      {r.aktiv ? <Badge variant="secondary">aktiv</Badge> : <Badge variant="destructive">gesperrt</Badge>}
                    </td>
                    <td className="py-2 pr-3 text-muted-foreground">{fmt(r.last_login_at)}</td>
                    <td className="py-2 text-right whitespace-nowrap">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setEdit({
                          id: r.id, name: r.name, personalnummer: r.personalnummer ?? "",
                          transponder_id: r.transponder_id, aktiv: r.aktiv, notiz: r.notiz ?? "",
                        })}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(r.id)}>
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{edit?.id ? "Lager-Benutzer bearbeiten" : "Neuer Lager-Benutzer"}</DialogTitle>
            <DialogDescription>
              Rolle: Technik. Der Transponder wird direkt am Leser gescannt.
            </DialogDescription>
          </DialogHeader>
          {edit && (
            <div className="space-y-3">
              <div>
                <Label>Name</Label>
                <Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
              </div>
              <div>
                <Label>Personalnummer (optional)</Label>
                <Input value={edit.personalnummer} onChange={(e) => setEdit({ ...edit, personalnummer: e.target.value })} />
              </div>
              <div>
                <Label className="flex items-center gap-2"><Nfc className="size-4" /> Transponder-Nummer</Label>
                <Input
                  ref={scanRef}
                  className="font-mono tracking-widest"
                  placeholder="Transponder jetzt am Leser scannen …"
                  value={edit.transponder_id}
                  onChange={(e) => setEdit({ ...edit, transponder_id: e.target.value })}
                  onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }}
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                <span className="text-sm">Aktiv</span>
                <Switch checked={edit.aktiv} onCheckedChange={(v) => setEdit({ ...edit, aktiv: v })} />
              </div>
              <div>
                <Label>Notiz</Label>
                <Textarea rows={2} value={edit.notiz} onChange={(e) => setEdit({ ...edit, notiz: e.target.value })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEdit(null)}>Abbrechen</Button>
            <Button onClick={handleSave} disabled={busy}>Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

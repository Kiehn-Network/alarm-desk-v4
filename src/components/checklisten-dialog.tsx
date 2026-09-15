import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ListChecks, Plus, CheckCircle2, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  listChecklistenVorlagen, listEinsatzChecklisten, startEinsatzCheckliste,
  toggleChecklistenPunkt, completeEinsatzCheckliste, type CheckPunkt,
} from "@/lib/checklisten.functions";

function fmt(d?: string | null) {
  if (!d) return "–";
  return new Date(d).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

type Vorlage = any;
type Checkliste = any;

export function ChecklistenDialog({
  einsatzId, einsatzTyp, open, onClose,
}: {
  einsatzId: string;
  einsatzTyp?: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const listVorlagenFn = useServerFn(listChecklistenVorlagen);
  const listFn = useServerFn(listEinsatzChecklisten);
  const startFn = useServerFn(startEinsatzCheckliste);
  const toggleFn = useServerFn(toggleChecklistenPunkt);
  const completeFn = useServerFn(completeEinsatzCheckliste);

  const { data: vData } = useQuery({
    queryKey: ["checklisten-vorlagen"],
    queryFn: () => listVorlagenFn(),
    enabled: open,
  });
  const { data: cData, refetch, isLoading } = useQuery({
    queryKey: ["einsatz-checklisten", einsatzId],
    queryFn: () => listFn({ data: { einsatz_id: einsatzId } }),
    enabled: open,
  });

  const vorlagen: Vorlage[] = (vData?.vorlagen ?? []).filter((v: Vorlage) =>
    v.aktiv && (!einsatzTyp || v.einsatz_typ === "beide" || v.einsatz_typ === einsatzTyp),
  );
  const checklisten: Checkliste[] = cData?.checklisten ?? [];
  const gestartetIds = new Set(checklisten.map((c) => c.vorlage_id));
  const verfuegbar = vorlagen.filter((v) => !gestartetIds.has(v.id) || checklisten.every((c) => c.vorlage_id !== v.id || c.abgeschlossen));

  async function start(vorlageId: string) {
    try {
      await startFn({ data: { einsatz_id: einsatzId, vorlage_id: vorlageId } });
      refetch();
      qc.invalidateQueries({ queryKey: ["checklisten-status"] });
    } catch (e: any) { toast.error(e.message ?? "Fehler"); }
  }

  async function toggle(id: string, index: number, checked: boolean) {
    try {
      await toggleFn({ data: { id, index, checked } });
      refetch();
    } catch (e: any) { toast.error(e.message ?? "Fehler"); }
  }

  async function complete(id: string) {
    try {
      await completeFn({ data: { id } });
      toast.success("Checkliste abgeschlossen");
      refetch();
      qc.invalidateQueries({ queryKey: ["checklisten-status"] });
    } catch (e: any) { toast.error(e.message ?? "Fehler"); }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ListChecks className="size-5" /> Checklisten
          </DialogTitle>
          <DialogDescription>
            Punkte abhaken – Pflichtpunkte (*) müssen erledigt sein, bevor die Checkliste abgeschlossen werden kann.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {isLoading ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Lade…</p>
          ) : checklisten.length === 0 && vorlagen.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Für diesen Einsatztyp ist keine Checkliste hinterlegt.
            </p>
          ) : null}

          {checklisten.map((c) => {
            const punkte = (c.punkte ?? []) as CheckPunkt[];
            const pflichtOffen = punkte.filter((p) => p.required && !p.checked).length;
            return (
              <div key={c.id} className="rounded-lg border border-border p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm">{c.vorlage_name}</span>
                  {c.abgeschlossen ? (
                    <Badge className="bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">Erledigt</Badge>
                  ) : (
                    <Badge variant="secondary">Offen{pflichtOffen > 0 ? ` · ${pflichtOffen} Pflicht` : ""}</Badge>
                  )}
                  {c.abgeschlossen_am && (
                    <span className="ml-auto text-xs text-muted-foreground">{fmt(c.abgeschlossen_am)}</span>
                  )}
                </div>
                <ul className="space-y-1.5">
                  {punkte.map((p, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <Checkbox
                        id={`cp-${c.id}-${i}`}
                        className="mt-0.5"
                        checked={!!p.checked}
                        disabled={c.abgeschlossen}
                        onCheckedChange={(v) => toggle(c.id, i, v === true)}
                      />
                      <label
                        htmlFor={`cp-${c.id}-${i}`}
                        className={`text-sm leading-snug ${p.checked ? "text-muted-foreground line-through" : ""}`}
                      >
                        {p.required ? <span className="text-destructive">*</span> : null} {p.text}
                      </label>
                    </li>
                  ))}
                </ul>
                {!c.abgeschlossen && (
                  <Button size="sm" className="w-full gap-1.5" onClick={() => complete(c.id)} disabled={pflichtOffen > 0}>
                    <CheckCircle2 className="size-4" /> Checkliste abschließen
                  </Button>
                )}
              </div>
            );
          })}

          {verfuegbar.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-border">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Checkliste starten</p>
              {verfuegbar.map((v) => (
                <div key={v.id} className="flex items-center gap-2">
                  <span className="text-sm flex-1 min-w-0 truncate">{v.name}</span>
                  <span className="text-xs text-muted-foreground">{(v.punkte ?? []).length} Punkte</span>
                  <Button size="sm" variant="outline" className="gap-1" onClick={() => start(v.id)}>
                    <Plus className="size-3.5" /> Starten
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ChecklistenStatusBadge({ status }: { status?: { offen: number; erledigt: number } | null }) {
  if (!status || (status.offen === 0 && status.erledigt === 0)) return null;
  if (status.offen > 0) {
    return (
      <Badge variant="secondary" className="gap-1">
        <Circle className="size-3" /> Checkliste offen
      </Badge>
    );
  }
  return (
    <Badge className="gap-1 bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
      <CheckCircle2 className="size-3" /> Checkliste erledigt
    </Badge>
  );
}

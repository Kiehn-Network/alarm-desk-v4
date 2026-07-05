import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Sparkles, CheckCircle2, Circle, X } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { TOUR_STEPS, stepsForRole } from "@/lib/tour-steps";
import { markTourCompleted } from "@/lib/tour.functions";
import { useRole } from "@/hooks/use-role";

export function TourDialog({
  open, onOpenChange, enabledKeys, onCompleted,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  enabledKeys?: string[] | null;
  onCompleted?: () => void;
}) {
  const { role } = useRole();
  const steps = stepsForRole(role, enabledKeys ?? null);
  const total = Math.max(1, steps.length);
  const [idx, setIdx] = useState(0);
  // pro Schritt merken, welche Details bereits abgehakt sind
  const [checked, setChecked] = useState<Record<string, Set<number>>>({});
  const navigate = useNavigate();
  const qc = useQueryClient();
  const finish = useServerFn(markTourCompleted);

  const step = steps[Math.min(idx, steps.length - 1)] ?? TOUR_STEPS[0];
  const Icon = step.icon;
  const isLast = idx >= steps.length - 1;
  const stepChecks = checked[step.key] ?? new Set<number>();
  const allChecked = step.details.length === 0 || stepChecks.size >= step.details.length;

  const totalDone = useMemo(() => {
    let done = 0;
    for (const s of steps) {
      const c = checked[s.key];
      if (s.details.length === 0 || (c && c.size >= s.details.length)) done++;
    }
    return done;
  }, [checked, steps]);

  const toggleDetail = (i: number) => {
    setChecked((prev) => {
      const next = new Set(prev[step.key] ?? []);
      if (next.has(i)) next.delete(i); else next.add(i);
      return { ...prev, [step.key]: next };
    });
  };
  const markAll = () => {
    setChecked((prev) => ({
      ...prev,
      [step.key]: new Set(step.details.map((_, i) => i)),
    }));
  };

  const handleClose = async () => {
    try { await finish(); } catch { /* ignore */ }
    qc.invalidateQueries({ queryKey: ["my-tour"] });
    onCompleted?.();
    onOpenChange(false);
  };

  if (steps.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) void handleClose(); else onOpenChange(true); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Sparkles className="size-3.5" />
            <span>Einführung</span>
            <span className="ml-auto">
              Schritt {idx + 1} / {total} · {totalDone} erledigt
            </span>
          </div>
          <div className="flex items-center gap-3 mt-2">
            <div className="size-12 rounded-xl bg-primary/10 grid place-items-center text-primary shrink-0">
              <Icon className="size-6" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-xl">{step.title}</DialogTitle>
              <DialogDescription>{step.description}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="mt-2 rounded-lg border border-border bg-muted/30 p-4">
          <p className="text-xs text-muted-foreground mb-2">
            Tippe auf jeden Punkt, sobald du ihn verstanden hast.
          </p>
          <ul className="space-y-1">
            {step.details.map((d, i) => {
              const isOn = stepChecks.has(i);
              return (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => toggleDetail(i)}
                    className={`w-full text-left flex gap-2 text-sm rounded-md p-2 transition-colors ${
                      isOn ? "bg-primary/10" : "hover:bg-muted"
                    }`}
                  >
                    {isOn ? (
                      <CheckCircle2 className="size-4 text-primary mt-0.5 shrink-0" />
                    ) : (
                      <Circle className="size-4 text-muted-foreground mt-0.5 shrink-0" />
                    )}
                    <span className={isOn ? "line-through text-muted-foreground" : ""}>{d}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="flex flex-wrap gap-2 mt-3">
            {step.details.length > 0 && !allChecked && (
              <Button variant="secondary" size="sm" onClick={markAll}>
                Alle als verstanden markieren
              </Button>
            )}
            {step.route && (
              <Button
                variant="outline" size="sm"
                onClick={() => { onOpenChange(false); navigate({ to: step.route! }); }}
              >
                Jetzt ausprobieren →
              </Button>
            )}
          </div>
        </div>

        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden mt-2">
          <div className="h-full bg-primary transition-all"
            style={{ width: `${(totalDone / total) * 100}%` }} />
        </div>

        <div className="flex items-center justify-between gap-2 mt-2">
          <Button variant="ghost" size="sm" onClick={() => void handleClose()}>
            <X className="size-4 mr-1" /> Überspringen
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={idx === 0}
              onClick={() => setIdx((i) => Math.max(0, i - 1))}>
              <ChevronLeft className="size-4 mr-1" /> Zurück
            </Button>
            {isLast ? (
              <Button size="sm" disabled={!allChecked} onClick={() => void handleClose()}>
                Fertig <CheckCircle2 className="size-4 ml-1" />
              </Button>
            ) : (
              <Button size="sm" disabled={!allChecked}
                onClick={() => setIdx((i) => Math.min(steps.length - 1, i + 1))}>
                Weiter <ChevronRight className="size-4 ml-1" />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
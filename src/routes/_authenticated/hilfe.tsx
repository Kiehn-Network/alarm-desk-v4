import { createFileRoute } from "@tanstack/react-router";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Sparkles, Play, CheckCircle2, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TOUR_STEPS, stepsForRole } from "@/lib/tour-steps";
import { useRole } from "@/hooks/use-role";
import { resetMyTour } from "@/lib/tour.functions";

export const Route = createFileRoute("/_authenticated/hilfe")({
  component: HilfePage,
});

function HilfePage() {
  const { role } = useRole();
  const steps = stepsForRole(role, null);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const reset = useServerFn(resetMyTour);

  const restart = useMutation({
    mutationFn: () => reset(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-tour"] });
      window.dispatchEvent(new Event("open-tour"));
      toast.success("Einführung gestartet");
    },
  });

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-5xl">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
            <BookOpen className="size-3.5" /> Anleitung
          </div>
          <h1 className="text-3xl font-bold mt-1">Hilfe & Einführung</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Hier findest du Erklärungen zu allen Bereichen. Du kannst die geführte Tour jederzeit neu starten.
          </p>
        </div>
        <Button onClick={() => restart.mutate()} disabled={restart.isPending}>
          <Play className="size-4 mr-2" /> Tour erneut starten
        </Button>
      </header>

      <div className="grid sm:grid-cols-2 gap-4">
        {steps.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.key} className="rounded-xl border border-border bg-card p-5"
              style={{ boxShadow: "var(--shadow-card)" }}>
              <div className="flex items-start gap-3">
                <div className="size-10 rounded-lg bg-primary/10 grid place-items-center text-primary shrink-0">
                  <Icon className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold">{s.title}</h3>
                    {s.roles && s.roles.map((r) => (
                      <Badge key={r} variant="outline" className="text-[10px]">{r}</Badge>
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{s.description}</p>
                  <ul className="mt-3 space-y-1.5">
                    {s.details.map((d, i) => (
                      <li key={i} className="flex gap-2 text-sm">
                        <CheckCircle2 className="size-4 text-primary mt-0.5 shrink-0" />
                        <span>{d}</span>
                      </li>
                    ))}
                  </ul>
                  {s.route && (
                    <Button variant="link" size="sm" className="px-0 mt-2"
                      onClick={() => navigate({ to: s.route! })}>
                      Zum Bereich →
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border border-dashed border-border bg-muted/30 p-5 text-sm text-muted-foreground flex items-center gap-3">
        <Sparkles className="size-4 text-primary" />
        <span>
          Tipp: Dein Admin kann steuern, ob die Tour automatisch erscheint und welche Schritte gezeigt werden.
        </span>
      </div>
    </div>
  );
}
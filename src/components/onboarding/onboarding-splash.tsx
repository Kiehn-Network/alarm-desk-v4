import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, CheckCircle2 } from "lucide-react";
import { completeOnboarding } from "@/lib/onboarding.functions";

const PHASES = [
  "Firmen-Stammdaten werden geladen…",
  "Berechtigungen werden geprüft…",
  "Bereiche werden vorbereitet…",
  "Demo-Daten werden entfernt…",
  "Ihre Arbeitsumgebung wird eingerichtet…",
];

export function OnboardingSplash({ onDone }: { onDone: () => void }) {
  const finish = useServerFn(completeOnboarding);
  const qc = useQueryClient();
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState(0);
  const [serverDone, setServerDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try { await finish(); } catch { /* ignore */ }
      if (cancelled) return;
      setServerDone(true);
      await qc.invalidateQueries();
    })();
    return () => { cancelled = true; };
  }, [finish, qc]);

  useEffect(() => {
    const start = Date.now();
    const total = 5000;
    const t = setInterval(() => {
      const pct = Math.min(100, ((Date.now() - start) / total) * 100);
      setProgress(pct);
      setPhase(Math.min(PHASES.length - 1, Math.floor((pct / 100) * PHASES.length)));
      if (pct >= 100 && serverDone) {
        clearInterval(t);
        setTimeout(onDone, 400);
      }
    }, 80);
    return () => clearInterval(t);
  }, [onDone, serverDone]);

  const finished = progress >= 100 && serverDone;

  return (
    <div
      className="fixed inset-0 z-[9999] grid place-items-center backdrop-blur-[48px] bg-background/40"
      style={{ backdropFilter: "blur(48px) saturate(140%)" }}
    >
      <div className="w-full max-w-md px-8 py-10 text-center space-y-8 rounded-3xl bg-card/80 border border-border/50 shadow-2xl">
        <div className="mx-auto size-16 rounded-2xl bg-primary/10 text-primary grid place-items-center">
          {finished ? <CheckCircle2 className="size-8" /> : <Loader2 className="size-8 animate-spin" />}
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-foreground">
            Wir bereiten alles für Sie vor
          </h1>
          <p className="text-sm text-muted-foreground">
            Bitte einen Moment – wir laden Ihre Firmen-Daten.
          </p>
        </div>
        <div className="space-y-3">
          <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-100 ease-linear"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="text-xs text-muted-foreground min-h-[1.25rem]">
            {finished ? "Fertig. Willkommen!" : PHASES[phase]}
          </div>
        </div>
      </div>
    </div>
  );
}
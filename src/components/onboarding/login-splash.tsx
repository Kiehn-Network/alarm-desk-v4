import { useEffect, useState } from "react";
import { Loader2, CheckCircle2 } from "lucide-react";

const PHASES = [
  "Hole Daten aus der Datenbank…",
  "Daten auf Vollständigkeit prüfen…",
  "Berechtigungen laden…",
  "Arbeitsplatz vorbereiten…",
];

const TOTAL_MS = 3500;

export function LoginSplash({ onDone }: { onDone: () => void }) {
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const start = Date.now();
    const t = setInterval(() => {
      const pct = Math.min(100, ((Date.now() - start) / TOTAL_MS) * 100);
      setProgress(pct);
      setPhase(Math.min(PHASES.length - 1, Math.floor((pct / 100) * PHASES.length)));
      if (pct >= 100) {
        clearInterval(t);
        setTimeout(onDone, 250);
      }
    }, 60);
    return () => clearInterval(t);
  }, [onDone]);

  const finished = progress >= 100;

  return (
    <div className="fixed inset-0 z-[9999] grid place-items-center backdrop-blur-[48px] bg-background/40">
      <div className="w-full max-w-md px-8 py-10 text-center space-y-8 rounded-3xl bg-card/80 border border-border/50 shadow-2xl">
        <div className="mx-auto size-16 rounded-2xl bg-primary/10 text-primary grid place-items-center">
          {finished ? <CheckCircle2 className="size-8" /> : <Loader2 className="size-8 animate-spin" />}
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-foreground">Willkommen zurück</h1>
          <p className="text-sm text-muted-foreground">Einen Moment – Ihre Arbeitsumgebung wird geladen.</p>
        </div>
        <div className="space-y-3">
          <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-100 ease-linear"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="text-xs text-muted-foreground min-h-[1.25rem]">
            {finished ? "Fertig." : PHASES[phase]}
          </div>
        </div>
      </div>
    </div>
  );
}
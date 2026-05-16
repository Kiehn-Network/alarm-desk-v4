import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

type Props = {
  label: string;
  value?: string | null; // ISO timestamp once set
  onComplete: () => void | Promise<void>;
  durationMs?: number;
  disabled?: boolean;
  icon?: React.ReactNode;
};

function fmtTime(iso?: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("de-DE", {
    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
  });
}

export function HoldButton({ label, value, onComplete, durationMs = 2000, disabled, icon }: Props) {
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);
  const doneRef = useRef(false);

  const cancel = useCallback(() => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    startRef.current = null;
    if (!doneRef.current) setProgress(0);
  }, []);

  useEffect(() => () => cancel(), [cancel]);

  if (value) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm">
        <span className="flex items-center gap-2 text-emerald-300">
          <Check className="size-4" />
          <span className="font-medium">{label}</span>
        </span>
        <span className="text-emerald-200 tabular-nums">{fmtTime(value)}</span>
      </div>
    );
  }

  const start = () => {
    if (disabled || busy) return;
    doneRef.current = false;
    startRef.current = performance.now();
    const tick = (now: number) => {
      if (startRef.current == null) return;
      const p = Math.min(1, (now - startRef.current) / durationMs);
      setProgress(p);
      if (p >= 1) {
        doneRef.current = true;
        startRef.current = null;
        rafRef.current = null;
        void (async () => {
          setBusy(true);
          try { await onComplete(); } finally { setBusy(false); setProgress(0); }
        })();
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  const pct = Math.round(progress * 100);

  return (
    <button
      type="button"
      disabled={disabled || busy}
      onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); start(); }}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      onContextMenu={(e) => e.preventDefault()}
      className={cn(
        "relative w-full select-none overflow-hidden rounded-lg border border-border bg-card px-3 py-3 text-sm font-medium",
        "active:scale-[0.99] transition-transform touch-none",
        disabled && "opacity-50 cursor-not-allowed",
      )}
    >
      <div
        className="absolute inset-y-0 left-0 bg-primary/25 transition-[width] ease-linear"
        style={{ width: `${pct}%` }}
      />
      <div className="relative flex items-center justify-between gap-2">
        <span className="flex items-center gap-2">
          {icon}
          {label}
        </span>
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
          {busy ? "…" : progress > 0 ? `${pct}%` : "2 s halten"}
        </span>
      </div>
    </button>
  );
}
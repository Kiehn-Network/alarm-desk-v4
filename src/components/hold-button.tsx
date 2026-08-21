import { useState } from "react";
import { cn } from "@/lib/utils";
import { Check, Pencil } from "lucide-react";

type Props = {
  label: string;
  value?: string | null; // ISO timestamp once set
  onComplete: (at?: string) => void | Promise<void>;
  /** @deprecated Halten wird nicht mehr benötigt – Button reagiert auf einfachen Klick. */
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

/** ISO -> Wert für <input type="datetime-local"> in lokaler Zeit */
function toLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function HoldButton({ label, value, onComplete, disabled, icon }: Props) {
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const run = async (at?: string) => {
    if (disabled || busy) return;
    setBusy(true);
    try {
      await onComplete(at);
      setEditing(false);
    } finally {
      setBusy(false);
    }
  };

  if (value) {
    if (editing) {
      return (
        <div className="rounded-lg border border-border bg-card px-3 py-2 space-y-2">
          <div className="text-xs font-medium text-muted-foreground">{label} korrigieren</div>
          <input
            type="datetime-local"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy || !draft}
              onClick={() => void run(new Date(draft).toISOString())}
              className="flex-1 rounded-md bg-primary px-2 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
            >
              Speichern
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-md border border-border px-2 py-1.5 text-xs"
            >
              Abbrechen
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="flex items-center justify-between gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm">
        <span className="flex items-center gap-2 text-emerald-300">
          <Check className="size-4" />
          <span className="font-medium">{label}</span>
        </span>
        <span className="flex items-center gap-2">
          <span className="text-emerald-200 tabular-nums">{fmtTime(value)}</span>
          {!disabled && (
            <button
              type="button"
              aria-label={`${label} Zeit ändern`}
              onClick={() => { setDraft(toLocalInput(value)); setEditing(true); }}
              className="rounded-md p-1 text-emerald-200/80 hover:bg-emerald-500/20 hover:text-emerald-100"
            >
              <Pencil className="size-3.5" />
            </button>
          )}
        </span>
      </div>
    );
  }

  return (
    <button
      type="button"
      disabled={disabled || busy}
      onClick={() => void run()}
      className={cn(
        "relative w-full select-none overflow-hidden rounded-lg border border-border bg-card px-3 py-3 text-sm font-medium",
        "active:scale-[0.99] transition-transform hover:bg-muted/50",
        (disabled || busy) && "opacity-50 cursor-not-allowed",
      )}
    >
      <div className="relative flex items-center justify-between gap-2">
        <span className="flex items-center gap-2">
          {icon}
          {label}
        </span>
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
          {busy ? "…" : "stempeln"}
        </span>
      </div>
    </button>
  );
}

import { cn } from "@/lib/utils";

export type ErpStatus = {
  status: "sent" | "pending" | "failed" | null;
  tries?: number;
  last_error?: string | null;
  sent_at?: string | null;
};

export function EsrpStatusLamp({ entry, size = "sm" }: { entry?: ErpStatus | null; size?: "sm" | "md" }) {
  const s = entry?.status ?? null;
  const cls =
    s === "sent" ? "bg-emerald-500" :
    s === "pending" ? "bg-amber-500 animate-pulse" :
    s === "failed" ? "bg-red-500" :
    "bg-muted";
  let title = "ERP: nicht gesendet";
  if (s === "sent") {
    title = "ERP: Erfolgreich gesendet" + (entry?.sent_at ? ` (${new Date(entry.sent_at).toLocaleString("de-DE")})` : "");
  } else if (s === "pending") {
    title = `ERP: Wartet (Versuche: ${entry?.tries ?? 0})`;
  } else if (s === "failed") {
    title = `ERP: Fehler${entry?.tries ? ` · Versuche: ${entry.tries}` : ""}${entry?.last_error ? ` · ${entry.last_error}` : ""}`;
  }
  return (
    <span
      title={title}
      aria-label={title}
      className={cn("inline-block rounded-full", cls, size === "sm" ? "size-2.5" : "size-3.5")}
    />
  );
}
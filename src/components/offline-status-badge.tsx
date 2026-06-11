import { Wifi, WifiOff, CloudUpload } from "lucide-react";
import { useOfflineQueue } from "@/hooks/use-offline-queue";

export function OfflineStatusBadge() {
  const { online, count, flush } = useOfflineQueue();

  if (online && count === 0) {
    return (
      <span
        title="Online"
        className="hidden md:inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
      >
        <Wifi className="size-3.5" /> Online
      </span>
    );
  }

  if (!online) {
    return (
      <span
        title={count > 0 ? `${count} Aktion(en) werden gesendet, sobald wieder online` : "Offline"}
        className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-md bg-amber-500/15 text-amber-400 border border-amber-500/30"
      >
        <WifiOff className="size-3.5" />
        Offline{count > 0 ? ` · ${count} gepuffert` : ""}
      </span>
    );
  }

  // Online + Pending
  return (
    <button
      type="button"
      onClick={() => { void flush(); }}
      title="Jetzt erneut senden"
      className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-md bg-blue-500/15 text-blue-400 border border-blue-500/30 hover:bg-blue-500/25 transition"
    >
      <CloudUpload className="size-3.5 animate-pulse" />
      Sende {count}…
    </button>
  );
}
import { AlertTriangle } from "lucide-react";
import { useAppSettings } from "@/hooks/use-app-settings";

export function MaintenanceBanner() {
  const { data } = useAppSettings();
  if (!data?.wartung_aktiv) return null;
  const farbe = (data.wartung_farbe ?? "info") as "info" | "orange" | "rot";
  const cls =
    farbe === "rot"
      ? "bg-red-500/15 border-red-500/40 text-red-100"
      : farbe === "orange"
      ? "bg-orange-500/15 border-orange-500/40 text-orange-100"
      : "bg-primary/15 border-primary/40 text-primary-foreground";
  return (
    <div className={`border-b ${cls} px-4 py-2 text-sm flex items-center gap-2`}>
      <AlertTriangle className="size-4 shrink-0" />
      <span className="font-medium">Wartungsmodus aktiv</span>
      {data.wartung_nachricht && (
        <span className="text-current/80 truncate">— {data.wartung_nachricht}</span>
      )}
    </div>
  );
}
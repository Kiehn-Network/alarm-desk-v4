import { AlertTriangle } from "lucide-react";
import { useAppSettings } from "@/hooks/use-app-settings";
import { usePlatformSettings } from "@/hooks/use-platform-settings";

export function MaintenanceBanner() {
  const { data } = useAppSettings();
  const { data: platform } = usePlatformSettings();
  // Platform-wide maintenance (set by SuperAdmin) takes priority and applies
  // to every domain. Falls back to the per-domain maintenance flag.
  const platformActive = !!platform?.wartung_aktiv;
  const domainActive = !!data?.wartung_aktiv;
  if (!platformActive && !domainActive) return null;
  const source = platformActive ? platform : data;
  const farbe = (source?.wartung_farbe ?? "info") as "info" | "orange" | "rot";
  const nachricht = source?.wartung_nachricht;
  const label = platformActive ? "Plattform-Wartung aktiv" : "Wartungsmodus aktiv";
  const cls =
    farbe === "rot"
      ? "bg-red-500/15 border-red-500/40 text-red-100"
      : farbe === "orange"
      ? "bg-orange-500/15 border-orange-500/40 text-orange-100"
      : "bg-primary/15 border-primary/40 text-primary-foreground";
  return (
    <div className={`border-b ${cls} px-4 py-2 text-sm flex items-center gap-2`}>
      <AlertTriangle className="size-4 shrink-0" />
      <span className="font-medium">{label}</span>
      {nachricht && <span className="text-current/80 truncate">— {nachricht}</span>}
    </div>
  );
}
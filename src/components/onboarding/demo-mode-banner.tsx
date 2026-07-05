import { Sparkles } from "lucide-react";
import { useOnboardingStatus } from "@/hooks/use-onboarding";

export function DemoModeBanner() {
  const { data } = useOnboardingStatus();
  if (!data?.demoMode) return null;
  return (
    <div className="w-full bg-warning/15 text-warning border-b border-warning/30">
      <div className="max-w-screen-2xl mx-auto px-4 py-2 flex items-center gap-2 text-sm">
        <Sparkles className="size-4 shrink-0" />
        <span className="font-medium">Demo-Modus aktiv</span>
        <span className="text-warning/80 hidden sm:inline">
          – Sie klicken sich gerade durch Beispiel-Daten. Ihre echten Daten erscheinen nach der Einführung.
        </span>
      </div>
    </div>
  );
}
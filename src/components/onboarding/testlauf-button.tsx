import { PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { startWalkthrough, hasWalkthrough } from "@/lib/walkthroughs";

/** Einheitlicher „Geführter Testlauf"-Button. */
export function TestlaufButton({
  walkthrough,
  label = "Geführter Testlauf",
  onBeforeStart,
  size = "sm",
  variant = "secondary",
}: {
  walkthrough: string;
  label?: string;
  onBeforeStart?: () => void | Promise<void>;
  size?: "sm" | "default" | "lg" | "icon";
  variant?: "default" | "secondary" | "outline" | "ghost";
}) {
  if (!hasWalkthrough(walkthrough)) return null;
  return (
    <Button
      size={size}
      variant={variant}
      onClick={async () => {
        try { await onBeforeStart?.(); } catch { /* ignore */ }
        void startWalkthrough(walkthrough);
      }}
    >
      <PlayCircle className="size-4 mr-1.5" /> {label}
    </Button>
  );
}
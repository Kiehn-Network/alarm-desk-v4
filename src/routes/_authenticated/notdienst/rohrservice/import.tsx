import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ImportPanel } from "@/components/notdienst/import-panel";
import { useRole } from "@/hooks/use-role";

export const Route = createFileRoute("/_authenticated/notdienst/rohrservice/import")({
  component: RohrImport,
});

function RohrImport() {
  const { isAdmin } = useRole();
  if (!isAdmin) {
    return <div className="text-sm text-muted-foreground">Nur Admins dürfen Berichte importieren.</div>;
  }
  return (
    <div className="space-y-4">
      <Link to="/notdienst/rohrservice"><Button variant="ghost" size="sm"><ArrowLeft className="size-4 mr-1" /> Zurück</Button></Link>
      <ImportPanel variant="rohrservice" title="Rohrservice-Berichte importieren" />
    </div>
  );
}
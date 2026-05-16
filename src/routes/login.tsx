import { createFileRoute } from "@tanstack/react-router";
import logo from "@/assets/alarmdesk-logo.png";
import { AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/login")({
  component: InvalidDomainPage,
});

function InvalidDomainPage() {
  return (
    <div className="min-h-screen grid place-items-center bg-background p-6">
      <div className="w-full max-w-md text-center space-y-6">
        <div className="mx-auto size-14 rounded-2xl grid place-items-center bg-card/60 backdrop-blur" style={{ boxShadow: "var(--shadow-glow)" }}>
          <img src={logo} alt="AlarmDesk" className="size-10 object-contain" />
        </div>
        <div className="space-y-2">
          <div className="mx-auto inline-flex items-center gap-2 text-warning text-sm font-medium">
            <AlertTriangle className="size-4" /> Ungültige Domäne
          </div>
          <h1 className="text-2xl font-bold">Kein Login-Bereich gefunden</h1>
          <p className="text-sm text-muted-foreground">
            Bitte rufe den Anmeldelink deiner Organisation auf
            (z.&nbsp;B. <code className="font-mono text-foreground/80">/login/deine-domaene</code>).
            Den Link erhältst du von deinem Administrator.
          </p>
        </div>
      </div>
    </div>
  );
}

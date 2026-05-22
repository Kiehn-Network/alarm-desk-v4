import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { Radar, Wrench, MapPin, ScanLine, Building2, Clock, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/revier-center/owks")({
  component: OwksLayout,
});

function OwksLayout() {
  const { location } = useRouterState();
  const tabs = [
    { to: "/revier-center/owks", label: "Übersicht", icon: Radar, exact: true },
    { to: "/revier-center/owks/zeitstrahl", label: "Zeitstrahl", icon: Clock },
    { to: "/revier-center/owks/bestreifungsplaene", label: "Bestreifungspläne", icon: Wrench },
    { to: "/revier-center/owks/rundgaenge", label: "Rundgänge", icon: MapPin },
    { to: "/revier-center/owks/nfc-punkte", label: "NFC-Punkte", icon: ScanLine },
    { to: "/revier-center/owks/objekte", label: "Objekte", icon: Building2 },
    { to: "/revier-center/owks/scan", label: "Scan", icon: Smartphone },
  ];
  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-border bg-muted/30 px-6 lg:px-8 overflow-x-auto">
        <nav className="flex gap-1 min-w-max">
          {tabs.map((t) => {
            const active = t.exact
              ? location.pathname === t.to
              : location.pathname.startsWith(t.to);
            return (
              <Link
                key={t.to}
                to={t.to}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 text-xs border-b-2 -mb-px transition-colors whitespace-nowrap",
                  active
                    ? "border-primary text-foreground font-medium"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                <t.icon className="size-3.5" />
                {t.label}
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="flex-1 overflow-auto">
        <Outlet />
      </div>
    </div>
  );
}

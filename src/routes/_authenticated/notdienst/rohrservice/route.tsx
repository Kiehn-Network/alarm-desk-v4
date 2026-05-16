import { createFileRoute, Outlet, Link, useRouterState } from "@tanstack/react-router";
import { Wrench } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/notdienst/rohrservice")({
  component: RohrserviceLayout,
});

const TABS = [
  { to: "/notdienst/rohrservice", label: "Startseite", exact: true },
  { to: "/notdienst/rohrservice/neu", label: "Neuer Bericht" },
  { to: "/notdienst/rohrservice/nachbearbeitung", label: "Nachbearbeitung" },
  { to: "/notdienst/rohrservice/mitarbeiter", label: "Mitarbeiter" },
];

function RohrserviceLayout() {
  const { location } = useRouterState();
  return (
    <div className="min-h-full">
      <header className="bg-primary text-primary-foreground">
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Wrench className="size-5" />
            <span className="text-lg font-bold tracking-tight">Rohrservice</span>
          </div>
          <nav className="flex items-center gap-2">
            {TABS.map((t) => {
              const active = t.exact
                ? location.pathname === t.to
                : location.pathname.startsWith(t.to);
              return (
                <Link
                  key={t.to}
                  to={t.to}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-sm transition-colors",
                    active
                      ? "bg-white/15 font-medium"
                      : "text-primary-foreground/80 hover:text-primary-foreground hover:bg-white/10",
                  )}
                >
                  {t.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
      <div className="max-w-6xl mx-auto px-6 py-8">
        <Outlet />
      </div>
    </div>
  );
}
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
    <div className="p-6 lg:p-8 space-y-6 max-w-[1600px]">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground flex items-center gap-2">
            <Wrench className="size-3.5" /> Notdienst
          </div>
          <h1 className="text-3xl font-bold mt-1">Rohrservice</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Berichte erfassen, nachbearbeiten und versenden.
          </p>
        </div>
      </div>

      <nav
        className="flex items-center gap-1 rounded-xl border border-border bg-card p-1 w-fit"
        style={{ boxShadow: "var(--shadow-card)" }}
      >
        {TABS.map((t) => {
          const active = t.exact
            ? location.pathname === t.to
            : location.pathname.startsWith(t.to);
          return (
            <Link
              key={t.to}
              to={t.to}
              className={cn(
                "px-3.5 py-1.5 rounded-lg text-sm transition-colors",
                active
                  ? "bg-primary text-primary-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent",
              )}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>

      <Outlet />
    </div>
  );
}
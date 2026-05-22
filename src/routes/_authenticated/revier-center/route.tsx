import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { ShieldCheck, Radar } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/revier-center")({
  component: RevierCenterLayout,
});

function RevierCenterLayout() {
  const { location } = useRouterState();
  const tabs = [
    { to: "/revier-center", label: "Übersicht", icon: ShieldCheck, exact: true },
    { to: "/revier-center/owks", label: "OWKS", icon: Radar, exact: false },
  ];
  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-border bg-card">
        <div className="px-6 lg:px-8 pt-6 pb-2 flex items-center gap-3">
          <ShieldCheck className="size-6 text-primary" />
          <h1 className="text-2xl font-bold">Revier Center</h1>
        </div>
        <nav className="px-6 lg:px-8 flex gap-1">
          {tabs.map((t) => {
            const active = t.exact
              ? location.pathname === t.to
              : location.pathname.startsWith(t.to);
            return (
              <Link
                key={t.to}
                to={t.to}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 text-sm border-b-2 -mb-px transition-colors",
                  active
                    ? "border-primary text-foreground font-medium"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                <t.icon className="size-4" />
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

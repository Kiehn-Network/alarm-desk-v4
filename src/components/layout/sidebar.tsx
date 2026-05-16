import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, PlusCircle, Monitor, Bell, CalendarDays, FolderOpen,
  Network, Wrench, Home, Building2, KeyRound, KeySquare, ShieldCheck, Settings, LogOut, Radio,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

type Item = { to: string; label: string; icon: React.ComponentType<{ className?: string }> };
type Section = { label: string; items: Item[] };

const sections: Section[] = [
  { label: "Übersicht", items: [
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/einsatz-erstellen", label: "Einsatz erstellen", icon: PlusCircle },
    { to: "/monitor", label: "Monitor", icon: Monitor },
  ]},
  { label: "Menü", items: [
    { to: "/alarmierung", label: "Alarmierung", icon: Bell },
    { to: "/dienstplaene", label: "Dienstpläne", icon: CalendarDays },
    { to: "/dateien", label: "Datei-Verwaltung", icon: FolderOpen },
    { to: "/intrahub", label: "IntraHub", icon: Network },
  ]},
  { label: "Notdienste", items: [
    { to: "/notdienst/rohrservice", label: "Rohrservice", icon: Wrench },
    { to: "/notdienst/budeko", label: "Budeko", icon: Home },
    { to: "/notdienst/lutz", label: "Lutz", icon: Building2 },
  ]},
  { label: "Tools", items: [
    { to: "/schluesselbuch", label: "Schlüsselbuch", icon: KeyRound },
    { to: "/schluesseluebergabe", label: "Schlüsselübergabe", icon: KeySquare },
  ]},
  { label: "Center", items: [
    { to: "/service-center", label: "Service Center", icon: Building2 },
    { to: "/revier-center", label: "Revier Center", icon: ShieldCheck },
    { to: "/admin", label: "Admin Center", icon: Settings },
  ]},
];

export function SidebarContent({ displayName, onNavigate }: { displayName: string; onNavigate?: () => void }) {
  const { location } = useRouterState();
  return (
    <div className="flex h-full w-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="px-5 py-5 flex items-center gap-3 border-b border-sidebar-border">
        <div className="relative">
          <div className="size-10 rounded-xl grid place-items-center" style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)" }}>
            <Radio className="size-5 text-primary-foreground" />
          </div>
          <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full bg-success border-2 border-sidebar" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold truncate">{displayName}</div>
          <div className="text-xs text-success flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-success animate-pulse" /> online
          </div>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6 scrollbar-thin">
        {sections.map((s) => (
          <div key={s.label}>
            <div className="px-3 mb-2 text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">{s.label}</div>
            <ul className="space-y-0.5">
              {s.items.map((it) => {
                const active = location.pathname === it.to || location.pathname.startsWith(it.to + "/");
                return (
                  <li key={it.to}>
                    <Link
                      to={it.to}
                      onClick={onNavigate}
                      className={cn(
                        "group flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all",
                        active
                          ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                          : "text-sidebar-foreground/75 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
                      )}
                    >
                      <it.icon className={cn("size-4 shrink-0", active ? "text-primary" : "")} />
                      <span className="truncate">{it.label}</span>
                      {active && <span className="ml-auto size-1.5 rounded-full bg-primary" />}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className="p-3 border-t border-sidebar-border">
        <button
          onClick={() => supabase.auth.signOut()}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors"
        >
          <LogOut className="size-4" /> Abmelden
        </button>
      </div>
    </div>
  );
}

export function Sidebar({ displayName }: { displayName: string }) {
  return (
    <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-sidebar-border">
      <SidebarContent displayName={displayName} />
    </aside>
  );
}

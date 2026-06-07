import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, PlusCircle, Monitor, Bell, CalendarDays, FolderOpen, Truck,
  Network, Wrench, Home, Building2, KeyRound, KeySquare, ShieldCheck, Settings, LogOut, Crown, UserCog, Users, Cable,
  Receipt, Upload, HelpCircle, Rocket, Search as SearchIcon, Mail, Activity, BarChart3, RefreshCw, LifeBuoy,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useRole, type AppRole } from "@/hooks/use-role";
import { useAppSettings } from "@/hooks/use-app-settings";
import { useDomainModules } from "@/hooks/use-domain-modules";
import logo from "@/assets/alarmdesk-logo.png";

type Item = {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: AppRole[];
  module?: string;
  tab?: string;
};
type Section = { label: string; items: Item[] };

const sections: Section[] = [
  { label: "Übersicht", items: [
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["admin", "dispatcher"] },
    { to: "/meine-einsaetze", label: "Meine Einsätze", icon: Truck, roles: ["fahrer", "admin"] },
    { to: "/einsatz-erstellen", label: "Einsatz erstellen", icon: PlusCircle, roles: ["admin", "dispatcher"] },
    { to: "/monitor", label: "Monitor", icon: Monitor, roles: ["admin", "dispatcher"] },
  ]},
  { label: "Menü", items: [
    { to: "/alarmierung", label: "Alarmierung", icon: Bell, roles: ["admin", "dispatcher"] },
    { to: "/kunden", label: "Kunden", icon: Users, roles: ["admin", "dispatcher"] },
    { to: "/dienstplaene", label: "Dienstpläne", icon: CalendarDays },
    { to: "/dateien", label: "Datei-Verwaltung", icon: FolderOpen, roles: ["admin", "dispatcher"] },
    { to: "/intrahub", label: "IntraHub", icon: Network },
  ]},
  { label: "Notdienste", items: [
    { to: "/notdienst/rohrservice", label: "Rohrservice", icon: Wrench, module: "notdienst_rohrservice", roles: ["admin", "dispatcher"] },
    { to: "/notdienst/budeko",      label: "Budeko",      icon: Home,   module: "notdienst_budeko", roles: ["admin", "dispatcher"] },
    { to: "/notdienst/lutz",        label: "Lutz",        icon: Building2, module: "notdienst_lutz", roles: ["admin", "dispatcher"] },
  ]},
  { label: "Abrechnung Hausnotruf", items: [
    { to: "/abrechnung/malteser",   label: "Malteser",    icon: Receipt, module: "malteser", roles: ["admin", "dispatcher"] },
    { to: "/abrechnung/johanniter", label: "Johanniter",  icon: Receipt, module: "johanniter", roles: ["admin", "dispatcher"] },
    { to: "/abrechnung/lgwa",       label: "LüWa",        icon: Receipt, module: "lgwa", roles: ["admin", "dispatcher"] },
  ]},
  { label: "Tools", items: [
    { to: "/schluesselbuch", label: "Schlüsselbuch", icon: KeyRound, roles: ["admin", "dispatcher"], module: "schluesselbuch" },
    { to: "/schluesseluebergabe", label: "Schlüsselübergabe", icon: KeySquare, roles: ["admin", "dispatcher"] },
    { to: "/daten-import", label: "Daten-Import", icon: Upload, roles: ["admin"] },
  ]},
  { label: "Center", items: [
    { to: "/service-center", label: "Service Center", icon: Building2, roles: ["admin", "dispatcher"] },
    { to: "/revier-center", label: "Revier Center", icon: ShieldCheck, roles: ["admin", "dispatcher"] },
    { to: "/esrp", label: "ESRP (ERP-Anbindung)", icon: Cable, roles: ["admin"], module: "esrp" },
    { to: "/admin", label: "Admin Center", icon: Settings, roles: ["admin"] },
    { to: "/superadmin", label: "SuperAdmin", icon: Crown, roles: ["superadmin"] },
  ]},
  { label: "Hilfe", items: [
    { to: "/hilfe", label: "Hilfe & Anleitung", icon: HelpCircle },
    { to: "/support", label: "Support-Tickets", icon: LifeBuoy, roles: ["admin"] },
  ]},
];

const superAdminSections: Section[] = [
  { label: "Start", items: [
    { to: "/superadmin", tab: "overview", label: "Übersicht", icon: LayoutDashboard },
    { to: "/superadmin", tab: "onboard", label: "Onboarding", icon: Rocket },
    { to: "/superadmin", tab: "search", label: "Suche", icon: SearchIcon },
  ]},
  { label: "Mandanten", items: [
    { to: "/superadmin", tab: "domains", label: "Domains", icon: Building2 },
    { to: "/superadmin", tab: "licenses", label: "Lizenzen", icon: ShieldCheck },
    { to: "/superadmin", tab: "modules", label: "Module", icon: KeyRound },
    { to: "/superadmin", tab: "users", label: "Nutzer", icon: Users },
  ]},
  { label: "Betrieb", items: [
    { to: "/superadmin", tab: "health", label: "Health", icon: Activity },
    { to: "/superadmin", tab: "emails", label: "E-Mails", icon: Mail },
    { to: "/superadmin", tab: "audit", label: "Audit-Log", icon: BarChart3 },
    { to: "/superadmin", tab: "tickets", label: "Support-Tickets", icon: LifeBuoy },
  ]},
  { label: "Plattform", items: [
    { to: "/superadmin", tab: "system", label: "System", icon: RefreshCw },
    { to: "/superadmin", tab: "selfhost", label: "Self-Hosting", icon: Crown },
  ]},
];

export function SidebarContent({ displayName, onNavigate }: { displayName: string; onNavigate?: () => void }) {
  const { location } = useRouterState();
  const { role, actualRole, isImpersonating } = useRole();
  const { data: settings } = useAppSettings();
  const { data: enabledModules } = useDomainModules();
  const isSuperAdminMode = actualRole === "superadmin" && !isImpersonating;
  const sourceSections = isSuperAdminMode ? superAdminSections : sections;
  const visibleSections = sourceSections
    .map((s) => ({
      ...s,
      items: s.items.filter((i) => {
        // Module gating — hide item if its module is not enabled for the
        // effective domain. Only a SuperAdmin who is NOT currently
        // impersonating a domain sees everything; during impersonation we
        // mirror the domain's actual module configuration.
        if (i.module && !(actualRole === "superadmin" && !isImpersonating)) {
          if (!enabledModules || !enabledModules.has(i.module)) return false;
        }
        if (!i.roles) return true;
        // SuperAdmin-only items always check the actual role (not the
        // impersonated effective role).
        if (i.roles.includes("superadmin") && actualRole === "superadmin") return true;
        return !!(role && i.roles.includes(role));
      }),
    }))
    .filter((s) => s.items.length > 0);
  return (
    <div className={cn("flex h-full w-full flex-col bg-sidebar text-sidebar-foreground")}>
      {isSuperAdminMode && (
        <div className="px-4 py-2 flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-primary text-primary-foreground">
            <Crown className="size-3.5" />
            <span className="text-[10px] font-bold uppercase tracking-[0.18em]">SuperAdmin</span>
          </span>
        </div>
      )}
      <Link
        to="/profil"
        onClick={onNavigate}
        className="px-5 py-5 flex items-center gap-3 border-b border-sidebar-border hover:bg-sidebar-accent/40 transition-colors"
      >
        <div className="relative">
          {settings?.logo_url ? (
            <div className="size-10 rounded-xl overflow-hidden bg-sidebar-accent grid place-items-center" style={{ boxShadow: "var(--shadow-glow)" }}>
              <img src={settings.logo_url} alt="Logo" className="size-full object-contain" />
            </div>
          ) : (
            <div className="size-10 rounded-xl grid place-items-center bg-card" style={{ boxShadow: "var(--shadow-glow)" }}>
              <img src={logo} alt="AlarmDesk" className="size-7 object-contain" />
            </div>
          )}
          <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full bg-success border-2 border-sidebar" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold truncate">{settings?.firmenname ?? "AlarmDesk"}</div>
          <div className="text-xs text-muted-foreground truncate">{displayName}</div>
          <div className="text-xs text-success flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-success animate-pulse" /> online
          </div>
        </div>
        <UserCog className="size-4 ml-auto text-muted-foreground" />
      </Link>
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6 scrollbar-thin">
        {visibleSections.map((s) => (
          <div key={s.label}>
            <div className="px-3 mb-2 text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">{s.label}</div>
            <ul className="space-y-0.5">
              {s.items.map((it) => {
                const currentTab = (location.search as any)?.tab as string | undefined;
                const active = it.tab
                  ? location.pathname === it.to && (currentTab ?? "overview") === it.tab
                  : location.pathname === it.to || location.pathname.startsWith(it.to + "/");
                return (
                  <li key={`${it.to}:${it.tab ?? ""}`}>
                    <Link
                      to={it.to}
                      search={it.tab ? { tab: it.tab } : undefined as any}
                      onClick={onNavigate}
                      data-active={active ? "true" : undefined}
                      className={cn(
                        "group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all",
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

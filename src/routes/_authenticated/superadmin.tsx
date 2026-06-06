import { createFileRoute, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { useRole } from "@/hooks/use-role";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  listDomains, createDomain, setDomainStatus,
  createLicense, revokeLicense, toggleDomainModule,
  updateLicense,
  listAllTenantUsers, assignUserToDomain,
  createTenantUser,
  startImpersonation, stopImpersonation, getImpersonation,
  getPlatformSettings, updatePlatformMaintenance,
  listAppVersions, createAppVersion, deleteAppVersion,
  sendPasswordReset, setUserDisabled, deleteTenantUser, bulkImportUsers,
  getSuperAdminStats,
  listAuditLog, getHealthSnapshot, listEmailLog, retryDlqEmail,
  extendLicenses, onboardDomain, cloneDomain, sendLicenseExpiryNotices,
  setDomainArchived, globalSearch, getDomainStats, exportDomainData,
} from "@/lib/superadmin.functions";
import { SelfHostGuide } from "@/components/admin/selfhost-guide";
import { listAppModules } from "@/lib/settings.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Activity, Building2, Crown, Globe2, KeyRound, LayoutDashboard,
  Loader2, Mail, RefreshCw, Search, ShieldAlert, ShieldCheck, Trash2, Upload, Users,
  Copy, Archive, BarChart3, Download, Rocket, CalendarClock, Plus, X, Filter, LayoutGrid, ListFilter,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/superadmin")({
  validateSearch: (s: Record<string, unknown>) => ({
    tab: typeof s.tab === "string" ? s.tab : "overview",
  }),
  beforeLoad: async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) throw redirect({ to: "/login" });
    const { data: roles } = await supabase.from("user_roles")
      .select("role").eq("user_id", u.user.id).eq("role", "superadmin").maybeSingle();
    if (!roles) throw redirect({ to: "/dashboard" });
  },
  component: SuperAdminPage,
});

function NavGroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground self-center select-none">
      {children}
    </span>
  );
}

function NavDivider() {
  return <span className="mx-1 h-5 w-px bg-border/70 self-center" aria-hidden />;
}

const NAV_SECTIONS: { label: string; items: { value: string; label: string }[] }[] = [
  { label: "Start", items: [
    { value: "overview", label: "Übersicht" },
    { value: "onboard", label: "Onboarding" },
    { value: "search", label: "Suche" },
  ]},
  { label: "Mandanten", items: [
    { value: "domains", label: "Domains" },
    { value: "licenses", label: "Lizenzen" },
    { value: "modules", label: "Module" },
    { value: "users", label: "Nutzer" },
  ]},
  { label: "Betrieb", items: [
    { value: "health", label: "Health" },
    { value: "emails", label: "E-Mails" },
    { value: "audit", label: "Audit-Log" },
  ]},
  { label: "Plattform", items: [
    { value: "system", label: "System" },
    { value: "selfhost", label: "Self-Hosting" },
  ]},
];

function SideSection({ label }: { label: string }) {
  return (
    <div className="px-2 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground first:pt-1">
      {label}
    </div>
  );
}

function SideTab({ value, icon: Icon, children }: { value: string; icon: any; children: React.ReactNode }) {
  return (
    <TabsTrigger
      value={value}
      className="justify-start gap-2 w-full data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none rounded-md px-3 py-2 text-sm"
    >
      <Icon className="size-4" />
      <span className="truncate">{children}</span>
    </TabsTrigger>
  );
}

function SimpleNavSelect({ value, onValueChange }: { value: string; onValueChange: (v: string) => void }) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {NAV_SECTIONS.map((sec) => (
          <div key={sec.label}>
            <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{sec.label}</div>
            {sec.items.map((it) => (
              <SelectItem key={it.value} value={it.value}>{it.label}</SelectItem>
            ))}
          </div>
        ))}
      </SelectContent>
    </Select>
  );
}

function SuperAdminPage() {
  const qc = useQueryClient();
  const listDomFn = useServerFn(listDomains);
  const listModFn = useServerFn(listAppModules);
  const listUsersFn = useServerFn(listAllTenantUsers);
  const impFn = useServerFn(getImpersonation);
  const navigate = useNavigate();
  const { tab } = Route.useSearch();
  const setTab = (v: string) => navigate({ to: "/superadmin", search: { tab: v }, replace: true });
  const { actualRole, isImpersonating } = useRole();
  const superNavInGlobal = actualRole === "superadmin" && !isImpersonating;

  const dq = useQuery({ queryKey: ["sa-domains"], queryFn: () => listDomFn() });
  const mq = useQuery({ queryKey: ["sa-modules"], queryFn: () => listModFn() });
  const uq = useQuery({ queryKey: ["sa-users"], queryFn: () => listUsersFn() });
  const iq = useQuery({ queryKey: ["sa-imp"], queryFn: () => impFn() });

  const statsFn = useServerFn(getSuperAdminStats);
  const sq = useQuery({ queryKey: ["sa-stats"], queryFn: () => statsFn(), refetchInterval: 60_000 });

  const getPlat = useServerFn(getPlatformSettings);
  const updMaint = useServerFn(updatePlatformMaintenance);
  const listVers = useServerFn(listAppVersions);
  const addVers = useServerFn(createAppVersion);
  const delVers = useServerFn(deleteAppVersion);

  const pq = useQuery({ queryKey: ["platform-settings"], queryFn: () => getPlat() });
  const vq = useQuery({ queryKey: ["sa-versions"], queryFn: () => listVers() });

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["sa-domains"] });
    qc.invalidateQueries({ queryKey: ["sa-users"] });
    qc.invalidateQueries({ queryKey: ["sa-imp"] });
    qc.invalidateQueries({ queryKey: ["impersonation"] });
    window.dispatchEvent(new Event("impersonation-changed"));
  };

  const createDom = useServerFn(createDomain);
  const setStatus = useServerFn(setDomainStatus);
  const createLic = useServerFn(createLicense);
  const revokeLic = useServerFn(revokeLicense);
  const updateLic = useServerFn(updateLicense);
  const toggleMod = useServerFn(toggleDomainModule);
  const assign = useServerFn(assignUserToDomain);
  const createUserFn = useServerFn(createTenantUser);
  const startImp = useServerFn(startImpersonation);
  const stopImp = useServerFn(stopImpersonation);
  const resetPwFn = useServerFn(sendPasswordReset);
  const setDisabledFn = useServerFn(setUserDisabled);
  const delUserFn = useServerFn(deleteTenantUser);
  const bulkFn = useServerFn(bulkImportUsers);

  const onboardFn = useServerFn(onboardDomain);
  const cloneFn = useServerFn(cloneDomain);
  const extendFn = useServerFn(extendLicenses);
  const archiveFn = useServerFn(setDomainArchived);
  const expiryFn = useServerFn(sendLicenseExpiryNotices);
  const exportFn = useServerFn(exportDomainData);

  const [newSlug, setNewSlug] = useState("");
  const [newName, setNewName] = useState("");

  // Bulk-License-Extend
  const [selectedLics, setSelectedLics] = useState<Record<string, boolean>>({});
  const [extendDays, setExtendDays] = useState<number>(365);
  const selectedIds = Object.keys(selectedLics).filter((k) => selectedLics[k]);

  // Stats dialog
  const [statsForDomain, setStatsForDomain] = useState<string | null>(null);

  // Search
  const [domainSearch, setDomainSearch] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [userDomainFilter, setUserDomainFilter] = useState<string>("all");
  const [userRoleFilter, setUserRoleFilter] = useState<string>("all");

  // Bulk import
  const [bulkCsv, setBulkCsv] = useState("");
  const [bulkDomain, setBulkDomain] = useState<string>("");
  const [bulkRole, setBulkRole] = useState<"admin" | "user">("user");
  const [bulkPending, setBulkPending] = useState(false);

  // New user form state
  const [nuEmail, setNuEmail] = useState("");
  const [nuName, setNuName] = useState("");
  const [nuPassword, setNuPassword] = useState("");
  const [nuDomain, setNuDomain] = useState<string>("none");
  const [nuRole, setNuRole] = useState<"superadmin" | "admin" | "user">("user");
  const [nuPending, setNuPending] = useState(false);

  // System tab state
  const [newVersion, setNewVersion] = useState("");
  const [newChangelog, setNewChangelog] = useState("");
  const [maintActive, setMaintActive] = useState<boolean | null>(null);
  const [maintMsg, setMaintMsg] = useState<string>("");
  const [maintColor, setMaintColor] = useState<"info" | "orange" | "rot">("info");
  const platform = pq.data;
  const effMaintActive = maintActive ?? !!platform?.wartung_aktiv;
  const effMaintMsg = maintActive === null ? (platform?.wartung_nachricht ?? "") : maintMsg;
  const effMaintColor = maintActive === null ? ((platform?.wartung_farbe ?? "info") as any) : maintColor;

  const m_createDom = useMutation({
    mutationFn: () => createDom({ data: { slug: newSlug, name: newName } }),
    onSuccess: () => { setNewSlug(""); setNewName(""); toast.success("Domain angelegt"); invalidateAll(); },
    onError: (e: any) => toast.error(e.message),
  });

  const domains = dq.data?.domains ?? [];
  const licenses = dq.data?.licenses ?? [];
  const dmodules = dq.data?.modules ?? [];
  const modules = mq.data ?? [];
  const users = uq.data?.users ?? [];
  const imp = iq.data?.domain;
  const versions = vq.data ?? [];
  const stats = sq.data;

  const filteredDomains = useMemo(() => {
    const q = domainSearch.trim().toLowerCase();
    if (!q) return domains;
    return domains.filter((d: any) =>
      d.name?.toLowerCase().includes(q) || d.slug?.toLowerCase().includes(q));
  }, [domains, domainSearch]);

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    return users.filter((u: any) => {
      if (userDomainFilter !== "all" && (u.domain_id ?? "none") !== userDomainFilter) return false;
      if (userRoleFilter !== "all" && u.roles?.[0]?.role !== userRoleFilter) return false;
      if (!q) return true;
      return (u.display_name ?? "").toLowerCase().includes(q) || (u.email ?? "").toLowerCase().includes(q);
    });
  }, [users, userSearch, userDomainFilter, userRoleFilter]);

  const domainName = (id: string | null) =>
    domains.find((d: any) => d.id === id)?.name ?? "—";

  async function handleResetPw(userId: string) {
    try {
      const r = await resetPwFn({ data: { user_id: userId } });
      if (r.action_link) {
        await navigator.clipboard.writeText(r.action_link);
        toast.success(`Reset-Link für ${r.email} kopiert`);
      } else {
        toast.success(`Reset-Link erstellt für ${r.email}`);
      }
    } catch (e: any) { toast.error(e?.message ?? "Fehler"); }
  }

  async function handleToggleDisabled(userId: string, currentlyDisabled: boolean) {
    try {
      await setDisabledFn({ data: { user_id: userId, disabled: !currentlyDisabled } });
      toast.success(currentlyDisabled ? "Nutzer aktiviert" : "Nutzer deaktiviert");
      invalidateAll();
    } catch (e: any) { toast.error(e?.message ?? "Fehler"); }
  }

  async function handleDeleteUser(userId: string, label: string) {
    if (!confirm(`Nutzer "${label}" wirklich endgültig löschen?`)) return;
    try {
      await delUserFn({ data: { user_id: userId } });
      toast.success("Nutzer gelöscht");
      invalidateAll();
    } catch (e: any) { toast.error(e?.message ?? "Fehler"); }
  }

  async function handleBulkImport() {
    if (!bulkDomain) { toast.error("Domain wählen"); return; }
    const rows = bulkCsv.split("\n").map(l => l.trim()).filter(Boolean);
    const parsed = rows.map(l => {
      const [email, name, pw] = l.split(/[,;\t]/).map(s => s?.trim());
      return { email, display_name: name, password: pw };
    }).filter(r => r.email && r.display_name && r.password && r.password.length >= 8);
    if (parsed.length === 0) { toast.error("Keine gültigen Zeilen (email,name,passwort)"); return; }
    setBulkPending(true);
    try {
      const r = await bulkFn({ data: { domain_id: bulkDomain, role: bulkRole, users: parsed } });
      const ok = r.results.filter(x => x.ok).length;
      const fail = r.results.length - ok;
      toast.success(`Import: ${ok} ok, ${fail} Fehler`);
      if (fail > 0) {
        const errors = r.results.filter(x => !x.ok).map(x => `${x.email}: ${x.error}`).join("\n");
        console.warn("Bulk import errors:\n" + errors);
      }
      setBulkCsv("");
      invalidateAll();
    } catch (e: any) { toast.error(e?.message ?? "Fehler"); }
    finally { setBulkPending(false); }
  }

  return (
    <div className="superadmin-theme p-6 space-y-6 max-w-screen-2xl mx-auto">
      <div className="sa-header rounded-lg bg-sidebar text-sidebar-foreground px-6 py-5 shadow-md border border-sidebar-border">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="size-12 rounded-md bg-primary text-primary-foreground flex items-center justify-center shadow">
              <Crown className="size-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary-foreground px-2 py-0.5 rounded-full bg-primary">SuperAdmin</span>
                <span className="text-[10px] uppercase tracking-wider text-sidebar-foreground/60">Plattform-Konsole</span>
              </div>
              <h1 className="text-lg font-semibold leading-tight mt-1">Mandanten · Lizenzen · Module · Nutzer · Betrieb</h1>
            </div>
          </div>
          {imp && (
            <div className="flex items-center gap-3 px-3 py-1.5 rounded-lg bg-warning/20 border border-warning/50">
              <span className="text-xs text-sidebar-foreground">Impersonation: <b>{imp.name}</b></span>
              <Button size="sm" variant="outline" onClick={async () => { await stopImp({}); invalidateAll(); }}>Beenden</Button>
            </div>
          )}
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="space-y-0">
        <div className={superNavInGlobal ? "" : "grid gap-6 lg:grid-cols-[240px_1fr]"}>
          {!superNavInGlobal && (
          <aside className="lg:sticky lg:top-24 lg:self-start">
            {/* Mobile: native dropdown for quickest navigation */}
            <div className="lg:hidden">
              <SimpleNavSelect value={tab} onValueChange={setTab} />
            </div>
            {/* Desktop: vertical grouped sidebar */}
            <nav className="hidden lg:block rounded-xl border border-border/60 bg-card/40 p-2">
              <TabsList className="flex flex-col h-auto w-full gap-0.5 bg-transparent p-0 items-stretch">
                <SideSection label="Start" />
                <SideTab value="overview" icon={LayoutDashboard}>Übersicht</SideTab>
                <SideTab value="onboard" icon={Rocket}>Onboarding</SideTab>
                <SideTab value="search" icon={Search}>Suche</SideTab>
                <SideSection label="Mandanten" />
                <SideTab value="domains" icon={Globe2}>Domains</SideTab>
                <SideTab value="licenses" icon={ShieldCheck}>Lizenzen</SideTab>
                <SideTab value="modules" icon={KeyRound}>Module</SideTab>
                <SideTab value="users" icon={Users}>Nutzer</SideTab>
                <SideSection label="Betrieb" />
                <SideTab value="health" icon={Activity}>Health</SideTab>
                <SideTab value="emails" icon={Mail}>E-Mails</SideTab>
                <SideTab value="audit" icon={BarChart3}>Audit-Log</SideTab>
                <SideSection label="Plattform" />
                <SideTab value="system" icon={RefreshCw}>System</SideTab>
                <SideTab value="selfhost" icon={Building2}>Self-Hosting</SideTab>
              </TabsList>
            </nav>
          </aside>
          )}

          <div className="min-w-0 space-y-6">

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
            <Card className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-primary/20">
              <CardContent className="p-6 flex items-center justify-between gap-4">
                <div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">Willkommen zurück</div>
                  <h2 className="text-2xl font-semibold mt-1">Plattform-Übersicht</h2>
                  <p className="text-sm text-muted-foreground mt-1 max-w-md">
                    {stats?.domains_active ?? 0} aktive Mandanten · {stats?.users_total ?? 0} Nutzer · Stand: {new Date().toLocaleString("de-DE")}
                  </p>
                </div>
                <div className="hidden sm:flex flex-col gap-2">
                  <Button size="sm" onClick={() => setTab("onboard")}><Rocket className="size-4 mr-1.5" /> Mandant onboarden</Button>
                  <Button size="sm" variant="outline" onClick={() => setTab("search")}><Search className="size-4 mr-1.5" /> Globale Suche</Button>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">Verteilung Rollen</div>
                <div className="space-y-2.5">
                  {stats && Object.entries(stats.role_counts).map(([r, n]) => {
                    const total = Object.values(stats.role_counts).reduce((a: number, b: any) => a + Number(b), 0) || 1;
                    const pct = Math.round((Number(n) / total) * 100);
                    return (
                      <div key={r}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="font-medium capitalize">{r}</span>
                          <span className="tabular-nums text-muted-foreground">{n} · {pct}%</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                  {!stats && <div className="text-xs text-muted-foreground">Lade Daten…</div>}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard tone="info" icon={<Globe2 className="size-5" />} label="Domains aktiv"
              value={stats?.domains_active ?? "—"} sub={`${stats?.domains_disabled ?? 0} deaktiviert`} />
            <KpiCard tone="success" icon={<ShieldCheck className="size-5" />} label="Lizenzen aktiv"
              value={stats?.licenses_active ?? "—"}
              sub={stats?.licenses_expiring_30d ? `${stats.licenses_expiring_30d} laufen in 30 Tagen aus` : "alles stabil"}
              warn={!!stats?.licenses_expiring_30d} />
            <KpiCard tone="primary" icon={<Users className="size-5" />} label="Nutzer gesamt"
              value={stats?.users_total ?? "—"}
              sub={stats ? Object.entries(stats.role_counts).map(([r, n]) => `${r}: ${n}`).join(" · ") : ""} />
            <KpiCard tone="destructive" icon={<Activity className="size-5" />} label="Einsätze (24h)"
              value={stats?.einsaetze_24h ?? "—"} sub={`gesamt ${stats?.einsaetze_total ?? 0}`} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><Building2 className="size-4" /> Domains</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {domains.slice(0, 6).map((d: any) => {
                  const dLic = licenses.filter((l: any) => l.domain_id === d.id && l.status === "active");
                  const userCount = users.filter((u: any) => u.domain_id === d.id).length;
                  return (
                    <div key={d.id} className="flex items-center justify-between text-sm border border-border/60 rounded-lg px-3 py-2">
                      <div>
                        <div className="font-medium">{d.name}</div>
                        <div className="text-xs text-muted-foreground">{userCount} Nutzer · {dLic.length} Lizenz(en)</div>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${d.status === "active" ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
                        {d.status}
                      </span>
                    </div>
                  );
                })}
                {domains.length === 0 && <div className="text-sm text-muted-foreground">Keine Domains.</div>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><ShieldAlert className="size-4" /> Bald ablaufende Lizenzen</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {licenses
                  .filter((l: any) => l.status === "active" && l.valid_until)
                  .sort((a: any, b: any) => a.valid_until.localeCompare(b.valid_until))
                  .slice(0, 6).map((l: any) => {
                    const dleft = Math.ceil((new Date(l.valid_until).getTime() - Date.now()) / 86400000);
                    return (
                      <div key={l.id} className="flex items-center justify-between text-sm border border-border/60 rounded-lg px-3 py-2">
                        <div>
                          <div className="font-medium">{domainName(l.domain_id)}</div>
                          <div className="text-xs text-muted-foreground"><code>{l.license_key}</code></div>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${dleft < 30 ? "bg-warning/15 text-warning-foreground" : "bg-muted text-muted-foreground"}`}>
                          {dleft > 0 ? `${dleft} Tage` : "abgelaufen"}
                        </span>
                      </div>
                    );
                  })}
                {licenses.filter((l: any) => l.status === "active" && l.valid_until).length === 0 && (
                  <div className="text-sm text-muted-foreground">Keine Lizenzen mit Ablaufdatum.</div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="domains" className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Domain suchen…" value={domainSearch} onChange={(e) => setDomainSearch(e.target.value)} />
          </div>
          <Card>
            <CardHeader><CardTitle>Neue Domain</CardTitle></CardHeader>
            <CardContent className="flex flex-col sm:flex-row gap-3">
              <Input placeholder="slug (z.B. alpha-zentrale)" value={newSlug} onChange={(e) => setNewSlug(e.target.value)} />
              <Input placeholder="Name" value={newName} onChange={(e) => setNewName(e.target.value)} />
              <Button onClick={() => m_createDom.mutate()} disabled={!newSlug || !newName || m_createDom.isPending}>Anlegen</Button>
            </CardContent>
          </Card>
          <div className="grid gap-3">
            {filteredDomains.map((d: any) => (
              <Card key={d.id}>
                <CardContent className="p-4 flex items-center justify-between gap-4">
                  <div>
                    <div className="font-semibold">{d.name}</div>
                    <div className="text-xs text-muted-foreground">{d.slug} · {d.status}</div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 justify-end">
                    <Button size="sm" variant="outline" title="Stats anzeigen" onClick={() => setStatsForDomain(d.id)}>
                      <BarChart3 className="size-4" />
                    </Button>
                    <Button size="sm" variant="outline" title="Daten exportieren (JSON)" onClick={async () => {
                      try {
                        toast.message("Export läuft…");
                        const r = await exportFn({ data: { domain_id: d.id } });
                        const blob = new Blob([JSON.stringify(r, null, 2)], { type: "application/json" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url; a.download = `domain-${d.slug}-${new Date().toISOString().slice(0,10)}.json`;
                        a.click(); URL.revokeObjectURL(url);
                        toast.success("Export geladen");
                      } catch (e: any) { toast.error(e?.message ?? "Fehler"); }
                    }}>
                      <Download className="size-4" />
                    </Button>
                    <Button size="sm" variant="outline" title="Domain klonen" onClick={async () => {
                      const slug = prompt(`Slug der neuen Domain (Klon von ${d.slug})?`);
                      if (!slug) return;
                      const name = prompt("Anzeige-Name?", `${d.name} (Klon)`);
                      if (!name) return;
                      try {
                        await cloneFn({ data: { source_id: d.id, new_slug: slug.trim().toLowerCase(), new_name: name } });
                        toast.success("Domain geklont (Module übernommen)");
                        invalidateAll();
                      } catch (e: any) { toast.error(e?.message ?? "Fehler"); }
                    }}>
                      <Copy className="size-4" />
                    </Button>
                    <Button size="sm" variant="outline" title={d.status === "archived" ? "Archivierung aufheben" : "Archivieren (Read-only)"}
                      onClick={async () => {
                        await archiveFn({ data: { id: d.id, archived: d.status !== "archived" } });
                        invalidateAll();
                      }}>
                      <Archive className="size-4" />
                    </Button>
                    <Button size="sm" variant="outline"
                      onClick={async () => { await setStatus({ data: { id: d.id, status: d.status === "active" ? "disabled" : "active" } }); invalidateAll(); }}>
                      {d.status === "active" ? "Deaktivieren" : "Aktivieren"}
                    </Button>
                    <Button size="sm"
                      onClick={async () => { await startImp({ data: { domain_id: d.id } }); invalidateAll(); toast.success("Impersonation gestartet"); }}>
                      Als Domain-Admin
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="licenses" className="space-y-4">
          <LicensesPanel
            domains={domains}
            licenses={licenses}
            selectedLics={selectedLics}
            setSelectedLics={setSelectedLics}
            extendDays={extendDays}
            setExtendDays={setExtendDays}
            onCreate={async (domain_id, payload) => {
              await createLic({ data: { domain_id, ...payload } });
              invalidateAll(); toast.success("Lizenz erstellt");
            }}
            onUpdate={async (id, payload) => {
              await updateLic({ data: { id, ...payload } });
              invalidateAll(); toast.success("Lizenz aktualisiert");
            }}
            onRevoke={async (id) => {
              await revokeLic({ data: { id } });
              invalidateAll(); toast.success("Lizenz widerrufen");
            }}
            onExtend={async (ids, days) => {
              const r = await extendFn({ data: { ids, days } });
              toast.success(`${r.updated} Lizenz(en) verlängert um ${days} Tage`);
              setSelectedLics({}); invalidateAll();
            }}
            onExpiryRun={async () => {
              const r = await expiryFn({});
              toast.success(`Erinnerungen geprüft: ${r.checked} Lizenzen, ${r.sent} Mails eingereiht`);
            }}
          />
        </TabsContent>

        <TabsContent value="modules">
          <ModuleControl
            domains={domains}
            modules={modules}
            dmodules={dmodules}
            onToggle={async (domain_id, module_key, enabled) => {
              await toggleMod({ data: { domain_id, module_key, enabled } });
              invalidateAll();
            }}
          />
        </TabsContent>

        <TabsContent value="users" className="space-y-2">
          <div className="flex flex-col sm:flex-row gap-2 sticky top-0 z-10 bg-background/80 backdrop-blur py-2 -mx-1 px-1">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Nutzer suchen (Name oder E-Mail)…"
                value={userSearch} onChange={(e) => setUserSearch(e.target.value)} />
            </div>
            <Select value={userDomainFilter} onValueChange={setUserDomainFilter}>
              <SelectTrigger className="w-full sm:w-56"><SelectValue placeholder="Domain" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Domains</SelectItem>
                <SelectItem value="none">— keine —</SelectItem>
                {domains.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={userRoleFilter} onValueChange={setUserRoleFilter}>
              <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="Rolle" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Rollen</SelectItem>
                <SelectItem value="superadmin">SuperAdmin</SelectItem>
                <SelectItem value="admin">Domain-Admin</SelectItem>
                <SelectItem value="user">User</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardHeader><CardTitle>Neuen Nutzer anlegen</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <Label>Name</Label>
                  <Input value={nuName} onChange={(e) => setNuName(e.target.value)} placeholder="Max Mustermann" />
                </div>
                <div>
                  <Label>E-Mail</Label>
                  <Input type="email" value={nuEmail} onChange={(e) => setNuEmail(e.target.value)} placeholder="max@firma.de" />
                </div>
                <div>
                  <Label>Passwort (min. 8 Zeichen)</Label>
                  <Input type="text" value={nuPassword} onChange={(e) => setNuPassword(e.target.value)} placeholder="Passwort vergeben" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Domäne</Label>
                    <Select value={nuDomain} onValueChange={setNuDomain}>
                      <SelectTrigger><SelectValue placeholder="Domain" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">— keine —</SelectItem>
                        {domains.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Rolle</Label>
                    <Select value={nuRole} onValueChange={(v) => setNuRole(v as any)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="superadmin">SuperAdmin</SelectItem>
                        <SelectItem value="admin">Domain-Admin</SelectItem>
                        <SelectItem value="user">User</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <Button
                disabled={
                  nuPending ||
                  !nuEmail || !nuName || nuPassword.length < 8 ||
                  (nuRole !== "superadmin" && nuDomain === "none")
                }
                onClick={async () => {
                  setNuPending(true);
                  try {
                    await createUserFn({ data: {
                      email: nuEmail.trim(),
                      password: nuPassword,
                      display_name: nuName.trim(),
                      domain_id: nuDomain === "none" ? null : nuDomain,
                      role: nuRole,
                    }});
                    toast.success("Nutzer angelegt");
                    setNuEmail(""); setNuName(""); setNuPassword("");
                    setNuDomain("none"); setNuRole("user");
                    invalidateAll();
                  } catch (e: any) {
                    toast.error(e?.message ?? "Fehler beim Anlegen");
                  } finally {
                    setNuPending(false);
                  }
                }}
              >Anlegen</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Upload className="size-4" /> Bulk-Import (CSV)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-xs text-muted-foreground">
                Eine Zeile pro Nutzer: <code>email,name,passwort</code> (Komma, Semikolon oder Tab als Trenner). Passwort min. 8 Zeichen.
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <Label>Ziel-Domain</Label>
                  <Select value={bulkDomain} onValueChange={setBulkDomain}>
                    <SelectTrigger><SelectValue placeholder="Domain wählen" /></SelectTrigger>
                    <SelectContent>
                      {domains.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Rolle</Label>
                  <Select value={bulkRole} onValueChange={(v) => setBulkRole(v as any)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Domain-Admin</SelectItem>
                      <SelectItem value="user">User</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Textarea rows={5} placeholder={"max@firma.de,Max Mustermann,Geheim123\nanna@firma.de,Anna Beispiel,StartPass99"}
                value={bulkCsv} onChange={(e) => setBulkCsv(e.target.value)} />
              <Button onClick={handleBulkImport} disabled={bulkPending || !bulkCsv.trim() || !bulkDomain}>
                {bulkPending && <Loader2 className="size-4 mr-2 animate-spin" />}
                Importieren
              </Button>
            </CardContent>
          </Card>

          <div className="text-xs text-muted-foreground px-1">
            {filteredUsers.length} von {users.length} Nutzern
          </div>

          {filteredUsers.map((u: any) => {
            const r = u.roles[0];
            const disabled = !!u.banned_until && new Date(u.banned_until).getTime() > Date.now();
            return (
              <Card key={u.id}>
                <CardContent className="p-3 flex flex-wrap items-center gap-2">
                  <div className="flex-1 min-w-[220px]">
                    <div className="font-medium flex items-center gap-2">
                      {u.display_name ?? u.email}
                      {disabled && <span className="text-xs px-2 py-0.5 rounded-full bg-destructive/15 text-destructive">deaktiviert</span>}
                    </div>
                    <div className="text-xs text-muted-foreground">{u.email}</div>
                  </div>
                  <Select defaultValue={u.domain_id ?? "none"} onValueChange={async (v) => {
                    const role = (r?.role as any) ?? "user";
                    await assign({ data: { user_id: u.id, domain_id: v === "none" ? null : v, role } });
                    invalidateAll();
                  }}>
                    <SelectTrigger className="w-48"><SelectValue placeholder="Domain" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— keine —</SelectItem>
                      {domains.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select defaultValue={(r?.role as any) ?? "user"} onValueChange={async (v) => {
                    await assign({ data: { user_id: u.id, domain_id: u.domain_id, role: v as any } });
                    invalidateAll();
                  }}>
                    <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="superadmin">SuperAdmin</SelectItem>
                      <SelectItem value="admin">Domain-Admin</SelectItem>
                      <SelectItem value="user">User</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button size="sm" variant="outline" onClick={() => handleResetPw(u.id)} title="Passwort-Reset-Link erzeugen & kopieren">
                    <KeyRound className="size-4 sm:mr-1.5" /><span className="hidden sm:inline">Reset</span>
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleToggleDisabled(u.id, disabled)}>
                    {disabled ? "Aktivieren" : "Deaktivieren"}
                  </Button>
                  <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive"
                    onClick={() => handleDeleteUser(u.id, u.display_name ?? u.email)} title="Nutzer löschen">
                    <Trash2 className="size-4" />
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        <TabsContent value="system" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Aktuelle Version</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <div className="text-2xl font-bold">{platform?.current_version ?? "—"}</div>
              <div className="text-xs text-muted-foreground">
                Wird im gesamten System angezeigt.
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Neue Version veröffentlichen</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid sm:grid-cols-[200px_1fr] gap-3">
                <div>
                  <Label>Version</Label>
                  <Input placeholder="z.B. 1.2.0" value={newVersion} onChange={(e) => setNewVersion(e.target.value)} />
                </div>
              </div>
              <div>
                <Label>Changelog</Label>
                <Textarea rows={6} placeholder="Was ist neu?" value={newChangelog} onChange={(e) => setNewChangelog(e.target.value)} />
              </div>
              <Button
                disabled={!newVersion}
                onClick={async () => {
                  try {
                    await addVers({ data: { version: newVersion, changelog: newChangelog || null, set_current: true } });
                    setNewVersion(""); setNewChangelog("");
                    qc.invalidateQueries({ queryKey: ["sa-versions"] });
                    qc.invalidateQueries({ queryKey: ["platform-settings"] });
                    toast.success("Version gespeichert");
                  } catch (e: any) { toast.error(e?.message ?? "Fehler"); }
                }}
              >Version veröffentlichen</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Changelog-Historie</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {versions.length === 0 && <div className="text-sm text-muted-foreground">Noch keine Versionen.</div>}
              {versions.map((v: any) => (
                <div key={v.id} className="border rounded p-3">
                  <div className="flex items-center justify-between mb-1">
                    <div className="font-semibold">
                      v{v.version}
                      {platform?.current_version === v.version && (
                        <span className="ml-2 text-xs px-2 py-0.5 rounded bg-primary/15 text-primary">aktuell</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground">{new Date(v.released_at).toLocaleString()}</span>
                      <Button size="sm" variant="ghost" onClick={async () => {
                        if (!confirm(`Version ${v.version} löschen?`)) return;
                        await delVers({ data: { id: v.id } });
                        qc.invalidateQueries({ queryKey: ["sa-versions"] });
                      }}>Löschen</Button>
                    </div>
                  </div>
                  {v.changelog && <pre className="whitespace-pre-wrap text-sm text-muted-foreground">{v.changelog}</pre>}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Globaler Wartungsmodus</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-muted-foreground">
                Wenn aktiv, wird in <b>allen Domänen</b> ein Wartungsbanner eingeblendet.
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  checked={effMaintActive}
                  onCheckedChange={(v) => { setMaintActive(v); if (maintActive === null) { setMaintMsg(platform?.wartung_nachricht ?? ""); setMaintColor((platform?.wartung_farbe ?? "info") as any); } }}
                />
                <span className="text-sm">Aktiv</span>
              </div>
              <div>
                <Label>Nachricht</Label>
                <Input value={effMaintMsg} onChange={(e) => { setMaintActive(effMaintActive); setMaintMsg(e.target.value); }} placeholder="z.B. Geplante Wartung 02:00–03:00 Uhr" />
              </div>
              <div>
                <Label>Farbe</Label>
                <Select value={effMaintColor} onValueChange={(v) => { setMaintActive(effMaintActive); setMaintColor(v as any); }}>
                  <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="info">Info (blau)</SelectItem>
                    <SelectItem value="orange">Warnung (orange)</SelectItem>
                    <SelectItem value="rot">Kritisch (rot)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={async () => {
                try {
                  await updMaint({ data: {
                    wartung_aktiv: effMaintActive,
                    wartung_nachricht: effMaintMsg || null,
                    wartung_farbe: effMaintColor,
                  }});
                  setMaintActive(null);
                  qc.invalidateQueries({ queryKey: ["platform-settings"] });
                  toast.success("Wartungsstatus gespeichert");
                } catch (e: any) { toast.error(e?.message ?? "Fehler"); }
              }}>Speichern</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="selfhost" className="space-y-4">
          <SelfHostGuide />
        </TabsContent>

        <TabsContent value="health" className="space-y-4">
          <HealthPanel />
        </TabsContent>

        <TabsContent value="emails" className="space-y-4">
          <EmailQueuePanel />
        </TabsContent>

        <TabsContent value="audit" className="space-y-4">
          <AuditLogPanel />
        </TabsContent>

        <TabsContent value="onboard" className="space-y-4">
          <OnboardingWizard
            onCreate={async (payload) => {
              const r = await onboardFn({ data: payload });
              toast.success(`Domain „${(r as any).domain?.name}" angelegt — Admin-Login bereit`);
              invalidateAll();
              return r as any;
            }}
          />
        </TabsContent>

        <TabsContent value="search" className="space-y-4">
          <GlobalSearchPanel domains={domains} />
        </TabsContent>
          </div>
        </div>
      </Tabs>

      {statsForDomain && (
        <DomainStatsDialog
          domain={domains.find((d: any) => d.id === statsForDomain)}
          onClose={() => setStatsForDomain(null)}
        />
      )}
    </div>
  );
}

function KpiCard({ icon, label, value, sub, warn, tone = "primary" }: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  sub?: string;
  warn?: boolean;
  tone?: "primary" | "info" | "success" | "warning" | "destructive";
}) {
  const toneMap: Record<string, string> = {
    primary: "bg-primary/15 text-primary",
    info: "bg-info/15 text-info",
    success: "bg-success/15 text-success",
    warning: "bg-warning/20 text-warning-foreground",
    destructive: "bg-destructive/15 text-destructive",
  };
  const chip = warn ? toneMap.warning : toneMap[tone];
  return (
    <Card className={warn ? "border-warning/40" : undefined}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
            <div className="text-3xl font-bold mt-2 tabular-nums truncate">{value}</div>
          </div>
          <div className={`size-10 shrink-0 rounded-md grid place-items-center ${chip}`}>{icon}</div>
        </div>
        {sub && <div className="text-xs text-muted-foreground mt-3 line-clamp-1">{sub}</div>}
      </CardContent>
    </Card>
  );
}

type LicensePayload = { valid_until: string | null; max_users: number | null; notes: string | null };

function toIsoOrNull(d: string): string | null {
  if (!d) return null;
  // input type="date" gives YYYY-MM-DD → end of day UTC
  return new Date(`${d}T23:59:59.000Z`).toISOString();
}
function isoToDateInput(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toISOString().slice(0, 10);
}

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

function LicenseStatusBadge({ license }: { license: any }) {
  const d = daysUntil(license.valid_until);
  if (license.status !== "active") {
    return <Badge variant="outline" className="bg-muted text-muted-foreground border-border">{license.status}</Badge>;
  }
  if (d === null) return <Badge variant="outline" className="bg-success/15 text-success border-success/30">unbefristet</Badge>;
  if (d < 0) return <Badge variant="outline" className="bg-destructive/15 text-destructive border-destructive/30">abgelaufen</Badge>;
  if (d <= 14) return <Badge variant="outline" className="bg-warning/15 text-warning border-warning/30">{d}T verbleibend</Badge>;
  return <Badge variant="outline" className="bg-success/15 text-success border-success/30">aktiv · {d}T</Badge>;
}

function ExpiryEditor({ value, onSave }: { value: string | null; onSave: (iso: string | null) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(isoToDateInput(value));
  const [busy, setBusy] = useState(false);
  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (v) setDate(isoToDateInput(value)); }}>
      <PopoverTrigger asChild>
        <button className="text-sm hover:underline tabular-nums text-left">
          {value ? new Date(value).toLocaleDateString() : <span className="text-muted-foreground">unbefristet</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 space-y-2">
        <Label className="text-xs">Gültig bis</Label>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <div className="flex gap-1 flex-wrap">
          {[
            { l: "+30T", d: 30 }, { l: "+90T", d: 90 }, { l: "+1J", d: 365 },
          ].map(({ l, d }) => (
            <Button key={l} size="sm" variant="outline" onClick={() => {
              const base = date ? new Date(date) : new Date();
              base.setDate(base.getDate() + d);
              setDate(base.toISOString().slice(0, 10));
            }}>{l}</Button>
          ))}
          <Button size="sm" variant="ghost" onClick={() => setDate("")}>unbefristet</Button>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Abbrechen</Button>
          <Button size="sm" disabled={busy} onClick={async () => {
            setBusy(true);
            try { await onSave(toIsoOrNull(date)); setOpen(false); }
            catch (e: any) { toast.error(e?.message ?? "Fehler"); }
            finally { setBusy(false); }
          }}>Speichern</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function NewLicenseDialog({ domains, defaultDomain, onCreate }: {
  domains: any[];
  defaultDomain?: string;
  onCreate: (domain_id: string, p: LicensePayload) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [domainId, setDomainId] = useState(defaultDomain ?? domains[0]?.id ?? "");
  const [date, setDate] = useState("");
  const [maxUsers, setMaxUsers] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (v) setDomainId(defaultDomain ?? domains[0]?.id ?? ""); }}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="size-4" /> Neue Lizenz</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Lizenz erstellen</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Mandant</Label>
            <Select value={domainId} onValueChange={setDomainId}>
              <SelectTrigger><SelectValue placeholder="Mandant wählen…" /></SelectTrigger>
              <SelectContent>
                {domains.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Gültig bis</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Max. Nutzer</Label>
              <Input type="number" min={1} value={maxUsers} onChange={(e) => setMaxUsers(e.target.value)} placeholder="∞" />
            </div>
          </div>
          <div>
            <Label className="text-xs">Notiz</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="optional" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Abbrechen</Button>
          <Button disabled={busy || !domainId} onClick={async () => {
            setBusy(true);
            try {
              await onCreate(domainId, {
                valid_until: toIsoOrNull(date),
                max_users: maxUsers ? Number(maxUsers) : null,
                notes: notes || null,
              });
              setDate(""); setMaxUsers(""); setNotes(""); setOpen(false);
            } catch (e: any) { toast.error(e?.message ?? "Fehler"); }
            finally { setBusy(false); }
          }}>Erstellen</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LicensesPanel({
  domains, licenses, selectedLics, setSelectedLics, extendDays, setExtendDays,
  onCreate, onUpdate, onRevoke, onExtend, onExpiryRun,
}: {
  domains: any[];
  licenses: any[];
  selectedLics: Record<string, boolean>;
  setSelectedLics: (v: Record<string, boolean> | ((s: Record<string, boolean>) => Record<string, boolean>)) => void;
  extendDays: number;
  setExtendDays: (n: number) => void;
  onCreate: (domain_id: string, p: LicensePayload) => Promise<void>;
  onUpdate: (id: string, p: Partial<LicensePayload>) => Promise<void>;
  onRevoke: (id: string) => Promise<void>;
  onExtend: (ids: string[], days: number) => Promise<void>;
  onExpiryRun: () => Promise<void>;
}) {
  const [domainFilter, setDomainFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [onlyExpiring, setOnlyExpiring] = useState(false);

  const domMap = useMemo(() => Object.fromEntries(domains.map((d) => [d.id, d])), [domains]);

  const filtered = useMemo(() => {
    return licenses.filter((l: any) => {
      if (domainFilter !== "all" && l.domain_id !== domainFilter) return false;
      if (statusFilter === "active" && l.status !== "active") return false;
      if (statusFilter === "revoked" && l.status === "active") return false;
      if (statusFilter === "expired") {
        const d = daysUntil(l.valid_until);
        if (!(l.status === "active" && d !== null && d < 0)) return false;
      }
      if (onlyExpiring) {
        const d = daysUntil(l.valid_until);
        if (!(l.status === "active" && d !== null && d >= 0 && d <= 30)) return false;
      }
      if (search.trim()) {
        const s = search.toLowerCase();
        const dn = (domMap[l.domain_id]?.name ?? "").toLowerCase();
        if (!(l.license_key.toLowerCase().includes(s) || dn.includes(s) || (l.notes ?? "").toLowerCase().includes(s))) return false;
      }
      return true;
    });
  }, [licenses, domainFilter, statusFilter, search, onlyExpiring, domMap]);

  const selectedIds = Object.keys(selectedLics).filter((k) => selectedLics[k]);
  const visibleSelectedCount = filtered.filter((l) => selectedLics[l.id]).length;
  const allVisibleSelected = filtered.length > 0 && visibleSelectedCount === filtered.length;

  const toggleAllVisible = () => {
    setSelectedLics((s) => {
      const next = { ...s };
      if (allVisibleSelected) filtered.forEach((l) => delete next[l.id]);
      else filtered.forEach((l) => next[l.id] = true);
      return next;
    });
  };

  const stats = useMemo(() => {
    const active = licenses.filter((l) => l.status === "active");
    const expiring = active.filter((l) => { const d = daysUntil(l.valid_until); return d !== null && d >= 0 && d <= 30; });
    const expired = active.filter((l) => { const d = daysUntil(l.valid_until); return d !== null && d < 0; });
    return { total: licenses.length, active: active.length, expiring: expiring.length, expired: expired.length };
  }, [licenses]);

  return (
    <div className="space-y-4">
      {/* Stat strip */}
      <div className="grid gap-3 sm:grid-cols-4">
        <MiniStat label="Lizenzen gesamt" value={stats.total} />
        <MiniStat label="Aktiv" value={stats.active} tone="success" />
        <MiniStat label="Läuft in ≤ 30 T aus" value={stats.expiring} tone={stats.expiring ? "warning" : "muted"} />
        <MiniStat label="Abgelaufen" value={stats.expired} tone={stats.expired ? "destructive" : "muted"} />
      </div>

      {/* Toolbar */}
      <Card>
        <CardContent className="p-3 flex flex-wrap items-end gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Suche: Key, Mandant, Notiz…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={domainFilter} onValueChange={setDomainFilter}>
            <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Mandanten</SelectItem>
              {domains.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Status</SelectItem>
              <SelectItem value="active">Aktiv</SelectItem>
              <SelectItem value="expired">Abgelaufen</SelectItem>
              <SelectItem value="revoked">Widerrufen</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" variant={onlyExpiring ? "default" : "outline"} onClick={() => setOnlyExpiring((v) => !v)}>
            <CalendarClock className="size-4" /> Bald ablaufend
          </Button>
          <div className="flex-1" />
          <Button size="sm" variant="outline" onClick={onExpiryRun}>
            <Mail className="size-4" /> Erinnerungen prüfen
          </Button>
          <NewLicenseDialog domains={domains} defaultDomain={domainFilter !== "all" ? domainFilter : undefined} onCreate={onCreate} />
        </CardContent>
      </Card>

      {/* Bulk action bar */}
      {selectedIds.length > 0 && (
        <div className="sticky top-2 z-10 flex flex-wrap items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 backdrop-blur shadow-sm">
          <span className="text-sm font-medium">{selectedIds.length} ausgewählt</span>
          <div className="flex-1" />
          <Label className="text-xs text-muted-foreground">Tage</Label>
          <Input type="number" min={1} max={3650} className="w-20 h-8" value={extendDays}
            onChange={(e) => setExtendDays(Math.max(1, parseInt(e.target.value || "0", 10) || 1))} />
          {[30, 90, 365].map((d) => (
            <Button key={d} size="sm" variant="outline" onClick={() => setExtendDays(d)}>{d}T</Button>
          ))}
          <Button size="sm" onClick={() => onExtend(selectedIds, extendDays)}>Verlängern</Button>
          <Button size="sm" variant="ghost" onClick={() => setSelectedLics({})}>
            <X className="size-4" />
          </Button>
        </div>
      )}

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="text-sm">
            <thead>
              <tr>
                <th className="w-10 p-3">
                  <input type="checkbox" className="size-4 accent-primary" checked={allVisibleSelected}
                    onChange={toggleAllVisible} aria-label="Alle auswählen" />
                </th>
                <th className="p-3 text-left">Mandant</th>
                <th className="p-3 text-left">Lizenz-Key</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3 text-left">Gültig bis</th>
                <th className="p-3 text-left">Max. Nutzer</th>
                <th className="p-3 text-left">Notiz</th>
                <th className="p-3 text-right">Aktion</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">
                  Keine Lizenzen — passe die Filter an oder lege eine neue Lizenz an.
                </td></tr>
              )}
              {filtered.map((l: any) => (
                <tr key={l.id}>
                  <td className="p-3">
                    <input type="checkbox" className="size-4 accent-primary" checked={!!selectedLics[l.id]}
                      onChange={(e) => setSelectedLics((s) => ({ ...s, [l.id]: e.target.checked }))} />
                  </td>
                  <td className="p-3">
                    <div className="font-medium">{domMap[l.domain_id]?.name ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">{domMap[l.domain_id]?.slug}</div>
                  </td>
                  <td className="p-3"><code className="text-xs bg-muted px-1.5 py-0.5 rounded">{l.license_key}</code></td>
                  <td className="p-3"><LicenseStatusBadge license={l} /></td>
                  <td className="p-3"><ExpiryEditor value={l.valid_until} onSave={(iso) => onUpdate(l.id, { valid_until: iso })} /></td>
                  <td className="p-3 tabular-nums">{l.max_users ?? <span className="text-muted-foreground">∞</span>}</td>
                  <td className="p-3 text-muted-foreground max-w-[220px] truncate" title={l.notes ?? ""}>{l.notes || "—"}</td>
                  <td className="p-3 text-right">
                    {l.status === "active" ? (
                      <Button size="sm" variant="ghost" onClick={() => onRevoke(l.id)}>Widerrufen</Button>
                    ) : <span className="text-xs text-muted-foreground">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="text-xs text-muted-foreground px-1">
        Automatischer Versand der Auslauf-Erinnerungen täglich 09:00 UTC bei <b>14, 7</b> und <b>1 Tag</b> vor Ablauf.
      </div>
    </div>
  );
}

function MiniStat({ label, value, tone = "muted" }: {
  label: string; value: number | string;
  tone?: "muted" | "success" | "warning" | "destructive";
}) {
  const toneMap: Record<string, string> = {
    muted: "text-foreground",
    success: "text-success",
    warning: "text-warning",
    destructive: "text-destructive",
  };
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={`text-2xl font-semibold tabular-nums ${toneMap[tone]}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

// ====================== HEALTH ======================

function HealthPanel() {
  const fn = useServerFn(getHealthSnapshot);
  const q = useQuery({ queryKey: ["sa-health"], queryFn: () => fn(), refetchInterval: 15_000 });
  if (q.isLoading) return <div className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="size-4 animate-spin" /> lädt…</div>;
  if (q.error) return <div className="text-sm text-destructive">Fehler: {(q.error as any)?.message}</div>;
  const h: any = q.data?.health ?? {};
  const queues = h.queues ?? {};
  const em = h.emails_24h ?? {};
  const cr = h.cron_24h ?? {};
  const dbMb = h.db_size_bytes ? (h.db_size_bytes / 1024 / 1024).toFixed(1) : "—";
  const fmtQ = (v: number) => v < 0 ? "n/v" : String(v);
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard icon={<Activity className="size-5" />} label="DB-Latenz" value={`${q.data?.db_latency_ms ?? 0} ms`} sub={`DB-Größe ${dbMb} MB`} />
        <KpiCard icon={<Mail className="size-5" />} label="E-Mails 24h gesendet" value={em.sent ?? 0} sub={`${em.failed ?? 0} fehlgeschlagen · ${em.dlq ?? 0} DLQ`} warn={(em.dlq ?? 0) > 0} />
        <KpiCard icon={<Mail className="size-5" />} label="Queue: Auth/App" value={`${fmtQ(queues.auth_emails ?? 0)} / ${fmtQ(queues.transactional_emails ?? 0)}`} sub={`DLQ ${fmtQ(queues.auth_emails_dlq ?? 0)} / ${fmtQ(queues.transactional_emails_dlq ?? 0)}`} warn={(queues.auth_emails_dlq ?? 0) > 0 || (queues.transactional_emails_dlq ?? 0) > 0} />
        <KpiCard icon={<RefreshCw className="size-5" />} label="Cron 24h" value={cr.runs < 0 ? "n/v" : (cr.runs ?? 0)} sub={`${cr.failed < 0 ? "" : `${cr.failed ?? 0} fehlgeschlagen`}`} warn={(cr.failed ?? 0) > 0} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Cron-Jobs</CardTitle></CardHeader>
        <CardContent className="space-y-1">
          {(q.data?.cron_jobs ?? []).length === 0 && (
            <div className="text-sm text-muted-foreground">Keine Cron-Jobs sichtbar.</div>
          )}
          <table className="w-full text-sm">
            <thead><tr className="text-left text-muted-foreground">
              <th className="py-1">Name</th><th>Plan</th><th>Aktiv</th><th>Letzter Status</th><th>Letzter Lauf</th>
            </tr></thead>
            <tbody>
              {(q.data?.cron_jobs ?? []).map((j: any) => (
                <tr key={j.jobname} className="border-t">
                  <td className="py-1 font-medium">{j.jobname}</td>
                  <td><code className="text-xs">{j.schedule}</code></td>
                  <td>{j.active ? "ja" : "nein"}</td>
                  <td><span className={j.last_status === "succeeded" ? "text-success" : j.last_status ? "text-destructive" : "text-muted-foreground"}>{j.last_status ?? "—"}</span></td>
                  <td>{j.last_end ? new Date(j.last_end).toLocaleString() : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

// ====================== EMAIL QUEUE ======================

function EmailQueuePanel() {
  const listFn = useServerFn(listEmailLog);
  const retryFn = useServerFn(retryDlqEmail);
  const qc = useQueryClient();
  const [status, setStatus] = useState<string>("all");
  const [template, setTemplate] = useState<string>("");
  const [recipient, setRecipient] = useState<string>("");
  const q = useQuery({
    queryKey: ["sa-emails", status, template, recipient],
    queryFn: () => listFn({ data: {
      limit: 200,
      status: status === "all" ? null : status,
      template_name: template || null,
      recipient: recipient || null,
    } }),
    refetchInterval: 30_000,
  });
  const badge = (s: string) => {
    const base = "px-1.5 py-0.5 rounded text-xs ";
    if (s === "sent") return base + "bg-success/15 text-success";
    if (s === "pending") return base + "bg-warning/15 text-warning";
    if (s === "suppressed") return base + "bg-muted text-muted-foreground";
    return base + "bg-destructive/15 text-destructive";
  };
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-end">
        <div>
          <Label className="text-xs">Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle</SelectItem>
              <SelectItem value="sent">Gesendet</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="dlq">DLQ</SelectItem>
              <SelectItem value="suppressed">Suppressed</SelectItem>
              <SelectItem value="bounced">Bounced</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Template</Label>
          <Input className="w-[200px]" value={template} onChange={(e) => setTemplate(e.target.value)} placeholder="z.B. recovery" />
        </div>
        <div className="flex-1 min-w-[200px]">
          <Label className="text-xs">Empfänger enthält</Label>
          <Input value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="email…" />
        </div>
        <Button variant="outline" size="sm" onClick={() => qc.invalidateQueries({ queryKey: ["sa-emails"] })}>
          <RefreshCw className="size-4" />
        </Button>
      </div>
      <div className="border rounded">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left">
            <tr><th className="p-2">Zeit</th><th>Template</th><th>Empfänger</th><th>Status</th><th>Fehler</th><th></th></tr>
          </thead>
          <tbody>
            {(q.data?.rows ?? []).map((r: any) => (
              <tr key={r.id} className="border-t">
                <td className="p-2 whitespace-nowrap text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</td>
                <td className="text-xs">{r.template_name}</td>
                <td className="text-xs">{r.recipient_email}</td>
                <td><span className={badge(r.status)}>{r.status}</span></td>
                <td className="text-xs text-destructive max-w-[300px] truncate" title={r.error_message ?? ""}>{r.error_message}</td>
                <td>
                  {(r.status === "dlq" || r.status === "failed") && (
                    <Button size="sm" variant="outline" onClick={async () => {
                      try { await retryFn({ data: { log_id: r.id } }); toast.success("Erneut eingereiht"); qc.invalidateQueries({ queryKey: ["sa-emails"] }); }
                      catch (e: any) { toast.error(e?.message ?? "Fehler"); }
                    }}>Retry</Button>
                  )}
                </td>
              </tr>
            ))}
            {(q.data?.rows ?? []).length === 0 && !q.isLoading && (
              <tr><td colSpan={6} className="p-4 text-center text-sm text-muted-foreground">Keine Einträge.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ====================== AUDIT LOG ======================

function AuditLogPanel() {
  const fn = useServerFn(listAuditLog);
  const [action, setAction] = useState<string>("");
  const q = useQuery({
    queryKey: ["sa-audit", action],
    queryFn: () => fn({ data: { limit: 300, action: action || null } }),
  });
  const fmtMeta = (m: any) => {
    if (!m || Object.keys(m).length === 0) return "";
    try { return JSON.stringify(m); } catch { return ""; }
  };
  return (
    <div className="space-y-3">
      <div className="flex gap-2 items-end">
        <div className="flex-1 max-w-[300px]">
          <Label className="text-xs">Action filtern</Label>
          <Input value={action} onChange={(e) => setAction(e.target.value)} placeholder="z.B. license.create" />
        </div>
      </div>
      <div className="border rounded">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left">
            <tr><th className="p-2">Zeit</th><th>Akteur</th><th>Aktion</th><th>Ziel</th><th>Details</th></tr>
          </thead>
          <tbody>
            {(q.data?.rows ?? []).map((r: any) => (
              <tr key={r.id} className="border-t align-top">
                <td className="p-2 text-xs text-muted-foreground whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</td>
                <td className="text-xs">{r.actor_email ?? r.actor_id?.slice(0, 8)}</td>
                <td><code className="text-xs">{r.action}</code></td>
                <td className="text-xs">{r.target_label ?? r.target_id?.slice(0, 8) ?? ""}<br/><span className="text-muted-foreground">{r.target_type}</span></td>
                <td className="text-xs text-muted-foreground max-w-[400px] truncate" title={fmtMeta(r.metadata)}>{fmtMeta(r.metadata)}</td>
              </tr>
            ))}
            {(q.data?.rows ?? []).length === 0 && !q.isLoading && (
              <tr><td colSpan={5} className="p-4 text-center text-sm text-muted-foreground">Noch keine Einträge.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ====================== ONBOARDING WIZARD ======================

type OnboardPayload = {
  slug: string; name: string;
  admin: { email: string; password: string; display_name: string };
  license: { valid_until: string | null; max_users: number | null; notes: string | null };
};

function OnboardingWizard({ onCreate }: { onCreate: (p: OnboardPayload) => Promise<any> }) {
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [adminName, setAdminName] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [maxUsers, setMaxUsers] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);

  const valid = slug && name && email && pw.length >= 8 && adminName;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Rocket className="size-5" /> Domain in einem Schritt aufsetzen</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-3">
          <div><Label>Slug</Label><Input value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase())} placeholder="alpha-zentrale" /></div>
          <div><Label>Anzeige-Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Alpha Zentrale GmbH" /></div>
        </div>
        <div className="border-t pt-3">
          <div className="text-sm font-medium mb-2">Erster Admin</div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div><Label>Name</Label><Input value={adminName} onChange={(e) => setAdminName(e.target.value)} placeholder="Max Mustermann" /></div>
            <div><Label>E-Mail</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@firma.de" /></div>
            <div className="sm:col-span-2"><Label>Passwort (min. 8)</Label><Input value={pw} onChange={(e) => setPw(e.target.value)} placeholder="StartPass123" /></div>
          </div>
        </div>
        <div className="border-t pt-3">
          <div className="text-sm font-medium mb-2">Lizenz (optional)</div>
          <div className="grid sm:grid-cols-3 gap-3">
            <div><Label>Ablaufdatum</Label><Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} /></div>
            <div><Label>Max. Nutzer</Label><Input type="number" min={1} value={maxUsers} onChange={(e) => setMaxUsers(e.target.value)} placeholder="∞" /></div>
            <div><Label>Notiz</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
          </div>
        </div>
        <Button disabled={!valid || busy} onClick={async () => {
          setBusy(true);
          try {
            const r = await onCreate({
              slug: slug.trim(), name: name.trim(),
              admin: { email: email.trim(), password: pw, display_name: adminName.trim() },
              license: {
                valid_until: validUntil ? toIsoOrNull(validUntil) : null,
                max_users: maxUsers ? Number(maxUsers) : null,
                notes: notes || null,
              },
            });
            setResult(r);
            setSlug(""); setName(""); setEmail(""); setPw(""); setAdminName("");
            setValidUntil(""); setMaxUsers(""); setNotes("");
          } catch (e: any) { toast.error(e?.message ?? "Fehler"); }
          finally { setBusy(false); }
        }}>
          {busy && <Loader2 className="size-4 mr-2 animate-spin" />}Domain anlegen
        </Button>
        {result && (
          <div className="border rounded p-3 bg-success/5 text-sm space-y-1">
            <div className="font-medium text-success">Erfolg.</div>
            <div>Domain: <b>{result.domain?.name}</b> (<code>{result.domain?.slug}</code>)</div>
            <div>Lizenz-Key: <code>{result.license?.license_key}</code></div>
            <div>Admin-User-ID: <code>{result.admin_user_id}</code></div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ====================== GLOBAL SEARCH ======================

function GlobalSearchPanel({ domains }: { domains: any[] }) {
  const fn = useServerFn(globalSearch);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<any>(null);
  const dn = (id: string | null) => domains.find((d) => d.id === id)?.name ?? "—";
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input className="pl-9" value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Domain, Slug, Nutzer-Name, E-Mail, Lizenz-Key…"
            onKeyDown={async (e) => {
              if (e.key !== "Enter" || !q.trim()) return;
              setBusy(true);
              try { setRes(await fn({ data: { query: q.trim() } })); }
              catch (err: any) { toast.error(err?.message ?? "Fehler"); }
              finally { setBusy(false); }
            }} />
        </div>
        <Button disabled={!q.trim() || busy} onClick={async () => {
          setBusy(true);
          try { setRes(await fn({ data: { query: q.trim() } })); }
          catch (err: any) { toast.error(err?.message ?? "Fehler"); }
          finally { setBusy(false); }
        }}>{busy ? <Loader2 className="size-4 animate-spin" /> : "Suchen"}</Button>
      </div>
      {!res && <div className="text-sm text-muted-foreground">Suche über alle Domains, Nutzer und Lizenz-Keys.</div>}
      {res && (
        <div className="space-y-3">
          <SearchSection title={`Domains (${res.domains.length})`} empty="Keine Treffer.">
            {res.domains.map((d: any) => (
              <div key={d.id} className="text-sm flex justify-between border rounded p-2">
                <div><b>{d.name}</b> <span className="text-muted-foreground">{d.slug}</span></div>
                <span className="text-xs text-muted-foreground">{d.status}</span>
              </div>
            ))}
          </SearchSection>
          <SearchSection title={`Lizenzen (${res.licenses.length})`} empty="Keine Treffer.">
            {res.licenses.map((l: any) => (
              <div key={l.id} className="text-sm flex justify-between border rounded p-2">
                <div><code className="text-xs">{l.license_key}</code> · {dn(l.domain_id)}</div>
                <span className="text-xs text-muted-foreground">{l.status} {l.valid_until && `· bis ${new Date(l.valid_until).toLocaleDateString()}`}</span>
              </div>
            ))}
          </SearchSection>
          <SearchSection title={`Nutzer / Name (${res.profiles.length})`} empty="Keine Treffer.">
            {res.profiles.map((p: any) => (
              <div key={p.id} className="text-sm flex justify-between border rounded p-2">
                <div>{p.display_name}</div>
                <span className="text-xs text-muted-foreground">{dn(p.domain_id)}</span>
              </div>
            ))}
          </SearchSection>
          <SearchSection title={`Nutzer / E-Mail (${res.users_by_email.length})`} empty="Keine Treffer.">
            {res.users_by_email.map((u: any) => (
              <div key={u.id} className="text-sm border rounded p-2">{u.email}</div>
            ))}
          </SearchSection>
        </div>
      )}
    </div>
  );
}

function SearchSection({ title, empty, children }: { title: string; empty: string; children: React.ReactNode }) {
  const arr = Array.isArray(children) ? children : [children];
  const hasItems = arr.filter(Boolean).length > 0;
  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">{title}</CardTitle></CardHeader>
      <CardContent className="space-y-1">
        {hasItems ? children : <div className="text-xs text-muted-foreground">{empty}</div>}
      </CardContent>
    </Card>
  );
}

// ====================== DOMAIN STATS DIALOG ======================

function DomainStatsDialog({ domain, onClose }: { domain: any; onClose: () => void }) {
  const fn = useServerFn(getDomainStats);
  const q = useQuery({ queryKey: ["sa-dom-stats", domain?.id], queryFn: () => fn({ data: { domain_id: domain.id } }), enabled: !!domain?.id });
  if (!domain) return null;
  const s: any = q.data ?? {};
  const mb = s.dateien_bytes ? (s.dateien_bytes / 1024 / 1024).toFixed(1) : "0";
  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <Card className="w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><BarChart3 className="size-5" /> {domain.name}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {q.isLoading && <div className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="size-4 animate-spin" /> lädt…</div>}
          {q.data && (
            <div className="grid grid-cols-2 gap-3 text-sm">
              <StatLine label="Nutzer" v={s.users} />
              <StatLine label="Aktive Lizenzen" v={s.licenses_active} />
              <StatLine label="Einsätze gesamt" v={s.einsaetze_total} />
              <StatLine label="Einsätze 24h" v={s.einsaetze_24h} />
              <StatLine label="Dateien" v={s.dateien_count} />
              <StatLine label="Storage" v={`${mb} MB`} />
            </div>
          )}
          <div className="text-right pt-2">
            <Button size="sm" variant="outline" onClick={onClose}>Schließen</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatLine({ label, v }: { label: string; v: React.ReactNode }) {
  return (
    <div className="border rounded p-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-xl font-semibold">{v ?? "—"}</div>
    </div>
  );
}

function ModuleControl({
  domains, modules, dmodules, onToggle,
}: {
  domains: any[];
  modules: any[];
  dmodules: any[];
  onToggle: (domain_id: string, module_key: string, enabled: boolean) => void | Promise<void>;
}) {
  const [view, setView] = useState<"matrix" | "domain">("matrix");
  const [domainId, setDomainId] = useState<string>(domains[0]?.id ?? "");
  const [q, setQ] = useState("");

  const parents = useMemo(() => modules.filter((m) => !m.parent_key), [modules]);
  const childrenOf = (key: string) => modules.filter((m) => m.parent_key === key);

  const matches = (m: any) => {
    if (!q.trim()) return true;
    const s = q.toLowerCase();
    return (m.name ?? "").toLowerCase().includes(s) || (m.key ?? "").toLowerCase().includes(s);
  };
  const visibleParents = parents.filter((p) => matches(p) || childrenOf(p.key).some(matches));

  const isEnabled = (did: string, key: string) =>
    dmodules.find((x) => x.domain_id === did && x.module_key === key)?.enabled ?? false;

  if (domains.length === 0) return <div className="text-sm text-muted-foreground p-4">Keine Domains vorhanden.</div>;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <Card>
        <CardContent className="p-3 flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-md border bg-card p-0.5">
            <button
              onClick={() => setView("matrix")}
              className={`px-3 py-1.5 text-sm rounded inline-flex items-center gap-1.5 ${view === "matrix" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              <LayoutGrid className="size-4" /> Matrix
            </button>
            <button
              onClick={() => setView("domain")}
              className={`px-3 py-1.5 text-sm rounded inline-flex items-center gap-1.5 ${view === "domain" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              <ListFilter className="size-4" /> Pro Mandant
            </button>
          </div>
          {view === "domain" && (
            <Select value={domainId} onValueChange={setDomainId}>
              <SelectTrigger className="w-[220px]"><SelectValue placeholder="Mandant wählen…" /></SelectTrigger>
              <SelectContent>
                {domains.map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Modul suchen…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {view === "matrix" && (
        <ModuleMatrix
          domains={domains}
          parents={visibleParents}
          childrenOf={childrenOf}
          matches={matches}
          isEnabled={isEnabled}
          onToggle={onToggle}
        />
      )}

      {view === "domain" && (
        <ModuleDomainView
          domain={domains.find((d) => d.id === domainId)}
          parents={visibleParents}
          childrenOf={childrenOf}
          matches={matches}
          modules={modules}
          isEnabled={(k) => isEnabled(domainId, k)}
          onToggle={(k, v) => onToggle(domainId, k, v)}
        />
      )}
    </div>
  );
}

function ModuleMatrix({
  domains, parents, childrenOf, matches, isEnabled, onToggle,
}: {
  domains: any[];
  parents: any[];
  childrenOf: (k: string) => any[];
  matches: (m: any) => boolean;
  isEnabled: (did: string, key: string) => boolean;
  onToggle: (did: string, key: string, val: boolean) => void | Promise<void>;
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const toggleExp = (k: string) => setExpanded((s) => ({ ...s, [k]: !s[k] }));

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="text-sm w-full">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-muted/80 backdrop-blur p-3 text-left min-w-[240px]">Modul</th>
              {domains.map((d) => (
                <th key={d.id} className="p-3 text-center min-w-[110px]">
                  <div className="font-medium text-foreground truncate max-w-[120px]" title={d.name}>{d.name}</div>
                  <div className="text-[11px] text-muted-foreground font-normal">{d.slug}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {parents.map((p) => {
              const kids = childrenOf(p.key).filter(matches);
              const isOpen = expanded[p.key];
              const hasKids = kids.length > 0;
              return (
                <>
                  <tr key={p.id} className="bg-muted/30">
                    <td className="sticky left-0 z-10 bg-muted/60 backdrop-blur p-3">
                      <div className="flex items-center gap-2">
                        {hasKids ? (
                          <button
                            onClick={() => toggleExp(p.key)}
                            className="size-5 grid place-items-center rounded hover:bg-muted text-muted-foreground"
                            aria-label={isOpen ? "Einklappen" : "Ausklappen"}>
                            <span className={`text-xs transition-transform ${isOpen ? "rotate-90" : ""}`}>▶</span>
                          </button>
                        ) : <span className="size-5" />}
                        <div className="min-w-0">
                          <div className="font-medium truncate">{p.name}</div>
                          <div className="text-[11px] text-muted-foreground truncate">{p.key}</div>
                        </div>
                      </div>
                    </td>
                    {domains.map((d) => (
                      <td key={d.id} className="p-2 text-center">
                        <Switch
                          checked={isEnabled(d.id, p.key)}
                          onCheckedChange={(v) => onToggle(d.id, p.key, v)}
                        />
                      </td>
                    ))}
                  </tr>
                  {isOpen && kids.map((c) => (
                    <tr key={c.id}>
                      <td className="sticky left-0 z-10 bg-card p-3">
                        <div className="pl-9 min-w-0">
                          <div className="text-sm truncate">{c.name}</div>
                          <div className="text-[11px] text-muted-foreground truncate">{c.key}</div>
                        </div>
                      </td>
                      {domains.map((d) => {
                        const parentOn = isEnabled(d.id, p.key);
                        return (
                          <td key={d.id} className={`p-2 text-center ${!parentOn ? "opacity-50" : ""}`}>
                            <Switch
                              checked={isEnabled(d.id, c.key) && parentOn}
                              disabled={!parentOn}
                              onCheckedChange={(v) => onToggle(d.id, c.key, v)}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </>
              );
            })}
            {parents.length === 0 && (
              <tr><td colSpan={domains.length + 1} className="p-8 text-center text-muted-foreground">Keine Treffer.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function ModuleDomainView({
  domain, parents, childrenOf, matches, modules, isEnabled, onToggle,
}: {
  domain: any;
  parents: any[];
  childrenOf: (k: string) => any[];
  matches: (m: any) => boolean;
  modules: any[];
  isEnabled: (key: string) => boolean;
  onToggle: (key: string, val: boolean) => void | Promise<void>;
}) {
  if (!domain) return null;
  const activeCount = modules.filter((m) => isEnabled(m.key)).length;

  const setAll = async (val: boolean) => {
    for (const m of modules) {
      const current = isEnabled(m.key);
      if (current !== val) await onToggle(m.key, val);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1 text-sm">
        <div>
          <span className="text-muted-foreground">Mandant:</span>{" "}
          <span className="font-medium">{domain.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground tabular-nums">{activeCount} von {modules.length} aktiv</span>
          <Button size="sm" variant="outline" onClick={() => setAll(true)}>Alle an</Button>
          <Button size="sm" variant="outline" onClick={() => setAll(false)}>Alle aus</Button>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {parents.map((p) => {
          const parentOn = isEnabled(p.key);
          const kids = childrenOf(p.key).filter(matches);
          return (
            <Card key={p.id} className="overflow-hidden">
              <div className="flex items-center justify-between gap-3 px-4 py-3 border-b bg-muted/30">
                <div className="min-w-0">
                  <div className="font-medium truncate">{p.name}</div>
                  <div className="text-xs text-muted-foreground truncate">{p.key}</div>
                </div>
                <Switch checked={parentOn} onCheckedChange={(v) => onToggle(p.key, v)} />
              </div>
              {kids.length > 0 && (
                <div className="divide-y">
                  {kids.map((c) => {
                    const on = isEnabled(c.key);
                    return (
                      <div key={c.id} className={`flex items-center justify-between gap-3 px-4 py-2.5 ${!parentOn ? "opacity-50" : ""}`}>
                        <div className="min-w-0">
                          <div className="text-sm truncate">{c.name}</div>
                          <div className="text-[11px] text-muted-foreground truncate">{c.key}</div>
                        </div>
                        <Switch
                          checked={on && parentOn}
                          disabled={!parentOn}
                          onCheckedChange={(v) => onToggle(c.key, v)}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          );
        })}
        {parents.length === 0 && (
          <div className="text-sm text-muted-foreground p-4">Keine Treffer.</div>
        )}
      </div>
    </div>
  );
}

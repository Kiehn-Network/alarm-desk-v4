import { createFileRoute, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
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
import { toast } from "sonner";
import {
  Activity, Building2, Crown, Globe2, KeyRound, LayoutDashboard,
  Loader2, Mail, RefreshCw, Search, ShieldAlert, ShieldCheck, Trash2, Upload, Users,
  Copy, Archive, BarChart3, Download, Rocket, CalendarClock,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/superadmin")({
  beforeLoad: async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) throw redirect({ to: "/login" });
    const { data: roles } = await supabase.from("user_roles")
      .select("role").eq("user_id", u.user.id).eq("role", "superadmin").maybeSingle();
    if (!roles) throw redirect({ to: "/dashboard" });
  },
  component: SuperAdminPage,
});

function SuperAdminPage() {
  const qc = useQueryClient();
  const listDomFn = useServerFn(listDomains);
  const listModFn = useServerFn(listAppModules);
  const listUsersFn = useServerFn(listAllTenantUsers);
  const impFn = useServerFn(getImpersonation);

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

  const [newSlug, setNewSlug] = useState("");
  const [newName, setNewName] = useState("");

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
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Crown className="size-6 text-primary" /> SuperAdmin</h1>
          <p className="text-muted-foreground text-sm">Mandanten, Lizenzen, Module &amp; Nutzerverwaltung</p>
        </div>
        {imp && (
          <div className="flex items-center gap-3 px-4 py-2 rounded-lg bg-warning/10 border border-warning/30">
            <span className="text-sm">Impersonation: <b>{imp.name}</b></span>
            <Button size="sm" variant="outline" onClick={async () => { await stopImp({}); invalidateAll(); }}>Beenden</Button>
          </div>
        )}
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview"><LayoutDashboard className="size-4 mr-1.5" />Übersicht</TabsTrigger>
          <TabsTrigger value="domains">Domains</TabsTrigger>
          <TabsTrigger value="licenses">Lizenzen</TabsTrigger>
          <TabsTrigger value="modules">Module</TabsTrigger>
          <TabsTrigger value="users">Nutzer</TabsTrigger>
          <TabsTrigger value="health"><Activity className="size-4 mr-1.5" />Health</TabsTrigger>
          <TabsTrigger value="emails"><Mail className="size-4 mr-1.5" />E-Mails</TabsTrigger>
          <TabsTrigger value="audit">Audit-Log</TabsTrigger>
          <TabsTrigger value="system">System</TabsTrigger>
          <TabsTrigger value="selfhost">Self-Hosting</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard icon={<Globe2 className="size-5" />} label="Domains aktiv"
              value={stats?.domains_active ?? "—"} sub={`${stats?.domains_disabled ?? 0} deaktiviert`} />
            <KpiCard icon={<ShieldCheck className="size-5" />} label="Lizenzen aktiv"
              value={stats?.licenses_active ?? "—"}
              sub={stats?.licenses_expiring_30d ? `${stats.licenses_expiring_30d} laufen in 30 Tagen aus` : "alles stabil"}
              warn={!!stats?.licenses_expiring_30d} />
            <KpiCard icon={<Users className="size-5" />} label="Nutzer gesamt"
              value={stats?.users_total ?? "—"}
              sub={stats ? Object.entries(stats.role_counts).map(([r, n]) => `${r}: ${n}`).join(" · ") : ""} />
            <KpiCard icon={<Activity className="size-5" />} label="Einsätze (24h)"
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
                  <div className="flex items-center gap-2">
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
          {domains.map((d: any) => {
            const dLic = licenses.filter((l: any) => l.domain_id === d.id);
            return (
              <Card key={d.id}>
                <CardHeader>
                  <CardTitle className="text-base">{d.name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <NewLicenseForm
                    onCreate={async (payload) => {
                      await createLic({ data: { domain_id: d.id, ...payload } });
                      invalidateAll(); toast.success("Lizenz erstellt");
                    }}
                  />
                  {dLic.length === 0 && <div className="text-sm text-muted-foreground">Keine Lizenzen.</div>}
                  {dLic.map((l: any) => (
                    <LicenseRow
                      key={l.id}
                      license={l}
                      onUpdate={async (payload) => {
                        await updateLic({ data: { id: l.id, ...payload } });
                        invalidateAll(); toast.success("Lizenz aktualisiert");
                      }}
                      onRevoke={async () => { await revokeLic({ data: { id: l.id } }); invalidateAll(); }}
                    />
                  ))}
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        <TabsContent value="modules">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border">
              <thead>
                <tr className="bg-muted">
                  <th className="p-2 text-left">Modul</th>
                  {domains.map((d: any) => <th key={d.id} className="p-2 text-center">{d.name}</th>)}
                </tr>
              </thead>
              <tbody>
                {modules.map((m: any) => (
                  <tr key={m.id} className="border-t">
                    <td className="p-2">
                      {m.parent_key && <span className="text-muted-foreground mr-1">└</span>}
                      <span className={m.parent_key ? "pl-4" : "font-medium"}>{m.name}</span>{" "}
                      <span className="text-xs text-muted-foreground">({m.key})</span>
                    </td>
                    {domains.map((d: any) => {
                      const dm = dmodules.find((x: any) => x.domain_id === d.id && x.module_key === m.key);
                      const enabled = dm?.enabled ?? false;
                      const parentEnabled = m.parent_key
                        ? (dmodules.find((x: any) => x.domain_id === d.id && x.module_key === m.parent_key)?.enabled ?? false)
                        : true;
                      return (
                        <td key={d.id} className="p-2 text-center">
                          <Switch checked={enabled && parentEnabled} disabled={!parentEnabled} onCheckedChange={async (v) => {
                            await toggleMod({ data: { domain_id: d.id, module_key: m.key, enabled: v } });
                            invalidateAll();
                          }} />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
      </Tabs>
    </div>
  );
}

function KpiCard({ icon, label, value, sub, warn }: {
  icon: React.ReactNode; label: string; value: React.ReactNode; sub?: string; warn?: boolean;
}) {
  return (
    <Card className={warn ? "border-warning/40" : undefined}>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wide">
          <span className={warn ? "text-warning" : "text-primary"}>{icon}</span>
          {label}
        </div>
        <div className="text-3xl font-bold mt-2">{value}</div>
        {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
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

function NewLicenseForm({ onCreate }: { onCreate: (p: LicensePayload) => Promise<void> }) {
  const [date, setDate] = useState("");
  const [maxUsers, setMaxUsers] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex flex-wrap items-end gap-2 p-2 border rounded bg-muted/30">
      <div className="flex flex-col">
        <Label className="text-xs mb-1">Ablaufdatum</Label>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-[160px]" />
      </div>
      <div className="flex flex-col">
        <Label className="text-xs mb-1">Max. Nutzer</Label>
        <Input type="number" min={1} value={maxUsers} onChange={(e) => setMaxUsers(e.target.value)} className="w-[110px]" placeholder="∞" />
      </div>
      <div className="flex flex-col flex-1 min-w-[180px]">
        <Label className="text-xs mb-1">Notiz</Label>
        <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="optional" />
      </div>
      <Button size="sm" disabled={busy} onClick={async () => {
        setBusy(true);
        try {
          await onCreate({
            valid_until: toIsoOrNull(date),
            max_users: maxUsers ? Number(maxUsers) : null,
            notes: notes || null,
          });
          setDate(""); setMaxUsers(""); setNotes("");
        } catch (e: any) { toast.error(e?.message ?? "Fehler"); }
        finally { setBusy(false); }
      }}>Neue Lizenz</Button>
    </div>
  );
}

function LicenseRow({ license, onUpdate, onRevoke }: {
  license: any;
  onUpdate: (p: Partial<LicensePayload>) => Promise<void>;
  onRevoke: () => Promise<void>;
}) {
  const [date, setDate] = useState(isoToDateInput(license.valid_until));
  const [busy, setBusy] = useState(false);
  const dirty = date !== isoToDateInput(license.valid_until);
  const expired = license.valid_until && new Date(license.valid_until) < new Date();
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-sm border rounded p-2">
      <div className="flex flex-col gap-0.5">
        <code className="text-xs">{license.license_key}</code>
        <span className="text-xs text-muted-foreground">
          {license.status}
          {license.valid_until && (
            <span className={expired ? "text-destructive ml-1" : "ml-1"}>
              · {expired ? "abgelaufen" : "gültig bis"} {new Date(license.valid_until).toLocaleDateString()}
            </span>
          )}
          {!license.valid_until && <span className="ml-1">· unbefristet</span>}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-[150px] h-8" />
        {date && (
          <Button size="sm" variant="ghost" onClick={() => setDate("")}>×</Button>
        )}
        <Button size="sm" variant="outline" disabled={!dirty || busy} onClick={async () => {
          setBusy(true);
          try { await onUpdate({ valid_until: toIsoOrNull(date) }); }
          catch (e: any) { toast.error(e?.message ?? "Fehler"); }
          finally { setBusy(false); }
        }}>Speichern</Button>
        {license.status === "active" && (
          <Button size="sm" variant="outline" onClick={onRevoke}>Widerrufen</Button>
        )}
      </div>
    </div>
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

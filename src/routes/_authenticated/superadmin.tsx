import { createFileRoute, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  listDomains, createDomain, setDomainStatus,
  createLicense, revokeLicense, toggleDomainModule,
  listAllTenantUsers, assignUserToDomain,
  startImpersonation, stopImpersonation, getImpersonation,
  getPlatformSettings, updatePlatformMaintenance,
  listAppVersions, createAppVersion, deleteAppVersion,
} from "@/lib/superadmin.functions";
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
  };

  const createDom = useServerFn(createDomain);
  const setStatus = useServerFn(setDomainStatus);
  const createLic = useServerFn(createLicense);
  const revokeLic = useServerFn(revokeLicense);
  const toggleMod = useServerFn(toggleDomainModule);
  const assign = useServerFn(assignUserToDomain);
  const startImp = useServerFn(startImpersonation);
  const stopImp = useServerFn(stopImpersonation);

  const [newSlug, setNewSlug] = useState("");
  const [newName, setNewName] = useState("");

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

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">SuperAdmin</h1>
          <p className="text-muted-foreground text-sm">Mandanten, Lizenzen, Module &amp; Nutzerverwaltung</p>
        </div>
        {imp && (
          <div className="flex items-center gap-3 px-4 py-2 rounded-lg bg-warning/10 border border-warning/30">
            <span className="text-sm">Impersonation: <b>{imp.name}</b></span>
            <Button size="sm" variant="outline" onClick={async () => { await stopImp({}); invalidateAll(); }}>Beenden</Button>
          </div>
        )}
      </div>

      <Tabs defaultValue="domains">
        <TabsList>
          <TabsTrigger value="domains">Domains</TabsTrigger>
          <TabsTrigger value="licenses">Lizenzen</TabsTrigger>
          <TabsTrigger value="modules">Module</TabsTrigger>
          <TabsTrigger value="users">Nutzer</TabsTrigger>
          <TabsTrigger value="system">System</TabsTrigger>
        </TabsList>

        <TabsContent value="domains" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Neue Domain</CardTitle></CardHeader>
            <CardContent className="flex flex-col sm:flex-row gap-3">
              <Input placeholder="slug (z.B. alpha-zentrale)" value={newSlug} onChange={(e) => setNewSlug(e.target.value)} />
              <Input placeholder="Name" value={newName} onChange={(e) => setNewName(e.target.value)} />
              <Button onClick={() => m_createDom.mutate()} disabled={!newSlug || !newName || m_createDom.isPending}>Anlegen</Button>
            </CardContent>
          </Card>
          <div className="grid gap-3">
            {domains.map((d: any) => (
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
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-base">{d.name}</CardTitle>
                  <Button size="sm" onClick={async () => {
                    await createLic({ data: { domain_id: d.id, valid_until: null, max_users: null, notes: null } });
                    invalidateAll(); toast.success("Lizenz erstellt");
                  }}>Neue Lizenz</Button>
                </CardHeader>
                <CardContent className="space-y-2">
                  {dLic.length === 0 && <div className="text-sm text-muted-foreground">Keine Lizenzen.</div>}
                  {dLic.map((l: any) => (
                    <div key={l.id} className="flex items-center justify-between text-sm border rounded p-2">
                      <div>
                        <code className="text-xs">{l.license_key}</code>
                        <span className="ml-3 text-muted-foreground">
                          {l.status} {l.valid_until ? `· bis ${new Date(l.valid_until).toLocaleDateString()}` : ""}
                        </span>
                      </div>
                      {l.status === "active" && (
                        <Button size="sm" variant="outline" onClick={async () => { await revokeLic({ data: { id: l.id } }); invalidateAll(); }}>Widerrufen</Button>
                      )}
                    </div>
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
                    <td className="p-2">{m.name} <span className="text-xs text-muted-foreground">({m.key})</span></td>
                    {domains.map((d: any) => {
                      const dm = dmodules.find((x: any) => x.domain_id === d.id && x.module_key === m.key);
                      const enabled = dm?.enabled ?? false;
                      return (
                        <td key={d.id} className="p-2 text-center">
                          <Switch checked={enabled} onCheckedChange={async (v) => {
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
          {users.map((u: any) => {
            const r = u.roles[0];
            return (
              <Card key={u.id}>
                <CardContent className="p-3 flex flex-wrap items-center gap-3">
                  <div className="flex-1 min-w-[220px]">
                    <div className="font-medium">{u.display_name ?? u.email}</div>
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
                    <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="superadmin">SuperAdmin</SelectItem>
                      <SelectItem value="admin">Domain-Admin</SelectItem>
                      <SelectItem value="user">User</SelectItem>
                    </SelectContent>
                  </Select>
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
      </Tabs>
    </div>
  );
}

import { createFileRoute, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { useRole } from "@/hooks/use-role";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  listDomains, createDomain, setDomainStatus,
  createLicense, revokeLicense, toggleDomainModule,
  updateLicense,
  listAllTenantUsers, assignUserToDomain,
  createTenantUser,
  startImpersonation, stopImpersonation, getImpersonation,
  startImpersonationWithPin,
  getPlatformSettings, updatePlatformMaintenance,
  listAppVersions, createAppVersion, deleteAppVersion,
  sendPasswordReset, setUserDisabled, deleteTenantUser, bulkImportUsers,
  getSuperAdminStats,
  listAuditLog, getHealthSnapshot, listEmailLog, retryDlqEmail,
  extendLicenses, onboardDomain, cloneDomain, sendLicenseExpiryNotices,
  setDomainArchived, globalSearch, getDomainStats, exportDomainData,
} from "@/lib/superadmin.functions";
import { SelfHostGuide } from "@/components/admin/selfhost-guide";
import { PlatformEmailPanel } from "@/components/admin/platform-email-panel";
import { listAppModules } from "@/lib/settings.functions";
import {
  previewSyncTarget, runFullSync, startSyncJob, getSyncJob,
  startSchemaMigrationJob, runSchemaMigration, exportMigrationsSql,
  exportFullBootstrapSql,
  previewSchemaDiff, applySchemaDiff, startSchemaDiffJob,
} from "@/lib/db-sync.functions";
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
  Copy, Archive, BarChart3, Download, Rocket, CalendarClock, Plus, X, Filter, LifeBuoy, Network,
} from "lucide-react";
import { listSupportTickets, updateSupportTicket, getOpenTicketsCount } from "@/lib/support.functions";
import { TicketDialog } from "@/routes/_authenticated/support";
import { listPendingPurgeRequests, decidePurgeRequest } from "@/lib/data-purge.functions";
import { saListInterventionAllowlist, saSetInterventionAllowlist } from "@/lib/intervention.functions";

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

function SupportTicketsPanel() {
  const listFn = useServerFn(listSupportTickets);
  const updFn = useServerFn(updateSupportTicket);
  const qc = useQueryClient();
  const [status, setStatus] = useState<"open" | "in_progress" | "closed" | "all">("open");
  const [activeId, setActiveId] = useState<string | null>(null);
  const tq = useQuery({
    queryKey: ["sa-tickets", status],
    queryFn: () => listFn({ data: { status } }),
  });
  const updM = useMutation({
    mutationFn: (v: { id: string; status: any }) => updFn({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sa-tickets"] });
      qc.invalidateQueries({ queryKey: ["sa-open-tickets"] });
    },
  });

  const STATUS_LABEL: Record<string, string> = { open: "Offen", in_progress: "In Bearbeitung", closed: "Geschlossen" };
  const PRIO_LABEL: Record<string, string> = { low: "Niedrig", normal: "Normal", high: "Hoch" };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <CardTitle className="flex items-center gap-2"><LifeBuoy className="size-4" />Support-Tickets</CardTitle>
          <Select value={status} onValueChange={(v) => setStatus(v as any)}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="open">Offen</SelectItem>
              <SelectItem value="in_progress">In Bearbeitung</SelectItem>
              <SelectItem value="closed">Geschlossen</SelectItem>
              <SelectItem value="all">Alle</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {tq.isLoading ? (
          <div className="text-sm text-muted-foreground">Lädt …</div>
        ) : (tq.data ?? []).length === 0 ? (
          <div className="text-sm text-muted-foreground py-10 text-center">Keine Tickets in dieser Ansicht.</div>
        ) : (
          <div className="divide-y">
            {(tq.data ?? []).map((t: any) => (
              <div key={t.id} className="py-3 flex items-center gap-3">
                <button onClick={() => setActiveId(t.id)} className="flex-1 min-w-0 text-left">
                  <div className="font-medium truncate">{t.subject}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {t.domain?.name ?? "—"} · {t.creator?.display_name ?? "—"} ·
                    {" "}{new Date(t.last_message_at).toLocaleString("de-DE")}
                  </div>
                </button>
                <Badge variant="outline">{PRIO_LABEL[t.priority] ?? t.priority}</Badge>
                <Select value={t.status}
                  onValueChange={(v) => updM.mutate({ id: t.id, status: v })}>
                  <SelectTrigger className="w-40 h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">{STATUS_LABEL.open}</SelectItem>
                    <SelectItem value="in_progress">{STATUS_LABEL.in_progress}</SelectItem>
                    <SelectItem value="closed">{STATUS_LABEL.closed}</SelectItem>
                  </SelectContent>
                </Select>
                <Button size="sm" variant="outline" onClick={() => setActiveId(t.id)}>Öffnen</Button>
              </div>
            ))}
          </div>
        )}
        <TicketDialog id={activeId} onClose={() => setActiveId(null)} canChangeStatus />
      </CardContent>
    </Card>
  );
}

function NavDivider() {
  return <span className="mx-1 h-5 w-px bg-border/70 self-center" aria-hidden />;
}

function DbSyncPanel() {
  const previewFn = useServerFn(previewSyncTarget);
  const runFn = useServerFn(runFullSync);
  const startFn = useServerFn(startSyncJob);
  const getJobFn = useServerFn(getSyncJob);
  const startMigFn = useServerFn(startSchemaMigrationJob);
  const runMigFn = useServerFn(runSchemaMigration);
  const exportMigFn = useServerFn(exportMigrationsSql);
  const exportBootstrapFn = useServerFn(exportFullBootstrapSql);
  const previewDiffFn = useServerFn(previewSchemaDiff);
  const applyDiffFn = useServerFn(applySchemaDiff);
  const startDiffFn = useServerFn(startSchemaDiffJob);
  const pq = useQuery({ queryKey: ["db-sync-preview"], queryFn: () => previewFn() });
  const diffQ = useQuery({ queryKey: ["db-schema-diff"], queryFn: () => previewDiffFn() });
  const [openConfirm, setOpenConfirm] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [openMigConfirm, setOpenMigConfirm] = useState(false);
  const [migConfirmText, setMigConfirmText] = useState("");
  const [openBootstrap, setOpenBootstrap] = useState(false);
  const [bsEmail, setBsEmail] = useState("");
  const [bsPassword, setBsPassword] = useState("");
  const [bsName, setBsName] = useState("SuperAdmin");
  const [result, setResult] = useState<any>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [errorDetail, setErrorDetail] = useState<{ table: string; detail: string } | null>(null);

  const jq = useQuery({
    queryKey: ["sync-job", jobId],
    queryFn: () => getJobFn({ data: { jobId: jobId! } }),
    enabled: !!jobId,
    refetchInterval: (q) => {
      const s = (q.state.data as any)?.status;
      return s && s !== "running" ? false : 1000;
    },
  });
  const job = jq.data as any;

  const m_run = useMutation({
    mutationFn: async () => {
      const { jobId: newId } = await startFn();
      setJobId(newId);
      setResult(null);
      setOpenConfirm(false);
      setConfirmText("");
      return runFn({ data: { confirm: "SYNC NOW", jobId: newId } });
    },
    onSuccess: (r) => {
      setResult(r);
      if ((r as any).ok) toast.success("Synchronisation abgeschlossen");
      else toast.warning(`Sync mit Fehlern: ${(r as any).failedCount} Tabellen`);
    },
    onError: (e: any) => toast.error(e?.message ?? "Sync fehlgeschlagen"),
  });

  const m_mig = useMutation({
    mutationFn: async () => {
      const { jobId: newId } = await startMigFn();
      setJobId(newId);
      setResult(null);
      setOpenMigConfirm(false);
      setMigConfirmText("");
      return runMigFn({ data: { confirm: "MIGRATE NOW", jobId: newId } });
    },
    onSuccess: (r: any) => {
      if (r.ok) toast.success(`Schema migriert (${r.success} neu, ${r.skipped} übersprungen)`);
      else toast.warning(`Schema-Migration mit ${r.failed} Fehlern abgeschlossen`);
    },
    onError: (e: any) => toast.error(e?.message ?? "Schema-Migration fehlgeschlagen"),
  });

  const m_export = useMutation({
    mutationFn: async () => exportMigFn(),
    onSuccess: (r: any) => {
      const blob = new Blob([r.sql], { type: "text/sql;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = r.filename;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      toast.success(`SQL-Datei mit ${r.count} Migrations heruntergeladen`);
    },
    onError: (e: any) => toast.error(e?.message ?? "Export fehlgeschlagen"),
  });

  const m_diff = useMutation({
    mutationFn: async () => {
      const { jobId: newId } = await startDiffFn();
      setJobId(newId);
      setResult(null);
      return applyDiffFn({ data: { confirm: "STRUCTURE ONLY", jobId: newId } });
    },
    onSuccess: (r: any) => {
      diffQ.refetch();
      if (r.ok) toast.success(`Struktur abgeglichen: ${r.applied} Änderungen angewandt`);
      else toast.warning(`Struktur-Abgleich: ${r.applied} ok, ${r.failed} Fehler`);
    },
    onError: (e: any) => toast.error(e?.message ?? "Struktur-Abgleich fehlgeschlagen"),
  });

  const m_bootstrap = useMutation({
    mutationFn: async () =>
      exportBootstrapFn({
        data: { email: bsEmail.trim(), password: bsPassword, displayName: bsName.trim() || undefined },
      }),
    onSuccess: (r: any) => {
      const blob = new Blob([r.sql], { type: "text/sql;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = r.filename;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      toast.success(`Bootstrap-SQL erstellt (${r.count} Migrations + SuperAdmin ${r.email})`);
      setOpenBootstrap(false);
      setBsPassword("");
    },
    onError: (e: any) => toast.error(e?.message ?? "Bootstrap-Export fehlgeschlagen"),
  });

  const preview = pq.data as any;
  const isRunning = m_run.isPending || job?.status === "running";
  const progress = job?.total_tables
    ? Math.round((job.processed_tables / job.total_tables) * 100)
    : 0;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="size-5" /> Datenbank-Synchronisation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <Alert variant="destructive-soft">
            <ShieldAlert className="size-4" />
            <div className="space-y-1 flex-1">
              <AlertTitleX>Achtung – schreibender Vorgang auf die Zielinstanz</AlertTitleX>
              <AlertDescriptionX>
                Alle Datensätze aus dem <b>public</b>-Schema dieser Instanz werden in die Zielinstanz
                geschrieben. Identische Primärschlüssel werden im Ziel <b>überschrieben</b>
                (UPSERT/merge). Zusätzliche Datensätze, die nur im Ziel existieren, bleiben unberührt.
                <br />
                Auth-Benutzer, Storage-Dateien und das <code>auth</code>/<code>storage</code>-Schema
                werden <b>nicht</b> übertragen.
              </AlertDescriptionX>
            </div>
          </Alert>

          {pq.isLoading && <div className="text-muted-foreground">Lade Konfiguration…</div>}

          {preview && !preview.configured && (
            <Alert>
              <div className="space-y-1 flex-1">
                <AlertTitleX>Keine Zielinstanz konfiguriert</AlertTitleX>
                <AlertDescriptionX>
                  Die Secrets <code>SYNC_TARGET_SUPABASE_URL</code> und{" "}
                  <code>SYNC_TARGET_SERVICE_ROLE_KEY</code> müssen gesetzt sein.
                </AlertDescriptionX>
              </div>
            </Alert>
          )}

          {preview && preview.configured && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="rounded-md border p-3 space-y-1">
                <div className="text-xs text-muted-foreground">Quelle (diese Instanz)</div>
                <div className="font-mono text-xs break-all">{preview.sourceUrl ?? "—"}</div>
              </div>
              <div className="rounded-md border p-3 space-y-1">
                <div className="text-xs text-muted-foreground">Ziel</div>
                <div className="font-mono text-xs break-all">{preview.targetUrl}</div>
                <div className="text-xs">
                  {preview.targetReachable ? (
                    <Badge variant="secondary" className="bg-emerald-500/15 text-emerald-700">
                      erreichbar
                    </Badge>
                  ) : (
                    <Badge variant="destructive">
                      nicht erreichbar{preview.targetError ? ` – ${preview.targetError}` : ""}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          )}

          {preview && preview.configured && (
            <div>
              <div className="text-xs text-muted-foreground mb-1">
                Es werden {preview.tables.length} Tabellen synchronisiert
              </div>
              <div className="flex flex-wrap gap-1">
                {preview.tables.map((t: string) => (
                  <Badge key={t} variant="outline" className="text-[10px] font-mono">
                    {t}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={() => pq.refetch()} disabled={pq.isFetching}>
              <RefreshCw className="size-4 mr-2" /> Status prüfen
            </Button>
            <Button
              variant="secondary"
              disabled={!preview?.configured || isRunning || m_mig.isPending}
              onClick={() => setOpenMigConfirm(true)}
            >
              Schema migrieren
            </Button>
            <Button
              variant="outline"
              disabled={m_export.isPending}
              onClick={() => m_export.mutate()}
              title="Lädt alle Migrations als .sql-Datei – im SQL-Editor der Ziel-Instanz einfügen und ausführen."
            >
              {m_export.isPending ? (
                <><Loader2 className="size-4 mr-2 animate-spin" /> Export…</>
              ) : (
                "Migrations-SQL exportieren"
              )}
            </Button>
            <Button
              variant="outline"
              disabled={m_bootstrap.isPending}
              onClick={() => setOpenBootstrap(true)}
              title="Erzeugt ein komplettes Bootstrap-SQL: alle Migrations + SuperAdmin-Account."
            >
              {m_bootstrap.isPending ? (
                <><Loader2 className="size-4 mr-2 animate-spin" /> Bootstrap…</>
              ) : (
                <><Download className="size-4 mr-2" /> Bootstrap-SQL (Schema + SuperAdmin)</>
              )}
            </Button>
            <Button
              variant="destructive"
              disabled={!preview?.configured || !preview?.targetReachable || isRunning || m_mig.isPending}
              onClick={() => setOpenConfirm(true)}
            >
              Vollständige Synchronisation starten
            </Button>
          </div>
        </CardContent>
      </Card>

      {jobId && job && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {isRunning ? <Loader2 className="size-4 animate-spin" /> : <Activity className="size-4" />}
              Live-Fortschritt
              <Badge
                variant={job.status === "done" ? "secondary" : job.status === "error" ? "destructive" : "outline"}
                className="ml-2"
              >
                {job.status}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span>
                  {job.processed_tables}/{job.total_tables} Tabellen · Pass {job.current_pass}
                  {job.current_table ? ` · läuft: ${job.current_table}` : ""}
                </span>
                <span>{progress}%</span>
              </div>
              <div className="h-2 rounded bg-muted overflow-hidden">
                <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
              </div>
              <div className="grid grid-cols-4 gap-2 text-xs pt-2">
                <div className="rounded border p-2"><span className="text-muted-foreground">Gelesen:</span> <b>{job.total_read}</b></div>
                <div className="rounded border p-2"><span className="text-muted-foreground">Geschrieben:</span> <b>{job.total_written}</b></div>
                <div className="rounded border p-2"><span className="text-muted-foreground">Übersprungen:</span> <b>{(job.tables ?? []).reduce((s: number, t: any) => s + (t.skipped ?? 0), 0)}</b></div>
                <div className="rounded border p-2"><span className="text-muted-foreground">Fehler:</span> <b className={job.failed_count ? "text-destructive" : ""}>{job.failed_count}</b></div>
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold mb-1">Live-Log</div>
              <div className="max-h-72 overflow-auto rounded border bg-muted/30 p-2 font-mono text-[11px] leading-relaxed">
                {(job.logs ?? []).map((l: any, i: number) => (
                  <div key={i} className={
                    l.level === "error" ? "text-destructive" :
                    l.level === "warn" ? "text-amber-600" : "text-foreground/80"
                  }>
                    <span className="text-muted-foreground">{new Date(l.t).toLocaleTimeString("de-DE")}</span>{" "}
                    [{l.level}] {l.msg}
                    {l.extra?.stack && (
                      <pre className="whitespace-pre-wrap pl-4 text-[10px] opacity-75">{String(l.extra.stack).slice(0, 800)}</pre>
                    )}
                  </div>
                ))}
                {(job.logs ?? []).length === 0 && <div className="text-muted-foreground">— noch keine Einträge —</div>}
              </div>
            </div>

            {(job.tables ?? []).length > 0 && (
              <div>
                <div className="text-xs font-semibold mb-1">Tabellen</div>
                <div className="max-h-72 overflow-auto border rounded-md">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50 sticky top-0">
                      <tr>
                        <th className="text-left p-2">Tabelle</th>
                        <th className="text-right p-2">Gelesen</th>
                        <th className="text-right p-2">Geschrieben</th>
                        <th className="text-right p-2">Übersprungen</th>
                        <th className="text-left p-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(job.tables as any[]).map((t) => (
                        <tr key={t.table} className="border-t">
                          <td className="p-2 font-mono">{t.table}</td>
                          <td className="p-2 text-right">{t.read}</td>
                          <td className="p-2 text-right">{t.written}</td>
                          <td className="p-2 text-right">{t.skipped ?? 0}</td>
                          <td className="p-2">
                            {t.error ? (
                              <button
                                className="text-destructive underline text-left"
                                onClick={() => setErrorDetail({ table: t.table, detail: t.errorDetail ?? t.error })}
                              >
                                Fehler – Details
                              </button>
                            ) : (
                              <span className="text-emerald-600">OK</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {result && (
        <Card>
          <CardHeader>
            <CardTitle>Ergebnis</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="rounded-md border p-3">
                <div className="text-xs text-muted-foreground">Dauer</div>
                <div className="text-lg font-semibold">{(result.durationMs / 1000).toFixed(1)}s</div>
              </div>
              <div className="rounded-md border p-3">
                <div className="text-xs text-muted-foreground">Gelesen</div>
                <div className="text-lg font-semibold">{result.totalRead}</div>
              </div>
              <div className="rounded-md border p-3">
                <div className="text-xs text-muted-foreground">Geschrieben</div>
                <div className="text-lg font-semibold">{result.totalWritten}</div>
              </div>
              <div className="rounded-md border p-3">
                <div className="text-xs text-muted-foreground">Übersprungen</div>
                <div className="text-lg font-semibold">{result.totalSkipped ?? 0}</div>
              </div>
              <div className="rounded-md border p-3">
                <div className="text-xs text-muted-foreground">Fehlerhafte Tabellen</div>
                <div className={`text-lg font-semibold ${result.failedCount ? "text-destructive" : "text-emerald-600"}`}>
                  {result.failedCount}
                </div>
              </div>
            </div>
            <div className="max-h-96 overflow-auto border rounded-md">
              <table className="w-full text-xs">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    <th className="text-left p-2">Tabelle</th>
                    <th className="text-right p-2">Gelesen</th>
                    <th className="text-right p-2">Geschrieben</th>
                    <th className="text-right p-2">Übersprungen</th>
                    <th className="text-left p-2">Fehler</th>
                  </tr>
                </thead>
                <tbody>
                  {result.tables.map((t: any) => (
                    <tr key={t.table} className="border-t">
                      <td className="p-2 font-mono">{t.table}</td>
                      <td className="p-2 text-right">{t.read}</td>
                      <td className="p-2 text-right">{t.written}</td>
                      <td className="p-2 text-right">{t.skipped ?? 0}</td>
                      <td className="p-2 text-destructive">{t.error ?? ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={openConfirm} onOpenChange={(o) => { if (!m_run.isPending) setOpenConfirm(o); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Synchronisation bestätigen</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p>
              Damit werden ALLE Datensätze der aktuellen Datenbank in die Zielinstanz
              <br />
              <code className="text-xs">{preview?.targetUrl}</code>
              <br />
              geschrieben. Bestehende Datensätze mit gleicher ID oder fachlichem Schlüssel werden aktualisiert.
              Nicht übertragbare Zeilen, z. B. mit fehlenden Benutzern in der Zielinstanz, werden übersprungen und im Log markiert.
            </p>
            <p>
              Bitte tippe zur Bestätigung: <b className="font-mono">SYNC NOW</b>
            </p>
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="SYNC NOW"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenConfirm(false)} disabled={m_run.isPending}>
              Abbrechen
            </Button>
            <Button
              variant="destructive"
              disabled={confirmText !== "SYNC NOW" || m_run.isPending}
              onClick={() => m_run.mutate()}
            >
              {m_run.isPending ? (
                <><Loader2 className="size-4 mr-2 animate-spin" /> Synchronisiere…</>
              ) : (
                "Jetzt synchronisieren"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!errorDetail} onOpenChange={(o) => { if (!o) setErrorDetail(null); }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Fehlerdetails: {errorDetail?.table}</DialogTitle>
          </DialogHeader>
          <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap text-xs bg-muted/40 p-3 rounded border font-mono">
            {errorDetail?.detail}
          </pre>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              if (errorDetail) navigator.clipboard.writeText(errorDetail.detail);
              toast.success("In Zwischenablage kopiert");
            }}>Kopieren</Button>
            <Button onClick={() => setErrorDetail(null)}>Schließen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={openBootstrap} onOpenChange={(o) => { if (!m_bootstrap.isPending) setOpenBootstrap(o); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bootstrap-SQL (Schema + SuperAdmin)</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              Erstellt ein einzelnes SQL-File, das auf einer <b>frischen Datenbank</b> ausgeführt werden kann:
              alle Migrations werden angewendet und anschließend wird ein SuperAdmin-Account angelegt
              (oder dessen Passwort zurückgesetzt), damit du dich sofort einloggen kannst.
            </p>
            <div className="space-y-1">
              <Label htmlFor="bs-email">E-Mail</Label>
              <Input
                id="bs-email"
                type="email"
                value={bsEmail}
                onChange={(e) => setBsEmail(e.target.value)}
                placeholder="superadmin@example.com"
                autoFocus
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="bs-password">Passwort</Label>
              <Input
                id="bs-password"
                type="text"
                value={bsPassword}
                onChange={(e) => setBsPassword(e.target.value)}
                placeholder="mind. 6 Zeichen"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="bs-name">Anzeigename</Label>
              <Input
                id="bs-name"
                value={bsName}
                onChange={(e) => setBsName(e.target.value)}
                placeholder="SuperAdmin"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenBootstrap(false)} disabled={m_bootstrap.isPending}>
              Abbrechen
            </Button>
            <Button
              disabled={
                m_bootstrap.isPending ||
                !bsEmail.includes("@") ||
                bsPassword.length < 6
              }
              onClick={() => m_bootstrap.mutate()}
            >
              {m_bootstrap.isPending ? (
                <><Loader2 className="size-4 mr-2 animate-spin" /> Erzeuge SQL…</>
              ) : (
                <><Download className="size-4 mr-2" /> SQL herunterladen</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={openMigConfirm} onOpenChange={(o) => { if (!m_mig.isPending) setOpenMigConfirm(o); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schema-Migration bestätigen</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p>
              Alle <b>Migrations-Dateien</b> aus <code>supabase/migrations/</code> werden in der
              Ziel-DB ausgeführt. Bereits angewendete Migrationen werden übersprungen (Tracking in
              <code> public._lovable_migrations</code>). Existierende Objekte werden als angewendet
              markiert – keine Daten gehen verloren.
            </p>
            <p>
              Bitte tippe zur Bestätigung: <b className="font-mono">MIGRATE NOW</b>
            </p>
            <Input
              value={migConfirmText}
              onChange={(e) => setMigConfirmText(e.target.value)}
              placeholder="MIGRATE NOW"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenMigConfirm(false)} disabled={m_mig.isPending}>
              Abbrechen
            </Button>
            <Button
              disabled={migConfirmText !== "MIGRATE NOW" || m_mig.isPending}
              onClick={() => m_mig.mutate()}
            >
              {m_mig.isPending ? (
                <><Loader2 className="size-4 mr-2 animate-spin" /> Migriere…</>
              ) : (
                "Jetzt migrieren"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// kleine lokale Alert-Hilfsstücke (kompatibel ohne extra Imports)
function Alert({ children, variant }: { children: React.ReactNode; variant?: "destructive-soft" }) {
  const cls =
    variant === "destructive-soft"
      ? "border border-destructive/40 bg-destructive/5 text-foreground"
      : "border border-border bg-muted/40 text-foreground";
  return <div className={`rounded-md p-3 text-sm flex gap-2 items-start ${cls}`}>{children}</div>;
}
function AlertTitleX({ children }: { children: React.ReactNode }) {
  return <div className="font-semibold mb-0.5">{children}</div>;
}
function AlertDescriptionX({ children }: { children: React.ReactNode }) {
  return <div className="text-sm text-muted-foreground [&_b]:text-foreground">{children}</div>;
}

function DataPurgeRequestsPanel() {
  const qc = useQueryClient();
  const listFn = useServerFn(listPendingPurgeRequests);
  const decideFn = useServerFn(decidePurgeRequest);
  const lq = useQuery({ queryKey: ["sa-purge-requests"], queryFn: () => listFn(), refetchInterval: 60_000 });
  const requests = (lq.data?.requests ?? []) as any[];

  const m_decide = useMutation({
    mutationFn: (v: { id: string; decision: "approve" | "reject" }) => decideFn({ data: v }),
    onSuccess: (_d, v) => {
      toast.success(v.decision === "approve" ? "Antrag freigegeben — Daten gelöscht." : "Antrag abgelehnt.");
      qc.invalidateQueries({ queryKey: ["sa-purge-requests"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Fehler"),
  });

  const STATUS_LABEL: Record<string, string> = {
    pending: "Wartet", approved: "Freigegeben", rejected: "Abgelehnt", completed: "Ausgeführt",
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Trash2 className="size-4" />Datenlöschungs-Anträge</CardTitle>
      </CardHeader>
      <CardContent>
        {lq.isLoading ? (
          <div className="text-sm text-muted-foreground">Lädt …</div>
        ) : requests.length === 0 ? (
          <div className="text-sm text-muted-foreground py-6 text-center">Keine Anträge.</div>
        ) : (
          <div className="divide-y">
            {requests.map((r) => (
              <div key={r.id} className="py-3 flex items-center gap-3 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">
                    {r.domain?.name ?? "—"} <span className="text-xs text-muted-foreground">({r.domain?.slug ?? "?"})</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Scope: {r.scope} · von {r.requested_by_name ?? r.requested_by} · {new Date(r.requested_at).toLocaleString("de-DE")}
                  </div>
                  {r.note && <div className="text-xs italic text-muted-foreground">„{r.note}"</div>}
                  {r.affected_count != null && (
                    <div className="text-xs text-muted-foreground">{r.affected_count} Dateien betroffen</div>
                  )}
                </div>
                <Badge variant="outline">{STATUS_LABEL[r.status] ?? r.status}</Badge>
                {r.status === "pending" && (
                  <>
                    <Button size="sm" variant="outline"
                      onClick={() => { if (confirm("Antrag ablehnen?")) m_decide.mutate({ id: r.id, decision: "reject" }); }}>
                      Ablehnen
                    </Button>
                    <Button size="sm" variant="destructive"
                      onClick={() => {
                        if (confirm(`Alle Dateien der Domäne „${r.domain?.name ?? ""}" UNWIDERRUFLICH löschen?`)) {
                          m_decide.mutate({ id: r.id, decision: "approve" });
                        }
                      }}>
                      Freigeben & löschen
                    </Button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
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
    { value: "intervention", label: "Intervention" },
  ]},
  { label: "Betrieb", items: [
    { value: "health", label: "Health" },
    { value: "emails", label: "E-Mails" },
    { value: "audit", label: "Audit-Log" },
    { value: "tickets", label: "Support-Tickets" },
  ]},
  { label: "Plattform", items: [
    { value: "system", label: "System" },
    { value: "platform-email", label: "E-Mail-Versand" },
    { value: "selfhost", label: "Self-Hosting" },
    { value: "dbsync", label: "DB-Sync" },
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
  const openTicketsFn = useServerFn(getOpenTicketsCount);
  const otq = useQuery({ queryKey: ["sa-open-tickets"], queryFn: () => openTicketsFn(), refetchInterval: 60_000 });

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
    <div className="p-6 space-y-6 max-w-screen-2xl mx-auto">
      <div className="rounded-md bg-card text-card-foreground px-6 py-5 border">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="size-12 rounded-md bg-primary text-primary-foreground flex items-center justify-center">
              <Crown className="size-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary-foreground px-2 py-0.5 rounded bg-primary">SuperAdmin</span>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Plattform-Konsole</span>
              </div>
              <h1 className="text-lg font-semibold leading-tight mt-1">Mandanten · Lizenzen · Module · Nutzer · Betrieb</h1>
            </div>
          </div>
          {imp && (
            <div className="flex items-center gap-3 px-3 py-1.5 rounded-md bg-warning/15 border border-warning/40">
              <span className="text-xs">Impersonation: <b>{imp.name}</b></span>
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
                <SideTab value="intervention" icon={Network}>Intervention</SideTab>
                <SideSection label="Betrieb" />
                <SideTab value="health" icon={Activity}>Health</SideTab>
                <SideTab value="emails" icon={Mail}>E-Mails</SideTab>
                <SideTab value="audit" icon={BarChart3}>Audit-Log</SideTab>
                <SideTab value="tickets" icon={LifeBuoy}>Support-Tickets</SideTab>
                <SideSection label="Plattform" />
                <SideTab value="system" icon={RefreshCw}>System</SideTab>
                <SideTab value="platform-email" icon={Mail}>E-Mail-Versand</SideTab>
                <SideTab value="selfhost" icon={Building2}>Self-Hosting</SideTab>
                <SideTab value="dbsync" icon={Upload}>DB-Sync</SideTab>
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
                  <Button size="sm" variant="outline" onClick={() => setTab("tickets")}>
                    <LifeBuoy className="size-4 mr-1.5" />
                    Tickets {otq.data?.count ? <span className="ml-1.5 rounded bg-destructive text-destructive-foreground px-1.5 text-[10px]">{otq.data.count}</span> : null}
                  </Button>
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
                    <ImpersonateDialog domain={d} onDone={() => { invalidateAll(); }} />
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

        <TabsContent value="dbsync" className="space-y-4">
          <DbSyncPanel />
        </TabsContent>

        <TabsContent value="health" className="space-y-4">
          <HealthPanel />
        </TabsContent>

        <TabsContent value="platform-email" className="space-y-4">
          <PlatformEmailPanel />
        </TabsContent>

        <TabsContent value="emails" className="space-y-4">
          <EmailQueuePanel />
        </TabsContent>

        <TabsContent value="audit" className="space-y-4">
          <AuditLogPanel />
        </TabsContent>

        <TabsContent value="tickets" className="space-y-4">
          <SupportTicketsPanel />
          <DataPurgeRequestsPanel />
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

        <TabsContent value="intervention" className="space-y-4">
          <InterventionAllowlistPanel />
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
type LicenseEditPayload = LicensePayload & { domain_id?: string; status?: "active" | "revoked" | "expired" };

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

function EditLicenseDialog({
  license, domains, onClose, onSave,
}: {
  license: any | null;
  domains: any[];
  onClose: () => void;
  onSave: (patch: Partial<LicenseEditPayload>) => Promise<void>;
}) {
  const [domainId, setDomainId] = useState<string>("");
  const [status, setStatus] = useState<"active" | "revoked" | "expired">("active");
  const [date, setDate] = useState("");
  const [maxUsers, setMaxUsers] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  // Reset form when a new license is opened
  useEffect(() => {
    if (license) {
      setDomainId(license.domain_id ?? "");
      setStatus((license.status as any) ?? "active");
      setDate(isoToDateInput(license.valid_until));
      setMaxUsers(license.max_users != null ? String(license.max_users) : "");
      setNotes(license.notes ?? "");
    }
  }, [license?.id]);

  const open = !!license;
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Lizenz bearbeiten</DialogTitle>
        </DialogHeader>
        {license && (
          <div className="space-y-3">
            <div className="text-xs text-muted-foreground">
              Key: <code className="bg-muted px-1.5 py-0.5 rounded">{license.license_key}</code>
            </div>
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
                <Label className="text-xs">Status</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Aktiv</SelectItem>
                    <SelectItem value="revoked">Widerrufen</SelectItem>
                    <SelectItem value="expired">Abgelaufen</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Gültig bis</Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
            </div>
            <div>
              <Label className="text-xs">Max. Nutzer</Label>
              <Input type="number" min={1} value={maxUsers} onChange={(e) => setMaxUsers(e.target.value)} placeholder="∞ (unbegrenzt)" />
            </div>
            <div>
              <Label className="text-xs">Notiz</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="optional" rows={3} />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Abbrechen</Button>
          <Button disabled={busy || !domainId} onClick={async () => {
            setBusy(true);
            try {
              await onSave({
                domain_id: domainId,
                status,
                valid_until: toIsoOrNull(date),
                max_users: maxUsers ? Number(maxUsers) : null,
                notes: notes || null,
              });
            } catch (e: any) { toast.error(e?.message ?? "Fehler"); }
            finally { setBusy(false); }
          }}>Speichern</Button>
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
  onUpdate: (id: string, p: Partial<LicenseEditPayload>) => Promise<void>;
  onRevoke: (id: string) => Promise<void>;
  onExtend: (ids: string[], days: number) => Promise<void>;
  onExpiryRun: () => Promise<void>;
}) {
  const [domainFilter, setDomainFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [onlyExpiring, setOnlyExpiring] = useState(false);
  const [editLic, setEditLic] = useState<any | null>(null);

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
                    <div className="flex justify-end gap-1">
                      {l.status === "active" && (
                        <Button size="sm" variant="ghost" onClick={() => onRevoke(l.id)}>Widerrufen</Button>
                      )}
                      <Button size="sm" variant="outline" onClick={() => setEditLic(l)}>Bearbeiten</Button>
                    </div>
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

      <EditLicenseDialog
        license={editLic}
        domains={domains}
        onClose={() => setEditLic(null)}
        onSave={async (patch) => {
          if (!editLic) return;
          await onUpdate(editLic.id, patch);
          setEditLic(null);
        }}
      />
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

  const isEnabled = (key: string) =>
    dmodules.find((x) => x.domain_id === domainId && x.module_key === key)?.enabled ?? false;

  if (domains.length === 0) return <div className="text-sm text-muted-foreground p-4">Keine Mandanten vorhanden.</div>;

  const activeCount = modules.filter((m) => isEnabled(m.key)).length;

  const setAll = async (val: boolean) => {
    for (const m of modules) {
      const current = isEnabled(m.key);
      if (current !== val) await onToggle(domainId, m.key, val);
    }
  };

  return (
    <div className="space-y-4">
      {/* Toolbar: Mandant + Suche + Aktionen */}
      <Card>
        <CardContent className="p-3 flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 min-w-[260px]">
            <Label className="text-sm font-medium whitespace-nowrap">Mandant</Label>
            <Select value={domainId} onValueChange={setDomainId}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Mandant wählen…" /></SelectTrigger>
              <SelectContent>
                {domains.map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Modul suchen…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <span className="text-sm text-muted-foreground tabular-nums whitespace-nowrap">
            {activeCount} / {modules.length} aktiv
          </span>
          <Button size="sm" variant="outline" onClick={() => setAll(true)}>Alle an</Button>
          <Button size="sm" variant="outline" onClick={() => setAll(false)}>Alle aus</Button>
        </CardContent>
      </Card>

      {/* Modul-Liste */}
      <Card className="overflow-hidden">
        <div className="divide-y">
          {visibleParents.length === 0 && (
            <div className="p-8 text-center text-sm text-muted-foreground">Keine Treffer.</div>
          )}
          {visibleParents.map((p) => {
            const parentOn = isEnabled(p.key);
            const kids = childrenOf(p.key).filter(matches);
            return (
              <div key={p.id}>
                {/* Parent row */}
                <div className="flex items-center justify-between gap-4 px-4 py-3 bg-muted/30">
                  <div className="min-w-0">
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs text-muted-foreground font-mono">{p.key}</div>
                  </div>
                  <Switch
                    checked={parentOn}
                    onCheckedChange={(v) => onToggle(domainId, p.key, v)}
                  />
                </div>
                {/* Children rows */}
                {kids.length > 0 && (
                  <div className="divide-y">
                    {kids.map((c) => {
                      const on = isEnabled(c.key);
                      return (
                        <div
                          key={c.id}
                          className={`flex items-center justify-between gap-4 pl-10 pr-4 py-2.5 ${!parentOn ? "opacity-50" : ""}`}
                        >
                          <div className="min-w-0">
                            <div className="text-sm">{c.name}</div>
                            <div className="text-[11px] text-muted-foreground font-mono">{c.key}</div>
                          </div>
                          <Switch
                            checked={on && parentOn}
                            disabled={!parentOn}
                            onCheckedChange={(v) => onToggle(domainId, c.key, v)}
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

function ImpersonateDialog({ domain, onDone }: { domain: any; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const startPin = useServerFn(startImpersonationWithPin);
  const startForce = useServerFn(startImpersonation);
  const handlePin = async () => {
    setBusy(true);
    try {
      await startPin({ data: { domain_id: domain.id, pin } });
      toast.success("Verbunden via Support-PIN");
      setOpen(false); setPin(""); onDone();
    } catch (e: any) { toast.error(e?.message ?? "Fehler"); }
    finally { setBusy(false); }
  };
  const handleForce = async () => {
    if (!confirm("Zwangsverbindung wird dem Domänen-Admin angezeigt. Fortfahren?")) return;
    setBusy(true);
    try {
      await startForce({ data: { domain_id: domain.id, reason: reason || undefined } });
      toast.success("Zwangsverbindung gestartet");
      setOpen(false); setReason(""); onDone();
    } catch (e: any) { toast.error(e?.message ?? "Fehler"); }
    finally { setBusy(false); }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">Als Domain-Admin</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Verbinden mit „{domain.name}"</DialogTitle>
        </DialogHeader>
        <div className="space-y-5">
          <div className="space-y-2">
            <Label>Support-PIN (vom Domänen-Admin)</Label>
            <Input
              inputMode="numeric"
              maxLength={6}
              placeholder="6-stelliger PIN"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
            />
            <Button className="w-full" disabled={pin.length !== 6 || busy} onClick={handlePin}>
              Mit PIN verbinden
            </Button>
          </div>
          <div className="border-t pt-4 space-y-2">
            <Label className="text-destructive flex items-center gap-2">
              <ShieldAlert className="size-4" /> Zwangsverbindung
            </Label>
            <p className="text-xs text-muted-foreground">
              Wird dem Domänen-Admin sichtbar angezeigt. Nur im Notfall verwenden.
            </p>
            <Textarea
              placeholder="Grund (optional, wird dem Admin angezeigt)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
            />
            <Button variant="destructive" className="w-full" disabled={busy} onClick={handleForce}>
              Zwangsverbindung starten
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function InterventionAllowlistPanel() {
  const listFn = useServerFn(saListInterventionAllowlist);
  const setFn = useServerFn(saSetInterventionAllowlist);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["sa-intervention-allowlist"], queryFn: () => listFn() });
  const [selectedDomain, setSelectedDomain] = useState<string>("");
  const [draft, setDraft] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState("");

  const domains: Array<{ id: string; name: string }> = (q.data?.domains ?? []) as any;
  const rows: Array<{ domain_id: string; partner_domain_id: string }> = (q.data?.rows ?? []) as any;

  useEffect(() => {
    if (!selectedDomain) return;
    const current = new Set(rows.filter((r) => r.domain_id === selectedDomain).map((r) => r.partner_domain_id));
    setDraft(current);
  }, [selectedDomain, q.data]);

  const countsByDomain = useMemo(() => {
    const m = new Map<string, number>();
    rows.forEach((r) => m.set(r.domain_id, (m.get(r.domain_id) ?? 0) + 1));
    return m;
  }, [rows]);

  const toggle = (id: string) => {
    setDraft((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  async function save() {
    if (!selectedDomain) return;
    setBusy(true);
    try {
      await setFn({ data: { domain_id: selectedDomain, partner_domain_ids: [...draft] } });
      toast.success("Gespeichert");
      qc.invalidateQueries({ queryKey: ["sa-intervention-allowlist"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Fehler");
    } finally { setBusy(false); }
  }

  const candidates = domains
    .filter((d) => d.id !== selectedDomain)
    .filter((d) => !filter || d.name.toLowerCase().includes(filter.toLowerCase()));

  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2"><Network className="size-5 text-primary" /> Intervention — erlaubte Partner pro Domain</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Lege fest, welche anderen Domains eine Domain als Interventionspartner auswählen darf. Nur freigegebene Domains erscheinen dort in der Auswahl.
            </p>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
          <div className="rounded-lg border border-border overflow-hidden">
            <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground bg-muted/40">Domain wählen</div>
            <div className="max-h-[480px] overflow-auto">
              {domains.map((d) => (
                <button
                  key={d.id}
                  onClick={() => setSelectedDomain(d.id)}
                  className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between gap-2 border-b border-border ${selectedDomain === d.id ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted/40"}`}
                >
                  <span className="truncate">{d.name}</span>
                  <span className="text-[10px] tabular-nums text-muted-foreground">{countsByDomain.get(d.id) ?? 0}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-border p-4 space-y-3">
            {!selectedDomain ? (
              <div className="text-sm text-muted-foreground">Bitte links eine Domain wählen.</div>
            ) : (
              <>
                <div className="flex items-center gap-2 flex-wrap">
                  <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Partner suchen…" className="max-w-xs" />
                  <div className="text-xs text-muted-foreground">{draft.size} ausgewählt</div>
                  <div className="ml-auto flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setDraft(new Set(candidates.map((c) => c.id)))}>Alle</Button>
                    <Button size="sm" variant="outline" onClick={() => setDraft(new Set())}>Keine</Button>
                    <Button size="sm" onClick={save} disabled={busy}>Speichern</Button>
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-1 max-h-[440px] overflow-auto">
                  {candidates.map((d) => {
                    const checked = draft.has(d.id);
                    return (
                      <label key={d.id} className={`flex items-center gap-2 px-3 py-1.5 rounded-md border cursor-pointer ${checked ? "border-primary/40 bg-primary/5" : "border-border hover:bg-muted/40"}`}>
                        <input type="checkbox" checked={checked} onChange={() => toggle(d.id)} />
                        <span className="text-sm truncate">{d.name}</span>
                      </label>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

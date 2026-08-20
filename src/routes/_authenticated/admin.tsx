import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Users, ShieldCheck, FileText, Siren, Tag, Plus, Pencil, Trash2,
  KeyRound, Search, Shield, Truck, Radio, Lock, LogIn, Settings as SettingsIcon,
  Boxes, CheckCircle2, GraduationCap,
  LifeBuoy, RefreshCw, Eye, EyeOff, Copy as CopyIcon, ShieldAlert, Download,
} from "lucide-react";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useRole } from "@/hooks/use-role";
import { useAuth } from "@/hooks/use-auth";
import { SystemSettingsPanel } from "@/components/admin/system-settings-panel";
import { TourAdminPanel } from "@/components/admin/tour-admin-panel";
import { EmailSettingsPanel } from "@/components/admin/email-settings-panel";
import { EmailBrandingPanel } from "@/components/admin/email-branding-panel";
import { SchluesselFooterPanel } from "@/components/admin/schluessel-footer-panel";
import { SupportPanel } from "@/routes/_authenticated/support";
import {
  adminStats, listUsers, createUser, setUserRole, updateUserProfile,
  resetUserPassword, deleteUser, impersonateUser,
  listAllGruende, upsertGrund, deleteGrund,
  getSupportPin, regenerateSupportPin, getForcedImpersonation,
  setUserEinsatzSelectable,
} from "@/lib/admin.functions";
import {
  requestDataPurge, listMyPurgeRequests, cancelPurgeRequest,
  listPendingSuperadminPurgeRequests, confirmSuperadminPurgeRequest,
} from "@/lib/data-purge.functions";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminPage,
});

type AppRole = "admin" | "dispatcher" | "fahrer";

const ROLE_META: Record<AppRole, { label: string; cls: string; icon: any }> = {
  admin:      { label: "Administrator", cls: "bg-red-500/15 text-red-400 border border-red-500/30", icon: Shield },
  dispatcher: { label: "Dispatcher",    cls: "bg-cyan-500/15 text-cyan-400 border border-cyan-500/30", icon: Radio },
  fahrer:     { label: "Fahrer",        cls: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30", icon: Truck },
};

function fmt(d?: string | null) {
  if (!d) return "–";
  return new Date(d).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function AdminPage() {
  const { isAdmin, loading } = useRole();

  if (loading) {
    return <div className="p-6 lg:p-8 text-sm text-muted-foreground">Lade…</div>;
  }
  if (!isAdmin) {
    return (
      <div className="p-6 lg:p-8">
        <div className="rounded-xl border border-border bg-card p-12 text-center" style={{ boxShadow: "var(--shadow-card)" }}>
          <div className="mx-auto size-14 rounded-full bg-muted grid place-items-center">
            <Lock className="size-6 text-muted-foreground" />
          </div>
          <h2 className="mt-4 text-lg font-semibold">Kein Zugriff</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Das Admin Center steht nur Administratoren zur Verfügung.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <header>
        <h1 className="text-3xl font-bold">Admin Center</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Benutzer- und Rollenverwaltung, Stammdaten und System-Übersicht.
        </p>
      </header>

      <StatsCards />

      <ForcedImpersonationAlert />
      <SupportPinCard />

      <Tabs defaultValue="users" className="space-y-4">
        <TabsList>
          <TabsTrigger value="users"><Users className="size-4 mr-2" />Benutzer</TabsTrigger>
          <TabsTrigger value="gruende"><Tag className="size-4 mr-2" />Einsatzgründe</TabsTrigger>
          <TabsTrigger value="modules"><Boxes className="size-4 mr-2" />Module</TabsTrigger>
          <TabsTrigger value="tour"><GraduationCap className="size-4 mr-2" />Einführung</TabsTrigger>
          <TabsTrigger value="system"><SettingsIcon className="size-4 mr-2" />System</TabsTrigger>
          <TabsTrigger value="email"><Mail className="size-4 mr-2" />E-Mail</TabsTrigger>
          <TabsTrigger value="schluessel"><KeyRound className="size-4 mr-2" />Schlüsselübergabe</TabsTrigger>
          <TabsTrigger value="datenloeschung"><Trash2 className="size-4 mr-2" />Datenlöschung</TabsTrigger>
          <TabsTrigger value="hilfe"><LifeBuoy className="size-4 mr-2" />Hilfe</TabsTrigger>
        </TabsList>

        <TabsContent value="users"><UsersPanel /></TabsContent>
        <TabsContent value="gruende"><GruendePanel /></TabsContent>
        <TabsContent value="modules"><ModulesPanel /></TabsContent>
        <TabsContent value="tour"><TourAdminPanel /></TabsContent>
        <TabsContent value="system"><SystemSettingsPanel /></TabsContent>
          <TabsContent value="email">
            <div className="space-y-6">
              <EmailSettingsPanel />
              <EmailBrandingPanel />
            </div>
          </TabsContent>
        <TabsContent value="schluessel"><SchluesselFooterPanel /></TabsContent>
        <TabsContent value="datenloeschung"><DatenLoeschungPanel /></TabsContent>
        <TabsContent value="hilfe"><SupportPanel /></TabsContent>
      </Tabs>
    </div>
  );
}

// ---------------- Datenlöschung (Datei-Verwaltung) ----------------

function SuperadminPurgeConfirmPanel() {
  const qc = useQueryClient();
  const listFn = useServerFn(listPendingSuperadminPurgeRequests);
  const confirmFn = useServerFn(confirmSuperadminPurgeRequest);
  const lq = useQuery({
    queryKey: ["admin-sa-purge-requests"],
    queryFn: () => listFn(),
    refetchInterval: 60_000,
  });
  const requests = (lq.data?.requests ?? []) as any[];
  const pending = requests.filter((r) => r.status === "pending");

  const m_confirm = useMutation({
    mutationFn: (v: { id: string; decision: "approve" | "reject" }) => confirmFn({ data: v }),
    onSuccess: (_d, v) => {
      toast.success(v.decision === "approve" ? "Daten wurden endgültig gelöscht." : "Antrag abgelehnt.");
      qc.invalidateQueries({ queryKey: ["admin-sa-purge-requests"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Fehler"),
  });

  if (pending.length === 0) return null;

  return (
    <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-5 space-y-3">
      <div className="flex items-center gap-2">
        <ShieldAlert className="size-5 text-amber-500" />
        <div className="font-semibold">Bestätigung erforderlich – Löschanträge vom SuperAdmin</div>
      </div>
      <p className="text-sm text-muted-foreground">
        Der SuperAdmin hat das endgültige Löschen der folgenden Tabellendaten beantragt.
        Nach Ihrer Freigabe werden die Datensätze <b>unwiderruflich</b> entfernt.
      </p>
      <div className="divide-y">
        {pending.map((r) => (
          <div key={r.id} className="py-3 flex items-center gap-3 flex-wrap">
            <div className="min-w-0 flex-1">
              <div className="font-medium">Tabelle: <span className="font-mono">{r.target_table}</span></div>
              <div className="text-xs text-muted-foreground">
                Beantragt am {new Date(r.requested_at).toLocaleString("de-DE")}
              </div>
              {r.note && <div className="text-xs italic text-muted-foreground">„{r.note}"</div>}
            </div>
            <Button size="sm" variant="outline"
              onClick={() => { if (confirm("Antrag ablehnen?")) m_confirm.mutate({ id: r.id, decision: "reject" }); }}>
              Ablehnen
            </Button>
            <Button size="sm" variant="destructive"
              onClick={() => {
                if (confirm(`ALLE Datensätze der Tabelle „${r.target_table}" endgültig löschen? Diese Aktion ist unwiderruflich.`)) {
                  m_confirm.mutate({ id: r.id, decision: "approve" });
                }
              }}>
              <Trash2 className="size-4 mr-2" /> Endgültig löschen
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

function DatenLoeschungPanel() {
  const qc = useQueryClient();
  const listFn = useServerFn(listMyPurgeRequests);
  const reqFn = useServerFn(requestDataPurge);
  const cancelFn = useServerFn(cancelPurgeRequest);

  const lq = useQuery({ queryKey: ["my-purge-requests"], queryFn: () => listFn() });
  const requests = lq.data?.requests ?? [];
  const pending = requests.find((r: any) => r.status === "pending");

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [note, setNote] = useState("");

  const m_request = useMutation({
    mutationFn: () => reqFn({ data: { note: note || null } }),
    onSuccess: () => {
      toast.success("Antrag zur Löschung gestellt — wartet auf Bestätigung durch den SuperAdmin.");
      setConfirmOpen(false); setConfirmText(""); setNote("");
      qc.invalidateQueries({ queryKey: ["my-purge-requests"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Fehler"),
  });

  const m_cancel = useMutation({
    mutationFn: (id: string) => cancelFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Antrag zurückgezogen");
      qc.invalidateQueries({ queryKey: ["my-purge-requests"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Fehler"),
  });

  const STATUS_LABEL: Record<string, string> = {
     pending: "Wartet auf Bestätigung",
     approved: "Freigegeben",
     rejected: "Abgelehnt",
     completed: "Ausgeführt",
  };
  const STATUS_CLS: Record<string, string> = {
    pending: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    approved: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
    rejected: "bg-muted text-muted-foreground border-border",
    completed: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  };

  return (
    <div className="space-y-6">
      <SuperadminPurgeConfirmPanel />
      <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-5 space-y-3">
        <div className="flex items-start gap-3">
          <div className="size-10 rounded-lg bg-destructive/15 grid place-items-center shrink-0">
            <ShieldAlert className="size-5 text-destructive" />
          </div>
          <div className="space-y-1">
            <div className="font-semibold">Alle Daten der Datei-Verwaltung löschen</div>
            <p className="text-sm text-muted-foreground">
              Löscht <b>unwiderruflich</b> alle Dateien dieser Domäne aus der Datei-Verwaltung
              (inkl. zugehöriger Verknüpfungen, Historie und Storage-Dateien).
              Die Aktion muss vom SuperAdmin bestätigt werden.
            </p>
          </div>
        </div>
        <div className="flex justify-end">
          <Button
            variant="destructive"
            disabled={!!pending || lq.isLoading}
            onClick={() => setConfirmOpen(true)}
          >
            <Trash2 className="size-4 mr-2" /> Löschung beantragen
          </Button>
        </div>
        {pending && (
          <div className="text-xs text-amber-400">
            Es ist bereits ein Antrag offen ({fmt(pending.requested_at)}).
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card p-5 space-y-3" style={{ boxShadow: "var(--shadow-card)" }}>
        <div className="font-semibold">Verlauf</div>
        {lq.isLoading ? (
          <div className="text-sm text-muted-foreground">Lade …</div>
        ) : requests.length === 0 ? (
          <div className="text-sm text-muted-foreground py-6 text-center">Noch keine Anträge.</div>
        ) : (
          <div className="divide-y">
            {requests.map((r: any) => (
              <div key={r.id} className="py-3 flex items-center gap-3 flex-wrap">
                <Badge variant="outline" className={STATUS_CLS[r.status]}>{STATUS_LABEL[r.status] ?? r.status}</Badge>
                <div className="text-sm min-w-0">
                  <div className="truncate">
                    Beantragt: <span className="text-muted-foreground">{fmt(r.requested_at)}</span>
                  </div>
                  {r.decided_at && (
                    <div className="text-xs text-muted-foreground">
                      Entscheidung: {fmt(r.decided_at)}{r.affected_count != null ? ` — ${r.affected_count} Dateien` : ""}
                    </div>
                  )}
                  {r.note && <div className="text-xs text-muted-foreground italic">„{r.note}"</div>}
                </div>
                {r.status === "pending" && (
                  <Button size="sm" variant="outline" className="ml-auto"
                    onClick={() => { if (confirm("Antrag zurückziehen?")) m_cancel.mutate(r.id); }}>
                    Zurückziehen
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Löschung aller Datei-Verwaltungs-Daten beantragen</AlertDialogTitle>
            <AlertDialogDescription>
              Diese Aktion entfernt nach Bestätigung durch den SuperAdmin <b>alle</b> Dateien dieser
              Domäne unwiderruflich. Bitte tippe zur Bestätigung <b>LÖSCHEN</b> ein.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Bestätigung</Label>
              <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="LÖSCHEN" />
            </div>
            <div className="space-y-1.5">
              <Label>Notiz (optional)</Label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Grund / Hinweis für den SuperAdmin" />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              disabled={confirmText.trim() !== "LÖSCHEN" || m_request.isPending}
              onClick={(e) => { e.preventDefault(); m_request.mutate(); }}
            >
              Antrag stellen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ---------------- Module (read-only) ----------------

function ModulesPanel() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-enabled-modules"],
    queryFn: async () => {
      const [mods, dmods] = await Promise.all([
        supabase.from("app_modules").select("key,name,beschreibung,sort_order,parent_key").order("sort_order").order("name"),
        supabase.from("domain_modules").select("module_key,enabled"),
      ]);
      if (mods.error) throw mods.error;
      if (dmods.error) throw dmods.error;
      const enabledSet = new Set((dmods.data ?? []).filter((m: any) => m.enabled).map((m: any) => m.module_key));
      // A sub-module is only effectively enabled if its parent is also enabled
      return (mods.data ?? []).filter((m: any) => {
        if (!enabledSet.has(m.key)) return false;
        if (m.parent_key && !enabledSet.has(m.parent_key)) return false;
        return true;
      });
    },
  });

  if (isLoading) return <div className="text-sm text-muted-foreground">Lade…</div>;
  const list = data ?? [];

  return (
    <div className="rounded-xl border border-border bg-card p-5" style={{ boxShadow: "var(--shadow-card)" }}>
      <div className="flex items-center gap-2 mb-4">
        <Boxes className="size-4 text-primary" />
        <h3 className="font-semibold">Aktivierte Module</h3>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Übersicht der für diese Domäne freigeschalteten Module. Aktivierung erfolgt durch den SuperAdmin.
      </p>
      {list.length === 0 ? (
        <div className="text-sm text-muted-foreground py-6 text-center">Keine Module aktiviert.</div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {list.map((m: any) => (
            <div key={m.key} className={`rounded-lg border border-border bg-background p-4 ${m.parent_key ? "ml-4 border-l-2 border-l-primary/40" : ""}`}>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
                <div className="font-medium text-sm truncate">
                  {m.parent_key && <span className="text-muted-foreground mr-1">└</span>}
                  {m.name}
                </div>
              </div>
              {m.beschreibung && (
                <p className="text-xs text-muted-foreground mt-1.5">{m.beschreibung}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------- Stats ----------------

function StatCard({ icon: Icon, label, value, hint }: { icon: any; label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5" style={{ boxShadow: "var(--shadow-card)" }}>
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
        <Icon className="size-4 text-muted-foreground" />
      </div>
      <div className="mt-2 text-2xl font-bold">{value}</div>
      {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
    </div>
  );
}

function StatsCards() {
  const fetchStats = useServerFn(adminStats);
  const { data } = useQuery({ queryKey: ["admin-stats"], queryFn: () => fetchStats() });

  const roleHint = data
    ? `${data.byRole.admin ?? 0} Admin · ${data.byRole.dispatcher ?? 0} Dispatcher · ${data.byRole.fahrer ?? 0} Fahrer`
    : undefined;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard icon={Users}      label="Benutzer"        value={data?.totalUsers ?? "–"} hint={roleHint} />
      <StatCard icon={Siren}      label="Einsätze gesamt" value={data?.einsaetzeTotal ?? "–"}
        hint={data ? `${data.einsaetzeByStatus.in_bearbeitung ?? 0} laufend` : undefined} />
      <StatCard icon={FileText}   label="Dateien"         value={data?.dateienCount ?? "–"} />
      <StatCard icon={Tag}        label="Einsatzgründe"   value={data?.gruendeCount ?? "–"} />
    </div>
  );
}

// ---------------- Users ----------------

function UsersPanel() {
  const qc = useQueryClient();
  const { user: me } = useAuth();
  const fetchUsers = useServerFn(listUsers);
  const impersonate = useServerFn(impersonateUser);
  const setSelectable = useServerFn(setUserEinsatzSelectable);
  const navigate = useNavigate();
  const [impBusy, setImpBusy] = useState<string | null>(null);
  const { data, isLoading } = useQuery({ queryKey: ["admin-users"], queryFn: () => fetchUsers() });

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | AppRole>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<any | null>(null);
  const [pwUser, setPwUser] = useState<any | null>(null);
  const [delUser, setDelUser] = useState<any | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = data?.users ?? [];
    return list.filter((u: any) => {
      const role = (u.roles?.[0] as AppRole) ?? "fahrer";
      if (roleFilter !== "all" && role !== roleFilter) return false;
      if (!q) return true;
      return (
        (u.email ?? "").toLowerCase().includes(q) ||
        (u.display_name ?? "").toLowerCase().includes(q)
      );
    });
  }, [data, search, roleFilter]);

  const exportCsv = () => {
    const rows = filtered.map((u: any) => ({
      name: u.display_name ?? "",
      email: u.email ?? "",
      rolle: (u.roles?.[0] as string) ?? "fahrer",
      erstellt_am: u.created_at ?? "",
      letzter_login: u.last_sign_in_at ?? "",
      einsatz_auswaehlbar: u.einsatz_selectable ? "ja" : "nein",
    }));
    const headers = ["name", "email", "rolle", "erstellt_am", "letzter_login", "einsatz_auswaehlbar"];
    const esc = (v: any) => {
      const s = String(v ?? "");
      return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [headers.join(";"), ...rows.map((r) => headers.map((h) => esc((r as any)[h])).join(";"))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const suffix = roleFilter === "all" ? "alle" : roleFilter;
    a.href = url;
    a.download = `benutzer_${suffix}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success(`${rows.length} Benutzer exportiert`);
  };

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin-users"] });
    qc.invalidateQueries({ queryKey: ["admin-stats"] });
  };

  const selectableMut = useMutation({
    mutationFn: (v: { user_id: string; selectable: boolean }) => setSelectable({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      qc.invalidateQueries({ queryKey: ["fahrer"] });
      toast.success("Auswahl-Status aktualisiert");
    },
    onError: (e: any) => toast.error(e?.message ?? "Fehler"),
  });

  return (
    <div className="rounded-xl border border-border bg-card" style={{ boxShadow: "var(--shadow-card)" }}>
      <div className="p-4 flex flex-col sm:flex-row gap-3 sm:items-center border-b border-border">
        <div className="relative flex-1">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Suchen nach Name oder E-Mail…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as any)}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Rolle" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Rollen</SelectItem>
            <SelectItem value="admin">Administrator</SelectItem>
            <SelectItem value="dispatcher">Dispatcher</SelectItem>
            <SelectItem value="fahrer">Fahrer</SelectItem>
            <SelectItem value="user">Benutzer</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={exportCsv} disabled={filtered.length === 0}>
          <Download className="size-4 mr-2" />Exportieren ({filtered.length})
        </Button>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="size-4 mr-2" />Benutzer anlegen
        </Button>
      </div>

      <div className="divide-y divide-border">
        {isLoading && <div className="p-6 text-sm text-muted-foreground">Lade Benutzer…</div>}
        {!isLoading && filtered.length === 0 && (
          <div className="p-6 text-sm text-muted-foreground">Keine Benutzer gefunden.</div>
        )}
        {filtered.map((u: any) => {
          const role = (u.roles?.[0] as AppRole) ?? "fahrer";
          const meta = ROLE_META[role] ?? ROLE_META.fahrer;
          const Icon = meta.icon;
          const isSelf = me?.id === u.id;
          return (
            <div key={u.id} className="p-4 flex flex-col md:flex-row md:items-center gap-3">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="size-10 rounded-full bg-muted grid place-items-center shrink-0">
                  <Icon className="size-5 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <div className="font-medium truncate">
                    {u.display_name || u.email}
                    {isSelf && <span className="ml-2 text-xs text-muted-foreground">(Du)</span>}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{u.email}</div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge className={meta.cls}>{meta.label}</Badge>
                <span className="text-xs text-muted-foreground">
                  Letzter Login: {fmt(u.last_sign_in_at)}
                </span>
              </div>
              {role === "fahrer" && (
                <div className="flex items-center gap-2 rounded-md border border-border bg-muted/20 px-3 py-1.5">
                  <Truck className="size-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Für Einsatz auswählbar</span>
                  <Switch
                    checked={u.einsatz_selectable !== false}
                    onCheckedChange={(v) => selectableMut.mutate({ user_id: u.id, selectable: v })}
                  />
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isSelf || impBusy === u.id}
                  onClick={async () => {
                    if (!confirm(`Als "${u.display_name || u.email}" einloggen? Du wirst dabei abgemeldet.`)) return;
                    setImpBusy(u.id);
                    try {
                      const { token_hash } = await impersonate({ data: { user_id: u.id } });
                      await supabase.auth.signOut();
                      const { error } = await supabase.auth.verifyOtp({ token_hash, type: "magiclink" });
                      if (error) throw error;
                      toast.success(`Angemeldet als ${u.display_name || u.email}`);
                      navigate({ to: "/dashboard" });
                    } catch (e: any) {
                      toast.error(e?.message ?? "Login fehlgeschlagen");
                    } finally { setImpBusy(null); }
                  }}
                >
                  <LogIn className="size-4 mr-1" />Einloggen als
                </Button>
                <Button variant="outline" size="sm" onClick={() => setEditUser(u)}>
                  <Pencil className="size-4 mr-1" />Bearbeiten
                </Button>
                <Button variant="outline" size="sm" onClick={() => setPwUser(u)}>
                  <KeyRound className="size-4 mr-1" />Passwort
                </Button>
                <Button variant="outline" size="sm" disabled={isSelf} onClick={() => setDelUser(u)}>
                  <Trash2 className="size-4 mr-1 text-red-400" />Löschen
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <CreateUserDialog open={createOpen} onOpenChange={setCreateOpen} onDone={refresh} />
      <EditUserDialog user={editUser} onOpenChange={(o) => !o && setEditUser(null)} onDone={refresh} />
      <PasswordDialog user={pwUser} onOpenChange={(o) => !o && setPwUser(null)} />
      <DeleteUserDialog user={delUser} onOpenChange={(o) => !o && setDelUser(null)} onDone={refresh} />
    </div>
  );
}

function CreateUserDialog({ open, onOpenChange, onDone }: { open: boolean; onOpenChange: (o: boolean) => void; onDone: () => void }) {
  const create = useServerFn(createUser);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<AppRole>("fahrer");
  const [busy, setBusy] = useState(false);

  const reset = () => { setEmail(""); setPassword(""); setDisplayName(""); setRole("fahrer"); };

  const submit = async () => {
    setBusy(true);
    try {
      await create({ data: { email, password, display_name: displayName, role } });
      toast.success("Benutzer angelegt");
      reset();
      onOpenChange(false);
      onDone();
    } catch (e: any) {
      toast.error(e?.message ?? "Fehler beim Anlegen");
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Neuen Benutzer anlegen</DialogTitle>
          <DialogDescription>Der Benutzer kann sich sofort mit E-Mail und Passwort anmelden.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Anzeigename</Label>
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Max Mustermann" />
          </div>
          <div>
            <Label>E-Mail</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@example.com" />
          </div>
          <div>
            <Label>Passwort (min. 4 Zeichen)</Label>
            <Input type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          </div>
          <div>
            <Label>Rolle</Label>
            <Select value={role} onValueChange={(v) => setRole(v as AppRole)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Administrator</SelectItem>
                <SelectItem value="dispatcher">Dispatcher</SelectItem>
                <SelectItem value="fahrer">Fahrer</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Abbrechen</Button>
          <Button onClick={submit} disabled={busy || !email || password.length < 4 || !displayName}>
            {busy ? "Lege an…" : "Anlegen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditUserDialog({ user, onOpenChange, onDone }: { user: any | null; onOpenChange: (o: boolean) => void; onDone: () => void }) {
  const updateProf = useServerFn(updateUserProfile);
  const setRole = useServerFn(setUserRole);
  const [displayName, setDisplayName] = useState("");
  const [role, setRoleVal] = useState<AppRole>("fahrer");
  const [busy, setBusy] = useState(false);

  useMemo(() => {
    if (user) {
      setDisplayName(user.display_name ?? "");
      setRoleVal(((user.roles?.[0] as AppRole) ?? "fahrer"));
    }
  }, [user]);

  const submit = async () => {
    if (!user) return;
    setBusy(true);
    try {
      await updateProf({ data: { user_id: user.id, display_name: displayName } });
      await setRole({ data: { user_id: user.id, role } });
      toast.success("Benutzer aktualisiert");
      onOpenChange(false);
      onDone();
    } catch (e: any) {
      toast.error(e?.message ?? "Fehler beim Speichern");
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={!!user} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Benutzer bearbeiten</DialogTitle>
          <DialogDescription>{user?.email}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Anzeigename</Label>
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </div>
          <div>
            <Label>Rolle</Label>
            <Select value={role} onValueChange={(v) => setRoleVal(v as AppRole)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Administrator</SelectItem>
                <SelectItem value="dispatcher">Dispatcher</SelectItem>
                <SelectItem value="fahrer">Fahrer</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Abbrechen</Button>
          <Button onClick={submit} disabled={busy || !displayName}>{busy ? "Speichere…" : "Speichern"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PasswordDialog({ user, onOpenChange }: { user: any | null; onOpenChange: (o: boolean) => void }) {
  const reset = useServerFn(resetUserPassword);
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!user) return;
    setBusy(true);
    try {
      await reset({ data: { user_id: user.id, password: pw } });
      toast.success("Passwort gesetzt");
      setPw("");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Fehler");
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={!!user} onOpenChange={(o) => { onOpenChange(o); if (!o) setPw(""); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Passwort zurücksetzen</DialogTitle>
          <DialogDescription>Neues Passwort für {user?.email}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label>Neues Passwort (min. 4 Zeichen)</Label>
          <Input type="text" value={pw} onChange={(e) => setPw(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Abbrechen</Button>
          <Button onClick={submit} disabled={busy || pw.length < 4}>Setzen</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteUserDialog({ user, onOpenChange, onDone }: { user: any | null; onOpenChange: (o: boolean) => void; onDone: () => void }) {
  const del = useServerFn(deleteUser);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!user) return;
    setBusy(true);
    try {
      await del({ data: { user_id: user.id } });
      toast.success("Benutzer gelöscht");
      onOpenChange(false);
      onDone();
    } catch (e: any) {
      toast.error(e?.message ?? "Fehler beim Löschen");
    } finally { setBusy(false); }
  };
  return (
    <AlertDialog open={!!user} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Benutzer löschen?</AlertDialogTitle>
          <AlertDialogDescription>
            {user?.email} wird unwiderruflich entfernt. Alle Anmeldedaten gehen verloren.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Abbrechen</AlertDialogCancel>
          <AlertDialogAction onClick={submit} disabled={busy} className="bg-red-500 text-white hover:bg-red-600">
            Löschen
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ---------------- Einsatzgründe ----------------

function GruendePanel() {
  const qc = useQueryClient();
  const fetchG = useServerFn(listAllGruende);
  const upsert = useServerFn(upsertGrund);
  const del = useServerFn(deleteGrund);
  const { data, isLoading } = useQuery({ queryKey: ["admin-gruende"], queryFn: () => fetchG() });

  const [editing, setEditing] = useState<any | null>(null);
  const [newName, setNewName] = useState("");
  const [newTyp, setNewTyp] = useState<"" | "av_einsatz" | "hausnotruf">("");
  const [delTarget, setDelTarget] = useState<any | null>(null);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin-gruende"] });
    qc.invalidateQueries({ queryKey: ["admin-stats"] });
  };

  const add = async () => {
    if (!newName.trim()) return;
    try {
      await upsert({ data: { name: newName.trim(), aktiv: true, einsatz_typ: newTyp || null } });
      setNewName("");
      setNewTyp("");
      refresh();
      toast.success("Einsatzgrund hinzugefügt");
    } catch (e: any) {
      toast.error(e?.message ?? "Fehler");
    }
  };

  const toggle = async (g: any) => {
    try {
      await upsert({ data: { id: g.id, name: g.name, aktiv: !g.aktiv, einsatz_typ: g.einsatz_typ ?? null } });
      refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Fehler");
    }
  };

  const save = async () => {
    if (!editing?.name?.trim()) return;
    try {
      await upsert({ data: { id: editing.id, name: editing.name.trim(), aktiv: editing.aktiv, einsatz_typ: editing.einsatz_typ ?? null } });
      setEditing(null);
      refresh();
      toast.success("Gespeichert");
    } catch (e: any) {
      toast.error(e?.message ?? "Fehler");
    }
  };

  const remove = async () => {
    if (!delTarget) return;
    try {
      await del({ data: { id: delTarget.id } });
      setDelTarget(null);
      refresh();
      toast.success("Gelöscht");
    } catch (e: any) {
      toast.error(e?.message ?? "Fehler beim Löschen");
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card" style={{ boxShadow: "var(--shadow-card)" }}>
      <div className="p-4 flex flex-wrap gap-2 border-b border-border">
        <Input className="flex-1 min-w-[220px]" placeholder="Neuer Einsatzgrund (z. B. Einbruch)" value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()} />
        <Select value={newTyp || "all"} onValueChange={(v) => setNewTyp(v === "all" ? "" : v as any)}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Für Einsatztyp" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Einsatztypen</SelectItem>
            <SelectItem value="av_einsatz">Nur AV-Einsatz</SelectItem>
            <SelectItem value="hausnotruf">Nur Hausnotruf</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={add} disabled={!newName.trim()}><Plus className="size-4 mr-2" />Hinzufügen</Button>
      </div>
      <div className="divide-y divide-border">
        {isLoading && <div className="p-6 text-sm text-muted-foreground">Lade…</div>}
        {!isLoading && (data?.gruende ?? []).length === 0 && (
          <div className="p-6 text-sm text-muted-foreground">Noch keine Einsatzgründe angelegt.</div>
        )}
        {(data?.gruende ?? []).map((g: any) => (
          <div key={g.id} className="p-4 flex items-center gap-3">
            <ShieldCheck className={`size-4 ${g.aktiv ? "text-emerald-400" : "text-muted-foreground"}`} />
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{g.name}</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                {g.einsatz_typ === "av_einsatz" ? "Nur AV-Einsatz"
                  : g.einsatz_typ === "hausnotruf" ? "Nur Hausnotruf"
                  : "Alle Einsatztypen"}
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Aktiv</span>
              <Switch checked={g.aktiv} onCheckedChange={() => toggle(g)} />
            </div>
            <Button variant="outline" size="sm" onClick={() => setEditing({ ...g })}>
              <Pencil className="size-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setDelTarget(g)}>
              <Trash2 className="size-4 text-red-400" />
            </Button>
          </div>
        ))}
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Einsatzgrund bearbeiten</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Name</Label>
              <Input value={editing?.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
            </div>
            <div>
              <Label>Für Einsatztyp</Label>
              <Select
                value={editing?.einsatz_typ ?? "all"}
                onValueChange={(v) => setEditing({ ...editing, einsatz_typ: v === "all" ? null : v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Einsatztypen</SelectItem>
                  <SelectItem value="av_einsatz">Nur AV-Einsatz</SelectItem>
                  <SelectItem value="hausnotruf">Nur Hausnotruf</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between rounded-md border border-border p-3">
              <Label className="m-0">Aktiv</Label>
              <Switch checked={!!editing?.aktiv} onCheckedChange={(v) => setEditing({ ...editing, aktiv: v })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Abbrechen</Button>
            <Button onClick={save}>Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!delTarget} onOpenChange={(o) => !o && setDelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Einsatzgrund löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              "{delTarget?.name}" wird entfernt. Bereits angelegte Einsätze bleiben bestehen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={remove} className="bg-red-500 text-white hover:bg-red-600">Löschen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ---------------- Support PIN ----------------

function SupportPinCard() {
  const getFn = useServerFn(getSupportPin);
  const regenFn = useServerFn(regenerateSupportPin);
  const qc = useQueryClient();
  const [show, setShow] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ["support-pin"],
    queryFn: () => getFn(),
  });
  const pin = (data as any)?.pin ?? "";
  return (
    <Card>
      <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
        <div className="flex items-center gap-3">
          <KeyRound className="size-5 text-primary" />
          <div>
            <div className="font-semibold text-sm">Support-PIN</div>
            <div className="text-xs text-muted-foreground">
              Gib diesen PIN an den SuperAdmin weiter, damit er sich mit deiner Zustimmung verbinden kann.
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <code className="px-3 py-2 rounded-md bg-muted font-mono text-lg tracking-widest min-w-[8ch] text-center">
            {isLoading ? "…" : show ? pin : "••••••"}
          </code>
          <Button size="icon" variant="outline" title={show ? "Verbergen" : "Anzeigen"} onClick={() => setShow((v) => !v)}>
            {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </Button>
          <Button size="icon" variant="outline" title="Kopieren" disabled={!pin}
            onClick={() => { navigator.clipboard.writeText(pin); toast.success("PIN kopiert"); }}>
            <CopyIcon className="size-4" />
          </Button>
          <Button size="icon" variant="outline" title="Neu generieren"
            onClick={async () => {
              if (!confirm("Neuen Support-PIN generieren? Der alte ist danach ungültig.")) return;
              try {
                await regenFn();
                await qc.invalidateQueries({ queryKey: ["support-pin"] });
                toast.success("Neuer PIN generiert");
              } catch (e: any) { toast.error(e?.message ?? "Fehler"); }
            }}>
            <RefreshCw className="size-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ForcedImpersonationAlert() {
  const getFn = useServerFn(getForcedImpersonation);
  const { data } = useQuery({
    queryKey: ["forced-impersonation"],
    queryFn: () => getFn(),
    refetchInterval: 15_000,
  });
  if (!data || !(data as any).active) return null;
  const d: any = data;
  return (
    <div className="rounded-lg border border-destructive/40 bg-destructive/10 text-destructive p-4 flex gap-3">
      <ShieldAlert className="size-5 shrink-0 mt-0.5" />
      <div className="text-sm space-y-1">
        <div className="font-semibold">Zwangsverbindung aktiv</div>
        <div>
          SuperAdmin <strong>{d.superadmin_email ?? "unbekannt"}</strong> ist seit{" "}
          {new Date(d.started_at).toLocaleString("de-DE")} mit deiner Domäne verbunden — ohne Support-PIN.
        </div>
        {d.reason && <div>Grund: <em>{d.reason}</em></div>}
      </div>
    </div>
  );
}
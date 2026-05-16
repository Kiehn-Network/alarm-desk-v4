import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Users, ShieldCheck, FileText, Siren, Tag, Plus, Pencil, Trash2,
  KeyRound, Search, Shield, Truck, Radio, Lock, LogIn, Settings as SettingsIcon,
} from "lucide-react";
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
import {
  adminStats, listUsers, createUser, setUserRole, updateUserProfile,
  resetUserPassword, deleteUser, impersonateUser,
  listAllGruende, upsertGrund, deleteGrund,
} from "@/lib/admin.functions";
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

      <Tabs defaultValue="users" className="space-y-4">
        <TabsList>
          <TabsTrigger value="users"><Users className="size-4 mr-2" />Benutzer</TabsTrigger>
          <TabsTrigger value="gruende"><Tag className="size-4 mr-2" />Einsatzgründe</TabsTrigger>
          <TabsTrigger value="system"><SettingsIcon className="size-4 mr-2" />System</TabsTrigger>
        </TabsList>

        <TabsContent value="users"><UsersPanel /></TabsContent>
        <TabsContent value="gruende"><GruendePanel /></TabsContent>
        <TabsContent value="system"><SystemSettingsPanel /></TabsContent>
      </Tabs>
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
  const navigate = useNavigate();
  const [impBusy, setImpBusy] = useState<string | null>(null);
  const { data, isLoading } = useQuery({ queryKey: ["admin-users"], queryFn: () => fetchUsers() });

  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<any | null>(null);
  const [pwUser, setPwUser] = useState<any | null>(null);
  const [delUser, setDelUser] = useState<any | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = data?.users ?? [];
    if (!q) return list;
    return list.filter((u: any) =>
      (u.email ?? "").toLowerCase().includes(q) ||
      (u.display_name ?? "").toLowerCase().includes(q),
    );
  }, [data, search]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin-users"] });
    qc.invalidateQueries({ queryKey: ["admin-stats"] });
  };

  return (
    <div className="rounded-xl border border-border bg-card" style={{ boxShadow: "var(--shadow-card)" }}>
      <div className="p-4 flex flex-col sm:flex-row gap-3 sm:items-center border-b border-border">
        <div className="relative flex-1">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Suchen nach Name oder E-Mail…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
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
            <Label>Passwort (min. 8 Zeichen)</Label>
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
          <Button onClick={submit} disabled={busy || !email || password.length < 8 || !displayName}>
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
          <Label>Neues Passwort (min. 8 Zeichen)</Label>
          <Input type="text" value={pw} onChange={(e) => setPw(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Abbrechen</Button>
          <Button onClick={submit} disabled={busy || pw.length < 8}>Setzen</Button>
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
  const [delTarget, setDelTarget] = useState<any | null>(null);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin-gruende"] });
    qc.invalidateQueries({ queryKey: ["admin-stats"] });
  };

  const add = async () => {
    if (!newName.trim()) return;
    try {
      await upsert({ data: { name: newName.trim(), aktiv: true } });
      setNewName("");
      refresh();
      toast.success("Einsatzgrund hinzugefügt");
    } catch (e: any) {
      toast.error(e?.message ?? "Fehler");
    }
  };

  const toggle = async (g: any) => {
    try {
      await upsert({ data: { id: g.id, name: g.name, aktiv: !g.aktiv } });
      refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Fehler");
    }
  };

  const save = async () => {
    if (!editing?.name?.trim()) return;
    try {
      await upsert({ data: { id: editing.id, name: editing.name.trim(), aktiv: editing.aktiv } });
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
      <div className="p-4 flex gap-2 border-b border-border">
        <Input placeholder="Neuer Einsatzgrund (z. B. Einbruch)" value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()} />
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
            <div className="flex-1 font-medium">{g.name}</div>
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
import { useState, useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { RefreshCw, Search, Save, CheckCircle2, Circle, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { listUsers } from "@/lib/admin.functions";
import {
  adminListTourSettings, adminUpdateUserTour, adminResetUserTour,
} from "@/lib/tour.functions";
import { adminListOnboarding, adminSetUserOnboarding } from "@/lib/onboarding.functions";
import { TOUR_STEPS } from "@/lib/tour-steps";

export function TourAdminPanel() {
  const qc = useQueryClient();
  const fetchUsers = useServerFn(listUsers);
  const fetchSettings = useServerFn(adminListTourSettings);
  const update = useServerFn(adminUpdateUserTour);
  const reset = useServerFn(adminResetUserTour);
  const fetchOnb = useServerFn(adminListOnboarding);
  const setOnb = useServerFn(adminSetUserOnboarding);

  const usersQ = useQuery({ queryKey: ["admin-users"], queryFn: () => fetchUsers() });
  const settingsQ = useQuery({ queryKey: ["admin-tour-settings"], queryFn: () => fetchSettings() });
  const onbQ = useQuery({ queryKey: ["admin-onboarding"], queryFn: () => fetchOnb() });

  const [search, setSearch] = useState("");
  const [edit, setEdit] = useState<{ user_id: string; display_name: string } | null>(null);

  const map = useMemo(() => {
    const m: Record<string, any> = {};
    (settingsQ.data?.settings ?? []).forEach((s: any) => { m[s.user_id] = s; });
    return m;
  }, [settingsQ.data]);

  const onbMap = useMemo(() => {
    const m: Record<string, any> = {};
    (onbQ.data?.profiles ?? []).forEach((p: any) => { m[p.id] = p; });
    return m;
  }, [onbQ.data]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = usersQ.data?.users ?? [];
    if (!q) return list;
    return list.filter((u: any) =>
      (u.display_name ?? "").toLowerCase().includes(q) ||
      (u.email ?? "").toLowerCase().includes(q));
  }, [usersQ.data, search]);

  const toggleMutation = useMutation({
    mutationFn: (vars: { user_id: string; tour_enabled: boolean; enabled_steps: string[] }) => update({ data: vars }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-tour-settings"] });
      toast.success("Gespeichert");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const resetMutation = useMutation({
    mutationFn: (user_id: string) => reset({ data: { user_id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-tour-settings"] });
      toast.success("Tour zurückgesetzt – Nutzer sieht sie beim nächsten Login");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const onbMutation = useMutation({
    mutationFn: (vars: { user_id: string; completed: boolean }) => setOnb({ data: vars }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-onboarding"] });
      toast.success("Einführungs-Status aktualisiert");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-5"
        style={{ boxShadow: "var(--shadow-card)" }}>
        <div className="flex items-center gap-2 mb-3">
          <GraduationCap className="size-5 text-primary" />
          <h3 className="font-semibold">Einführung (Tour) pro Nutzer</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Lege fest, ob die geführte Einführung beim nächsten Login automatisch erscheint und welche Schritte enthalten sind.
          Rollen-passende Schritte werden zusätzlich automatisch gefiltert.
        </p>

        <div className="relative mb-3">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Nutzer suchen…" className="pl-9"
            value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-muted-foreground">
              <tr className="border-b border-border">
                <th className="text-left py-2 pr-3">Nutzer</th>
                <th className="text-left py-2 pr-3">Tour aktiv</th>
                <th className="text-left py-2 pr-3">Einführung erledigt</th>
                <th className="text-left py-2 pr-3">Status</th>
                <th className="text-left py-2 pr-3">Schritte</th>
                <th className="text-right py-2 pl-3">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u: any) => {
                const s = map[u.id];
                const enabled = s?.tour_enabled ?? true;
                const completed = !!s?.completed_at;
                const stepsCount = s?.enabled_steps?.length ?? 0;
                const onbDone = !!onbMap[u.id]?.onboarding_completed_at;
                return (
                  <tr key={u.id} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="py-2 pr-3">
                      <div className="font-medium">{u.display_name ?? "–"}</div>
                      <div className="text-xs text-muted-foreground">{u.email}</div>
                    </td>
                    <td className="py-2 pr-3">
                      <Switch checked={enabled}
                        onCheckedChange={(v) => toggleMutation.mutate({
                          user_id: u.id, tour_enabled: v,
                          enabled_steps: s?.enabled_steps ?? [],
                        })} />
                    </td>
                    <td className="py-2 pr-3">
                      <div className="flex items-center gap-2">
                        <Switch checked={onbDone}
                          onCheckedChange={(v) => onbMutation.mutate({ user_id: u.id, completed: v })} />
                        <span className="text-xs text-muted-foreground">
                          {onbDone ? "Übersprungen" : "Pflicht beim Login"}
                        </span>
                      </div>
                    </td>
                    <td className="py-2 pr-3">
                      {completed ? (
                        <Badge variant="outline" className="text-emerald-500 border-emerald-500/30">
                          <CheckCircle2 className="size-3 mr-1" /> Abgeschlossen
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">
                          <Circle className="size-3 mr-1" /> Ausstehend
                        </Badge>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-xs text-muted-foreground">
                      {stepsCount === 0 ? "Alle (rollenbasiert)" : `${stepsCount} ausgewählt`}
                    </td>
                    <td className="py-2 pl-3 text-right">
                      <div className="flex gap-2 justify-end">
                        <Button variant="ghost" size="sm"
                          onClick={() => setEdit({ user_id: u.id, display_name: u.display_name ?? u.email })}>
                          Schritte
                        </Button>
                        <Button variant="outline" size="sm"
                          onClick={() => resetMutation.mutate(u.id)}>
                          <RefreshCw className="size-3.5 mr-1" /> Zurücksetzen
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                  Keine Nutzer.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {edit && (
        <StepsDialog
          open={!!edit}
          onClose={() => setEdit(null)}
          userId={edit.user_id}
          displayName={edit.display_name}
          current={map[edit.user_id]}
          onSave={(steps) => {
            const cur = map[edit.user_id];
            toggleMutation.mutate({
              user_id: edit.user_id,
              tour_enabled: cur?.tour_enabled ?? true,
              enabled_steps: steps,
            }, { onSuccess: () => setEdit(null) });
          }}
        />
      )}
    </div>
  );
}

function StepsDialog({
  open, onClose, displayName, current, onSave,
}: {
  open: boolean; onClose: () => void; userId: string; displayName: string;
  current?: any; onSave: (steps: string[]) => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(
    new Set(current?.enabled_steps ?? []),
  );

  const toggle = (k: string) => {
    const next = new Set(selected);
    if (next.has(k)) next.delete(k); else next.add(k);
    setSelected(next);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Schritte für {displayName}</DialogTitle>
          <DialogDescription>
            Wähle gezielt aus, welche Schritte gezeigt werden. Wenn nichts ausgewählt ist, werden alle für die Rolle passenden Schritte gezeigt.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto space-y-2 mt-2">
          {TOUR_STEPS.map((s) => {
            const Icon = s.icon;
            const on = selected.has(s.key);
            return (
              <button key={s.key} type="button" onClick={() => toggle(s.key)}
                className={`w-full text-left rounded-lg border p-3 flex items-start gap-3 transition-colors ${
                  on ? "border-primary bg-primary/5" : "border-border hover:bg-muted/30"
                }`}>
                <div className="size-9 rounded-md bg-primary/10 grid place-items-center text-primary shrink-0">
                  <Icon className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm">{s.title}</div>
                  <div className="text-xs text-muted-foreground truncate">{s.description}</div>
                </div>
                <div className={`size-5 rounded border grid place-items-center shrink-0 ${
                  on ? "bg-primary border-primary text-primary-foreground" : "border-border"
                }`}>
                  {on && <CheckCircle2 className="size-3.5" />}
                </div>
              </button>
            );
          })}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setSelected(new Set())}>
            Alle (Standard)
          </Button>
          <Button onClick={() => onSave(Array.from(selected))}>
            <Save className="size-4 mr-2" /> Speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
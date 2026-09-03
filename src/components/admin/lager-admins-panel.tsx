import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listUsers } from "@/lib/admin.functions";
import { listLagerAdmins, setLagerAdmin } from "@/lib/lager.functions";

export function LagerAdminsPanel() {
  const qc = useQueryClient();
  const loadUsers = useServerFn(listUsers);
  const loadAdmins = useServerFn(listLagerAdmins);
  const setAdmin = useServerFn(setLagerAdmin);

  const users = useQuery({ queryKey: ["admin-users"], queryFn: () => loadUsers() });
  const admins = useQuery({ queryKey: ["lager-admins"], queryFn: () => loadAdmins({ data: {} } as any) });

  const adminIds = new Set(((admins.data?.rows ?? []) as any[]).map((r) => r.user_id));

  async function toggle(userId: string, enabled: boolean) {
    try {
      await setAdmin({ data: { user_id: userId, enabled } } as any);
      toast.success(enabled ? "Als Lager-Admin freigegeben" : "Lager-Admin entfernt");
      qc.invalidateQueries({ queryKey: ["lager-admins"] });
    } catch (e: any) { toast.error(e?.message ?? "Fehler"); }
  }

  const rows = (users.data?.users ?? []) as any[];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><ShieldCheck className="size-4" /> Lager-Admins</CardTitle>
        <p className="text-sm text-muted-foreground mt-1">
          Lager-Admins dürfen Artikel anlegen, Bestände pflegen und die Meldebestand-Benachrichtigung einstellen.
        </p>
      </CardHeader>
      <CardContent>
        {users.isLoading ? (
          <div className="text-sm text-muted-foreground">Lade…</div>
        ) : rows.length === 0 ? (
          <div className="text-sm text-muted-foreground">Keine Benutzer in dieser Domäne.</div>
        ) : (
          <div className="divide-y divide-border">
            {rows.map((u) => (
              <div key={u.id} className="flex items-center justify-between py-2">
                <div className="min-w-0">
                  <div className="font-medium text-sm">{u.display_name ?? u.email}</div>
                  <div className="text-xs text-muted-foreground">{u.email}</div>
                </div>
                <Switch checked={adminIds.has(u.id)} onCheckedChange={(v) => toggle(u.id, v)} />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

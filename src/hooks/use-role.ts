import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./use-auth";

export type AppRole = "superadmin" | "admin" | "dispatcher" | "fahrer" | "user";

export function useRole() {
  const { user } = useAuth();
  const [role, setRole] = useState<AppRole | null>(null);
  const [domainId, setDomainId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setRole(null); setDomainId(null); setLoading(false); return; }
    let cancel = false;
    (async () => {
      const [{ data: roles }, { data: prof }] = await Promise.all([
        supabase.from("user_roles").select("role,domain_id").eq("user_id", user.id),
        supabase.from("profiles").select("domain_id").eq("id", user.id).maybeSingle(),
      ]);
      if (cancel) return;
      const rs = (roles ?? []).map((r: any) => r.role as AppRole);
      const order: AppRole[] = ["superadmin", "admin", "dispatcher", "fahrer", "user"];
      const best = order.find((r) => rs.includes(r)) ?? null;
      setRole(best);
      setDomainId((prof as any)?.domain_id ?? null);
      setLoading(false);
    })();
    return () => { cancel = true; };
  }, [user]);

  return {
    role, loading, domainId,
    isSuperAdmin: role === "superadmin",
    isAdmin: role === "admin" || role === "superadmin",
    isDispatcher: role === "dispatcher",
    isFahrer: role === "fahrer",
    canManage: role === "admin" || role === "dispatcher" || role === "superadmin",
  };
}

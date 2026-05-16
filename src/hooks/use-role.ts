import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./use-auth";

export type AppRole = "admin" | "dispatcher" | "fahrer";

export function useRole() {
  const { user } = useAuth();
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setRole(null); setLoading(false); return; }
    let cancel = false;
    (async () => {
      const { data } = await supabase
        .from("user_roles").select("role").eq("user_id", user.id);
      if (cancel) return;
      const roles = (data ?? []).map((r: any) => r.role as AppRole);
      const order: AppRole[] = ["admin", "dispatcher", "fahrer"];
      const best = order.find((r) => roles.includes(r)) ?? null;
      setRole(best);
      setLoading(false);
    })();
    return () => { cancel = true; };
  }, [user]);

  return { role, loading, isAdmin: role === "admin", isDispatcher: role === "dispatcher", isFahrer: role === "fahrer", canManage: role === "admin" || role === "dispatcher" };
}
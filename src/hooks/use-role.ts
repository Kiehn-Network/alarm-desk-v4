import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./use-auth";

export type AppRole = "superadmin" | "admin" | "dispatcher" | "fahrer" | "user";

export function useRole() {
  const { user } = useAuth();
  const [role, setRole] = useState<AppRole | null>(null);
  const [domainId, setDomainId] = useState<string | null>(null);
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setRole(null); setDomainId(null); setIsImpersonating(false); setLoading(false); return; }
    let cancel = false;
    (async () => {
      const [{ data: roles }, { data: prof }, { data: imp }] = await Promise.all([
        supabase.from("user_roles").select("role,domain_id").eq("user_id", user.id),
        supabase.from("profiles").select("domain_id").eq("id", user.id).maybeSingle(),
        supabase.from("superadmin_impersonation").select("target_domain_id").eq("superadmin_id", user.id).maybeSingle(),
      ]);
      if (cancel) return;
      const rs = (roles ?? []).map((r: any) => r.role as AppRole);
      const order: AppRole[] = ["superadmin", "admin", "dispatcher", "fahrer", "user"];
      const best = order.find((r) => rs.includes(r)) ?? null;
      const impersonatedDomain = (imp as any)?.target_domain_id ?? null;
      setRole(best);
      setDomainId(impersonatedDomain ?? (prof as any)?.domain_id ?? null);
      setIsImpersonating(Boolean(impersonatedDomain));
      setLoading(false);
    })();
    return () => { cancel = true; };
  }, [user]);

  // When a superadmin is impersonating a domain, treat them as a domain admin
  // for UI gating so they see the same menus/actions as the domain admin.
  const effectiveRole: AppRole | null =
    role === "superadmin" && isImpersonating ? "admin" : role;

  return {
    role: effectiveRole,
    actualRole: role,
    loading,
    domainId,
    isImpersonating,
    isSuperAdmin: role === "superadmin",
    isAdmin: effectiveRole === "admin" || role === "superadmin",
    isDispatcher: effectiveRole === "dispatcher",
    isFahrer: effectiveRole === "fahrer",
    canManage: effectiveRole === "admin" || effectiveRole === "dispatcher" || role === "superadmin",
  };
}

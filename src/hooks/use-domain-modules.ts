import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Returns the set of module keys enabled for the user's currently effective
 * domain (respects SuperAdmin impersonation via RLS).
 */
export function useDomainModules() {
  return useQuery({
    queryKey: ["domain-modules"],
    queryFn: async () => {
      const [dm, am] = await Promise.all([
        supabase.from("domain_modules").select("module_key, enabled"),
        supabase.from("app_modules").select("key, parent_key"),
      ]);
      if (dm.error) throw dm.error;
      if (am.error) throw am.error;
      const enabled = new Set(
        (dm.data ?? []).filter((m) => m.enabled).map((m) => m.module_key),
      );
      const parentOf: Record<string, string | null> = {};
      (am.data ?? []).forEach((m: any) => { parentOf[m.key] = m.parent_key ?? null; });
      // A sub-module is only effectively enabled if its parent is also enabled.
      const effective = new Set<string>();
      enabled.forEach((k) => {
        const p = parentOf[k];
        if (p && !enabled.has(p)) return;
        effective.add(k);
      });
      return effective;
    },
  });
}
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
      const { data, error } = await supabase
        .from("domain_modules")
        .select("module_key, enabled");
      if (error) throw error;
      return new Set(
        (data ?? []).filter((m) => m.enabled).map((m) => m.module_key),
      );
    },
  });
}
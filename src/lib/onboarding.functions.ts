import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireEffectiveDomainId } from "@/lib/tenant.server";

export const getOnboardingStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("profiles")
      .select("onboarding_completed_at, onboarding_demo_mode")
      .eq("id", userId)
      .maybeSingle();
    return {
      completedAt: (data as any)?.onboarding_completed_at ?? null,
      demoMode: Boolean((data as any)?.onboarding_demo_mode),
    };
  });

export const startOnboardingDemo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { error } = await (supabase as any)
      .from("profiles")
      .update({ onboarding_demo_mode: true })
      .eq("id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const completeOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const domainId = await requireEffectiveDomainId(supabase, userId).catch(() => null);
    if (domainId) {
      // Alle Demo-Daten der Domain aufräumen
      await (supabase as any).rpc("cleanup_all_demo_for_domain", { _domain_id: domainId });
    }
    const { error } = await (supabase as any)
      .from("profiles")
      .update({
        onboarding_completed_at: new Date().toISOString(),
        onboarding_demo_mode: false,
      })
      .eq("id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Setzt den Onboarding-Status wieder zurück (Admin-Tool). */
export const resetMyOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { error } = await (supabase as any)
      .from("profiles")
      .update({ onboarding_completed_at: null, onboarding_demo_mode: false })
      .eq("id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
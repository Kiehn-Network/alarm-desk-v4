import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireEffectiveDomainId } from "@/lib/tenant.server";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getEffectiveDomainId } from "@/lib/tenant.server";

async function requireDomainAdmin(userId: string): Promise<string> {
  const { data: roles } = await supabaseAdmin
    .from("user_roles").select("role, domain_id").eq("user_id", userId);
  const isSuper = (roles ?? []).some((r: any) => r.role === "superadmin");
  const domainId = await getEffectiveDomainId(supabaseAdmin, userId);
  if (isSuper) {
    if (!domainId) throw new Error("Bitte zuerst in eine Domäne wechseln.");
    return domainId;
  }
  const isAdmin = (roles ?? []).some(
    (r: any) => r.role === "admin" && r.domain_id && r.domain_id === domainId,
  );
  if (!isAdmin) throw new Error("Nur Administratoren dürfen diese Aktion ausführen");
  if (!domainId) throw new Error("Keine Domäne zugewiesen");
  return domainId;
}

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

/** Admin: Onboarding-Status je Nutzer der eigenen Domäne auflisten. */
export const adminListOnboarding = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const domainId = await requireDomainAdmin(context.userId);
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("id, onboarding_completed_at, onboarding_demo_mode")
      .eq("domain_id", domainId);
    if (error) throw new Error(error.message);
    return { profiles: data ?? [] };
  });

/** Admin: Onboarding für einen Nutzer auf abgeschlossen setzen (überspringen). */
export const adminSetUserOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    user_id: z.string().uuid(),
    completed: z.boolean(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const domainId = await requireDomainAdmin(context.userId);
    const { data: prof } = await supabaseAdmin
      .from("profiles").select("domain_id").eq("id", data.user_id).maybeSingle();
    if (!prof || (prof as any).domain_id !== domainId) {
      throw new Error("Nutzer nicht in deiner Domäne");
    }
    const { error } = await (supabaseAdmin as any)
      .from("profiles")
      .update({
        onboarding_completed_at: data.completed ? new Date().toISOString() : null,
        onboarding_demo_mode: false,
      })
      .eq("id", data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
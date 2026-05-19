import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
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

export const getMyTourSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("user_tour_settings").select("*").eq("user_id", userId).maybeSingle();
    return data;
  });

export const markTourCompleted = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const domainId = await getEffectiveDomainId(supabaseAdmin, userId);
    if (!domainId) return { ok: true };
    await supabaseAdmin.from("user_tour_settings").upsert({
      user_id: userId, domain_id: domainId, completed_at: new Date().toISOString(),
      updated_by: userId,
    }, { onConflict: "user_id" });
    return { ok: true };
  });

export const resetMyTour = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    await supabaseAdmin.from("user_tour_settings")
      .update({ completed_at: null, updated_by: userId })
      .eq("user_id", userId);
    return { ok: true };
  });

export const adminListTourSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const domainId = await requireDomainAdmin(context.userId);
    const { data, error } = await supabaseAdmin
      .from("user_tour_settings").select("*").eq("domain_id", domainId);
    if (error) throw new Error(error.message);
    return { settings: data ?? [] };
  });

export const adminUpdateUserTour = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    user_id: z.string().uuid(),
    tour_enabled: z.boolean(),
    enabled_steps: z.array(z.string().min(1).max(50)).max(50),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const domainId = await requireDomainAdmin(context.userId);
    // Make sure target user is in same domain
    const { data: prof } = await supabaseAdmin
      .from("profiles").select("domain_id").eq("id", data.user_id).maybeSingle();
    if (!prof || prof.domain_id !== domainId) throw new Error("Nutzer nicht in deiner Domäne");
    const { error } = await supabaseAdmin.from("user_tour_settings").upsert({
      user_id: data.user_id, domain_id: domainId,
      tour_enabled: data.tour_enabled, enabled_steps: data.enabled_steps,
      updated_by: context.userId,
    }, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminResetUserTour = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ user_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const domainId = await requireDomainAdmin(context.userId);
    const { data: prof } = await supabaseAdmin
      .from("profiles").select("domain_id").eq("id", data.user_id).maybeSingle();
    if (!prof || prof.domain_id !== domainId) throw new Error("Nutzer nicht in deiner Domäne");
    await supabaseAdmin.from("user_tour_settings").upsert({
      user_id: data.user_id, domain_id: domainId,
      completed_at: null, updated_by: context.userId,
    }, { onConflict: "user_id" });
    return { ok: true };
  });
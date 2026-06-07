import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getEffectiveDomainId, requireEffectiveDomainId } from "@/lib/tenant.server";

async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId).in("role", ["admin", "superadmin"]);
  if (!data || data.length === 0) throw new Error("Nicht autorisiert");
}

async function assertSuperadmin(supabase: any, userId: string) {
  const { data } = await supabase
    .from("user_roles").select("role")
    .eq("user_id", userId).eq("role", "superadmin").maybeSingle();
  if (!data) throw new Error("Nur SuperAdmin");
}

export const getAppSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const domainId = await getEffectiveDomainId(supabase, userId);
    if (!domainId) return null;
    const { data, error } = await supabase.from("app_settings").select("*").eq("domain_id", domainId).maybeSingle();
    if (error) throw error;
    return data;
  });

const settingsSchema = z.object({
  firmenname: z.string().min(1).max(200),
  logo_url: z.string().url().max(1000).nullable().optional(),
  dashboard_hinweis: z.string().max(2000).nullable().optional(),
  wartung_aktiv: z.boolean(),
  wartung_nachricht: z.string().max(500).nullable().optional(),
  wartung_farbe: z.enum(["info", "orange", "rot"]),
  rohrservice_variante: z.enum(["standard", "budeko"]).optional(),
  rohrservice_notiz: z.string().max(20000).nullable().optional(),
  theme: z.enum(["midnight", "emerald", "slate", "sunset", "crimson", "violet", "ocean", "mono", "lavender"]).optional(),
});

export const updateAppSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => settingsSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const domainId = await requireEffectiveDomainId(supabase, userId);
    const { error } = await supabase
      .from("app_settings")
      .upsert({ ...data, updated_by: userId, domain_id: domainId }, { onConflict: "domain_id" });
    if (error) throw error;
    return { ok: true };
  });

export const listAppModules = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperadmin(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("app_modules").select("*").order("sort_order").order("name");
    if (error) throw error;
    return data ?? [];
  });

const moduleSchema = z.object({
  id: z.string().uuid().optional(),
  key: z.string().min(1).max(50).regex(/^[a-z0-9_-]+$/),
  name: z.string().min(1).max(100),
  beschreibung: z.string().max(500).nullable().optional(),
  enabled: z.boolean(),
  sort_order: z.number().int().min(0).max(9999),
});

export const upsertAppModule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => moduleSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertSuperadmin(supabase, userId);
    if (data.id) {
      const { error } = await supabase.from("app_modules").update({
        key: data.key, name: data.name, beschreibung: data.beschreibung ?? null,
        enabled: data.enabled, sort_order: data.sort_order,
      }).eq("id", data.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("app_modules").insert({
        key: data.key, name: data.name, beschreibung: data.beschreibung ?? null,
        enabled: data.enabled, sort_order: data.sort_order,
      });
      if (error) throw error;
    }
    return { ok: true };
  });

export const setAppModuleEnabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), enabled: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertSuperadmin(supabase, userId);
    const { error } = await supabase.from("app_modules").update({ enabled: data.enabled }).eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const deleteAppModule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertSuperadmin(supabase, userId);
    const { error } = await supabase.from("app_modules").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });
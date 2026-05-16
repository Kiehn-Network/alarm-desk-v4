import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function assertSuper(userId: string) {
  const { data } = await supabaseAdmin.from("user_roles").select("role")
    .eq("user_id", userId).eq("role", "superadmin").maybeSingle();
  if (!data) throw new Error("Nur SuperAdmin");
}

function genLicenseKey() {
  const seg = () => Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${seg()}-${seg()}-${seg()}-${seg()}-${seg()}-${seg()}`;
}

export const listDomains = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuper(context.userId);
    const { data: domains } = await supabaseAdmin.from("domains").select("*").order("created_at");
    const { data: licenses } = await supabaseAdmin.from("licenses").select("*");
    const { data: modules } = await supabaseAdmin.from("domain_modules").select("*");
    return { domains: domains ?? [], licenses: licenses ?? [], modules: modules ?? [] };
  });

export const createDomain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/),
    name: z.string().min(1).max(200),
  }).parse(i))
  .handler(async ({ data, context }) => {
    await assertSuper(context.userId);
    const { data: d, error } = await supabaseAdmin.from("domains")
      .insert({ slug: data.slug, name: data.name }).select().single();
    if (error) throw new Error(error.message);
    // seed all global app_modules as enabled for this domain
    const { data: mods } = await supabaseAdmin.from("app_modules").select("key, enabled");
    if (mods && mods.length > 0) {
      await supabaseAdmin.from("domain_modules").insert(
        mods.map((m: any) => ({ domain_id: d.id, module_key: m.key, enabled: m.enabled })),
      );
    }
    return d;
  });

export const setDomainStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    id: z.string().uuid(),
    status: z.enum(["active", "disabled"]),
  }).parse(i))
  .handler(async ({ data, context }) => {
    await assertSuper(context.userId);
    const { error } = await supabaseAdmin.from("domains").update({ status: data.status }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const createLicense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    domain_id: z.string().uuid(),
    valid_until: z.string().datetime().optional().nullable(),
    max_users: z.number().int().positive().max(10000).optional().nullable(),
    notes: z.string().max(500).optional().nullable(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    await assertSuper(context.userId);
    const { data: row, error } = await supabaseAdmin.from("licenses").insert({
      domain_id: data.domain_id,
      license_key: genLicenseKey(),
      valid_until: data.valid_until ?? null,
      max_users: data.max_users ?? null,
      notes: data.notes ?? null,
      status: "active",
    }).select().single();
    if (error) throw new Error(error.message);
    return row;
  });

export const revokeLicense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertSuper(context.userId);
    const { error } = await supabaseAdmin.from("licenses").update({ status: "revoked" }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const toggleDomainModule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    domain_id: z.string().uuid(),
    module_key: z.string().min(1).max(50),
    enabled: z.boolean(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    await assertSuper(context.userId);
    const { error } = await supabaseAdmin.from("domain_modules").upsert({
      domain_id: data.domain_id, module_key: data.module_key, enabled: data.enabled,
    }, { onConflict: "domain_id,module_key" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listAllTenantUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuper(context.userId);
    const { data: profiles } = await supabaseAdmin.from("profiles").select("id, display_name, domain_id");
    const { data: roles } = await supabaseAdmin.from("user_roles").select("user_id, role, domain_id");
    const { data: auth } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const emailMap = Object.fromEntries((auth.users ?? []).map((u) => [u.id, u.email ?? ""]));
    const roleMap: Record<string, any[]> = {};
    (roles ?? []).forEach((r: any) => { (roleMap[r.user_id] ||= []).push(r); });
    return {
      users: (profiles ?? []).map((p: any) => ({
        id: p.id,
        display_name: p.display_name,
        domain_id: p.domain_id,
        email: emailMap[p.id] ?? "",
        roles: roleMap[p.id] ?? [],
      })),
    };
  });

export const assignUserToDomain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    user_id: z.string().uuid(),
    domain_id: z.string().uuid().nullable(),
    role: z.enum(["superadmin", "admin", "user"]),
  }).parse(i))
  .handler(async ({ data, context }) => {
    await assertSuper(context.userId);
    await supabaseAdmin.from("profiles").update({ domain_id: data.domain_id }).eq("id", data.user_id);
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.user_id);
    await supabaseAdmin.from("user_roles").insert({
      user_id: data.user_id,
      role: data.role,
      domain_id: data.role === "superadmin" ? null : data.domain_id,
    });
    return { ok: true };
  });

export const startImpersonation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ domain_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertSuper(context.userId);
    const { error } = await supabaseAdmin.from("superadmin_impersonation")
      .upsert({ superadmin_id: context.userId, target_domain_id: data.domain_id });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const stopImpersonation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuper(context.userId);
    await supabaseAdmin.from("superadmin_impersonation").delete().eq("superadmin_id", context.userId);
    return { ok: true };
  });

export const getImpersonation = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await supabaseAdmin.from("superadmin_impersonation")
      .select("target_domain_id").eq("superadmin_id", context.userId).maybeSingle();
    if (!data) return { domain: null };
    const { data: d } = await supabaseAdmin.from("domains").select("id,name,slug").eq("id", data.target_domain_id).maybeSingle();
    return { domain: d };
  });

// ---------- Platform settings (global version & maintenance) ----------

export const getPlatformSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { data } = await supabaseAdmin.from("platform_settings").select("*").eq("id", 1).maybeSingle();
    return data;
  });

export const updatePlatformMaintenance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    wartung_aktiv: z.boolean(),
    wartung_nachricht: z.string().max(500).nullable().optional(),
    wartung_farbe: z.enum(["info", "orange", "rot"]),
  }).parse(i))
  .handler(async ({ data, context }) => {
    await assertSuper(context.userId);
    const { error } = await supabaseAdmin.from("platform_settings").upsert({
      id: 1,
      wartung_aktiv: data.wartung_aktiv,
      wartung_nachricht: data.wartung_nachricht ?? null,
      wartung_farbe: data.wartung_farbe,
      updated_by: context.userId,
      updated_at: new Date().toISOString(),
    }, { onConflict: "id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listAppVersions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { data } = await supabaseAdmin.from("app_versions")
      .select("*").order("released_at", { ascending: false }).limit(100);
    return data ?? [];
  });

export const createAppVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    version: z.string().min(1).max(50).regex(/^[a-zA-Z0-9._+-]+$/),
    changelog: z.string().max(10000).nullable().optional(),
    set_current: z.boolean().optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    await assertSuper(context.userId);
    const { data: row, error } = await supabaseAdmin.from("app_versions").insert({
      version: data.version,
      changelog: data.changelog ?? null,
      created_by: context.userId,
    }).select().single();
    if (error) throw new Error(error.message);
    if (data.set_current !== false) {
      await supabaseAdmin.from("platform_settings").upsert({
        id: 1,
        current_version: data.version,
        updated_by: context.userId,
        updated_at: new Date().toISOString(),
      }, { onConflict: "id" });
    }
    return row;
  });

export const deleteAppVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertSuper(context.userId);
    const { error } = await supabaseAdmin.from("app_versions").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

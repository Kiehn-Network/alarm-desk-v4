import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function assertSuper(userId: string) {
  const { data } = await supabaseAdmin.from("user_roles").select("role")
    .eq("user_id", userId).eq("role", "superadmin").maybeSingle();
  if (!data) throw new Error("Nur SuperAdmin");
}

async function logAudit(opts: {
  actorId: string;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  targetLabel?: string | null;
  metadata?: Record<string, unknown>;
}) {
  try {
    const { data: u } = await supabaseAdmin.auth.admin.getUserById(opts.actorId);
    await supabaseAdmin.from("superadmin_audit_log").insert({
      actor_id: opts.actorId,
      actor_email: u.user?.email ?? null,
      action: opts.action,
      target_type: opts.targetType ?? null,
      target_id: opts.targetId ?? null,
      target_label: opts.targetLabel ?? null,
      metadata: (opts.metadata ?? {}) as never,
    });
  } catch {
    // never block the actual operation because of audit logging
  }
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

export const updateLicense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    id: z.string().uuid(),
    valid_until: z.string().datetime().nullable().optional(),
    max_users: z.number().int().positive().max(10000).nullable().optional(),
    notes: z.string().max(500).nullable().optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    await assertSuper(context.userId);
    const patch: { valid_until?: string | null; max_users?: number | null; notes?: string | null } = {};
    if (data.valid_until !== undefined) patch.valid_until = data.valid_until;
    if (data.max_users !== undefined) patch.max_users = data.max_users;
    if (data.notes !== undefined) patch.notes = data.notes;
    const { error } = await supabaseAdmin.from("licenses").update(patch).eq("id", data.id);
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

    // Cascade: if a parent module is disabled, also disable all its sub-modules
    if (!data.enabled) {
      const { data: children } = await supabaseAdmin
        .from("app_modules")
        .select("key")
        .eq("parent_key", data.module_key);
      if (children && children.length > 0) {
        await supabaseAdmin.from("domain_modules").upsert(
          children.map((c: any) => ({
            domain_id: data.domain_id,
            module_key: c.key,
            enabled: false,
          })),
          { onConflict: "domain_id,module_key" },
        );
      }
    }
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
        banned_until: (auth.users ?? []).find((u) => u.id === p.id)?.banned_until ?? null,
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

export const createTenantUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    email: z.string().email().max(255),
    password: z.string().min(8).max(72),
    display_name: z.string().min(1).max(120),
    domain_id: z.string().uuid().nullable(),
    role: z.enum(["superadmin", "admin", "user"]),
  }).parse(i))
  .handler(async ({ data, context }) => {
    await assertSuper(context.userId);
    if (data.role !== "superadmin" && !data.domain_id) {
      throw new Error("Domain erforderlich für diese Rolle.");
    }
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { display_name: data.display_name },
    });
    if (error || !created.user) throw new Error(error?.message ?? "Konnte Nutzer nicht anlegen.");
    const newUserId = created.user.id;
    // handle_new_user trigger creates profile with null domain_id; update it
    await supabaseAdmin.from("profiles").upsert({
      id: newUserId,
      display_name: data.display_name,
      domain_id: data.role === "superadmin" ? null : data.domain_id,
    }, { onConflict: "id" });
    // remove any auto-assigned role (e.g. first-user superadmin path) and set requested one
    await supabaseAdmin.from("user_roles").delete().eq("user_id", newUserId);
    await supabaseAdmin.from("user_roles").insert({
      user_id: newUserId,
      role: data.role,
      domain_id: data.role === "superadmin" ? null : data.domain_id,
    });
    return { ok: true, user_id: newUserId };
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

// ---------- User power-actions ----------

export const sendPasswordReset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ user_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertSuper(context.userId);
    const { data: u } = await supabaseAdmin.auth.admin.getUserById(data.user_id);
    const email = u.user?.email;
    if (!email) throw new Error("Nutzer hat keine E-Mail.");
    const { data: link, error } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email,
    });
    if (error) throw new Error(error.message);
    return { ok: true, email, action_link: link.properties?.action_link ?? null };
  });

export const setUserDisabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    user_id: z.string().uuid(),
    disabled: z.boolean(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    await assertSuper(context.userId);
    if (data.user_id === context.userId) throw new Error("Eigener Account nicht änderbar.");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, {
      ban_duration: data.disabled ? "876000h" : "none",
    } as any);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteTenantUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ user_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertSuper(context.userId);
    if (data.user_id === context.userId) throw new Error("Eigener Account nicht löschbar.");
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.user_id);
    await supabaseAdmin.from("profiles").delete().eq("id", data.user_id);
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const bulkImportUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    domain_id: z.string().uuid(),
    role: z.enum(["admin", "user"]),
    users: z.array(z.object({
      email: z.string().email().max(255),
      display_name: z.string().min(1).max(120),
      password: z.string().min(8).max(72),
    })).min(1).max(500),
  }).parse(i))
  .handler(async ({ data, context }) => {
    await assertSuper(context.userId);
    const results: { email: string; ok: boolean; error?: string }[] = [];
    for (const u of data.users) {
      try {
        const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
          email: u.email,
          password: u.password,
          email_confirm: true,
          user_metadata: { display_name: u.display_name },
        });
        if (error || !created.user) throw new Error(error?.message ?? "create failed");
        const uid = created.user.id;
        await supabaseAdmin.from("profiles").upsert({
          id: uid, display_name: u.display_name, domain_id: data.domain_id,
        }, { onConflict: "id" });
        await supabaseAdmin.from("user_roles").delete().eq("user_id", uid);
        await supabaseAdmin.from("user_roles").insert({
          user_id: uid, role: data.role, domain_id: data.domain_id,
        });
        results.push({ email: u.email, ok: true });
      } catch (e: any) {
        results.push({ email: u.email, ok: false, error: e?.message ?? "Fehler" });
      }
    }
    return { results };
  });

// ---------- SuperAdmin stats ----------

export const getSuperAdminStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuper(context.userId);
    const now = new Date();
    const in30 = new Date(now.getTime() + 30 * 24 * 3600 * 1000).toISOString();
    const [doms, lics, profs, roles, einsAll, eins24] = await Promise.all([
      supabaseAdmin.from("domains").select("id,status"),
      supabaseAdmin.from("licenses").select("id,status,valid_until,domain_id"),
      supabaseAdmin.from("profiles").select("id,domain_id"),
      supabaseAdmin.from("user_roles").select("user_id,role"),
      supabaseAdmin.from("einsaetze").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("einsaetze").select("id", { count: "exact", head: true })
        .gte("created_at", new Date(now.getTime() - 24 * 3600 * 1000).toISOString()),
    ]);
    const domains = doms.data ?? [];
    const licenses = lics.data ?? [];
    const expiring = licenses.filter((l: any) =>
      l.status === "active" && l.valid_until && l.valid_until < in30 && l.valid_until > now.toISOString());
    const roleCounts: Record<string, number> = {};
    (roles.data ?? []).forEach((r: any) => { roleCounts[r.role] = (roleCounts[r.role] ?? 0) + 1; });
    return {
      domains_active: domains.filter((d: any) => d.status === "active").length,
      domains_disabled: domains.filter((d: any) => d.status === "disabled").length,
      licenses_active: licenses.filter((l: any) => l.status === "active").length,
      licenses_expiring_30d: expiring.length,
      users_total: (profs.data ?? []).length,
      role_counts: roleCounts,
      einsaetze_total: einsAll.count ?? 0,
      einsaetze_24h: eins24.count ?? 0,
    };
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

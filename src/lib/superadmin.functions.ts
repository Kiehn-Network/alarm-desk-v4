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
    await logAudit({ actorId: context.userId, action: "domain.create",
      targetType: "domain", targetId: d.id, targetLabel: d.name,
      metadata: { slug: data.slug } });
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
    await logAudit({ actorId: context.userId, action: "domain.set_status",
      targetType: "domain", targetId: data.id, metadata: { status: data.status } });
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
    await logAudit({ actorId: context.userId, action: "license.create",
      targetType: "license", targetId: row.id,
      metadata: { domain_id: data.domain_id, valid_until: data.valid_until, max_users: data.max_users } });
    return row;
  });

export const revokeLicense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertSuper(context.userId);
    const { error } = await supabaseAdmin.from("licenses").update({ status: "revoked" }).eq("id", data.id);
    if (error) throw new Error(error.message);
    await logAudit({ actorId: context.userId, action: "license.revoke",
      targetType: "license", targetId: data.id });
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
    await logAudit({ actorId: context.userId, action: "license.update",
      targetType: "license", targetId: data.id, metadata: patch });
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
    await logAudit({ actorId: context.userId, action: "module.toggle",
      targetType: "domain_module", targetId: data.domain_id,
      metadata: { module_key: data.module_key, enabled: data.enabled } });
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
    await logAudit({ actorId: context.userId, action: "user.assign",
      targetType: "user", targetId: data.user_id,
      metadata: { role: data.role, domain_id: data.domain_id } });
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
    await logAudit({ actorId: context.userId, action: "user.create",
      targetType: "user", targetId: newUserId, targetLabel: data.email,
      metadata: { role: data.role, domain_id: data.domain_id } });
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
    await logAudit({ actorId: context.userId, action: "impersonation.start",
      targetType: "domain", targetId: data.domain_id });
    return { ok: true };
  });

export const stopImpersonation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuper(context.userId);
    await supabaseAdmin.from("superadmin_impersonation").delete().eq("superadmin_id", context.userId);
    await logAudit({ actorId: context.userId, action: "impersonation.stop" });
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
    await logAudit({ actorId: context.userId, action: "user.password_reset",
      targetType: "user", targetId: data.user_id, targetLabel: email });
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
    await logAudit({ actorId: context.userId, action: data.disabled ? "user.disable" : "user.enable",
      targetType: "user", targetId: data.user_id });
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
    await logAudit({ actorId: context.userId, action: "user.delete",
      targetType: "user", targetId: data.user_id });
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
    await logAudit({ actorId: context.userId, action: "user.bulk_import",
      targetType: "domain", targetId: data.domain_id,
      metadata: { count: data.users.length, role: data.role,
        ok: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).length } });
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

// ---------- Audit Log ----------

export const listAuditLog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    limit: z.number().int().positive().max(500).optional(),
    action: z.string().max(80).nullable().optional(),
    actor_id: z.string().uuid().nullable().optional(),
    since: z.string().datetime().nullable().optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    await assertSuper(context.userId);
    let q = supabaseAdmin.from("superadmin_audit_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 200);
    if (data.action) q = q.eq("action", data.action);
    if (data.actor_id) q = q.eq("actor_id", data.actor_id);
    if (data.since) q = q.gte("created_at", data.since);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { rows: rows ?? [] };
  });

// ---------- Health & E-Mail Queue ----------

export const getHealthSnapshot = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuper(context.userId);
    const started = Date.now();
    const { data: health, error } = await supabaseAdmin.rpc("superadmin_health");
    const dbLatencyMs = Date.now() - started;
    if (error) throw new Error(error.message);
    const { data: jobs } = await supabaseAdmin.rpc("superadmin_cron_jobs");
    return { health, db_latency_ms: dbLatencyMs, cron_jobs: jobs ?? [] };
  });

export const listEmailLog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    limit: z.number().int().positive().max(500).optional(),
    status: z.string().max(40).nullable().optional(),
    template_name: z.string().max(120).nullable().optional(),
    recipient: z.string().max(255).nullable().optional(),
    since: z.string().datetime().nullable().optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    await assertSuper(context.userId);
    let q = supabaseAdmin.from("email_send_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 200);
    if (data.status) q = q.eq("status", data.status);
    if (data.template_name) q = q.eq("template_name", data.template_name);
    if (data.recipient) q = q.ilike("recipient_email", `%${data.recipient}%`);
    if (data.since) q = q.gte("created_at", data.since);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    // dedupe by message_id, latest wins (rows are DESC already)
    const seen = new Set<string>();
    const deduped: any[] = [];
    for (const r of rows ?? []) {
      const key = (r as any).message_id ?? (r as any).id;
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(r);
    }
    return { rows: deduped };
  });

export const retryDlqEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ log_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertSuper(context.userId);
    const { data: row, error } = await supabaseAdmin.from("email_send_log")
      .select("metadata, template_name, recipient_email").eq("id", data.log_id).maybeSingle();
    if (error || !row) throw new Error("E-Mail-Eintrag nicht gefunden");
    const queueName = ((row as any).metadata?.queue_name as string | undefined)
      ?? ((row as any).template_name?.startsWith("auth_") ? "auth_emails" : "transactional_emails");
    const payload = (row as any).metadata?.payload ?? { recipient: (row as any).recipient_email, template: (row as any).template_name };
    const { error: enqErr } = await supabaseAdmin.rpc("enqueue_email", { queue_name: queueName, payload });
    if (enqErr) throw new Error(enqErr.message);
    await logAudit({ actorId: context.userId, action: "email.retry",
      targetType: "email_log", targetId: data.log_id, metadata: { queue: queueName } });
    return { ok: true };
  });

// ---------- Welle 2 · Paket B: Lizenz-Power + Onboarding ----------

export const extendLicenses = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    ids: z.array(z.string().uuid()).min(1).max(500),
    days: z.number().int().positive().max(3650),
  }).parse(i))
  .handler(async ({ data, context }) => {
    await assertSuper(context.userId);
    const { data: rows } = await supabaseAdmin.from("licenses")
      .select("id, valid_until, status").in("id", data.ids);
    const now = new Date();
    let updated = 0;
    for (const r of rows ?? []) {
      const base = (r as any).valid_until ? new Date((r as any).valid_until) : now;
      const startFrom = base.getTime() > now.getTime() ? base : now;
      const next = new Date(startFrom.getTime() + data.days * 86400000).toISOString();
      const patch: { valid_until: string; status?: string } = { valid_until: next };
      if ((r as any).status === "expired") patch.status = "active";
      const { error } = await supabaseAdmin.from("licenses").update(patch).eq("id", (r as any).id);
      if (!error) updated++;
    }
    await logAudit({ actorId: context.userId, action: "license.bulk_extend",
      targetType: "license", metadata: { count: updated, days: data.days } });
    return { ok: true, updated };
  });

export const onboardDomain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/),
    name: z.string().min(1).max(200),
    admin: z.object({
      email: z.string().email().max(255),
      password: z.string().min(8).max(72),
      display_name: z.string().min(1).max(120),
    }),
    license: z.object({
      valid_until: z.string().datetime().nullable().optional(),
      max_users: z.number().int().positive().max(10000).nullable().optional(),
      notes: z.string().max(500).nullable().optional(),
    }).optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    await assertSuper(context.userId);
    const { data: dom, error: derr } = await supabaseAdmin.from("domains")
      .insert({ slug: data.slug, name: data.name }).select().single();
    if (derr) throw new Error(derr.message);
    const { data: mods } = await supabaseAdmin.from("app_modules").select("key, enabled");
    if (mods && mods.length > 0) {
      await supabaseAdmin.from("domain_modules").insert(
        mods.map((m: any) => ({ domain_id: dom.id, module_key: m.key, enabled: m.enabled })),
      );
    }
    const { data: license, error: lerr } = await supabaseAdmin.from("licenses").insert({
      domain_id: dom.id,
      license_key: genLicenseKey(),
      valid_until: data.license?.valid_until ?? null,
      max_users: data.license?.max_users ?? null,
      notes: data.license?.notes ?? null,
      status: "active",
    }).select().single();
    if (lerr) throw new Error(lerr.message);
    const { data: created, error: uerr } = await supabaseAdmin.auth.admin.createUser({
      email: data.admin.email,
      password: data.admin.password,
      email_confirm: true,
      user_metadata: { display_name: data.admin.display_name },
    });
    if (uerr || !created.user) throw new Error(uerr?.message ?? "Konnte Admin nicht anlegen.");
    const uid = created.user.id;
    await supabaseAdmin.from("profiles").upsert({
      id: uid, display_name: data.admin.display_name, domain_id: dom.id,
    }, { onConflict: "id" });
    await supabaseAdmin.from("user_roles").delete().eq("user_id", uid);
    await supabaseAdmin.from("user_roles").insert({ user_id: uid, role: "admin", domain_id: dom.id });
    await logAudit({ actorId: context.userId, action: "domain.onboard",
      targetType: "domain", targetId: dom.id, targetLabel: dom.name,
      metadata: { slug: data.slug, admin_email: data.admin.email, license_id: license.id } });
    return { ok: true, domain: dom, license, admin_user_id: uid };
  });

export const cloneDomain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    source_id: z.string().uuid(),
    new_slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/),
    new_name: z.string().min(1).max(200),
  }).parse(i))
  .handler(async ({ data, context }) => {
    await assertSuper(context.userId);
    const { data: src } = await supabaseAdmin.from("domains").select("*").eq("id", data.source_id).maybeSingle();
    if (!src) throw new Error("Quell-Domain nicht gefunden");
    const { data: dom, error: derr } = await supabaseAdmin.from("domains")
      .insert({ slug: data.new_slug, name: data.new_name }).select().single();
    if (derr) throw new Error(derr.message);
    const { data: srcMods } = await supabaseAdmin.from("domain_modules")
      .select("module_key, enabled").eq("domain_id", data.source_id);
    if (srcMods && srcMods.length > 0) {
      await supabaseAdmin.from("domain_modules").insert(
        srcMods.map((m: any) => ({ domain_id: dom.id, module_key: m.module_key, enabled: m.enabled })),
      );
    }
    await logAudit({ actorId: context.userId, action: "domain.clone",
      targetType: "domain", targetId: dom.id, targetLabel: dom.name,
      metadata: { source_id: data.source_id, modules: srcMods?.length ?? 0 } });
    return { ok: true, domain: dom };
  });

export const sendLicenseExpiryNotices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuper(context.userId);
    return await runExpiryNotices();
  });

// Shared worker used by both the manual server-fn trigger and the public cron route.
export async function runExpiryNotices() {
  const now = new Date();
  const horizonDays = [14, 7, 1];
  const horizonMs = horizonDays.map((d) => d * 86400000);
  const maxMs = Math.max(...horizonMs) + 86400000;
  const { data: lics } = await supabaseAdmin.from("licenses")
    .select("id, domain_id, valid_until, status")
    .eq("status", "active")
    .not("valid_until", "is", null)
    .lt("valid_until", new Date(now.getTime() + maxMs).toISOString())
    .gt("valid_until", now.toISOString());
  if (!lics || lics.length === 0) return { ok: true, sent: 0, checked: 0 };
  let sent = 0;
  for (const l of lics) {
    const left = Math.ceil((new Date((l as any).valid_until).getTime() - now.getTime()) / 86400000);
    const bucket = horizonDays.find((d) => left <= d);
    if (!bucket) continue;
    const tag = `license_expiry_${bucket}d`;
    // de-dupe: skip if we already logged this bucket for this license today
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const { data: dupe } = await supabaseAdmin.from("email_send_log")
      .select("id").eq("template_name", tag)
      .gte("created_at", todayStart)
      .contains("metadata", { license_id: (l as any).id })
      .limit(1).maybeSingle();
    if (dupe) continue;
    // recipients = all admins of the domain
    const { data: roles } = await supabaseAdmin.from("user_roles")
      .select("user_id").eq("domain_id", (l as any).domain_id).eq("role", "admin");
    const userIds = (roles ?? []).map((r: any) => r.user_id);
    if (userIds.length === 0) continue;
    const { data: auth } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const emails = (auth.users ?? []).filter((u) => userIds.includes(u.id)).map((u) => u.email).filter(Boolean) as string[];
    const { data: dom } = await supabaseAdmin.from("domains").select("name").eq("id", (l as any).domain_id).maybeSingle();
    for (const recipient of emails) {
      const payload = {
        recipient,
        template: tag,
        subject: `Lizenz läuft in ${bucket} Tag(en) ab — ${dom?.name ?? ""}`,
        data: {
          domain: dom?.name,
          license_id: (l as any).id,
          valid_until: (l as any).valid_until,
          days_left: bucket,
        },
      };
      const { error: enqErr } = await supabaseAdmin.rpc("enqueue_email", {
        queue_name: "transactional_emails",
        payload,
      });
      // log so we don't resend within the same day
      await supabaseAdmin.from("email_send_log").insert({
        template_name: tag,
        recipient_email: recipient,
        status: enqErr ? "failed" : "pending",
        error_message: enqErr?.message ?? null,
        metadata: { license_id: (l as any).id, domain_id: (l as any).domain_id, days_left: bucket, queue_name: "transactional_emails", payload },
      });
      if (!enqErr) sent++;
    }
  }
  return { ok: true, sent, checked: lics.length };
}

// ---------- Welle 2 · Paket C: Daten-Operationen ----------

export const setDomainArchived = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    id: z.string().uuid(),
    archived: z.boolean(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    await assertSuper(context.userId);
    const newStatus = data.archived ? "archived" : "active";
    const { error } = await supabaseAdmin.from("domains").update({ status: newStatus }).eq("id", data.id);
    if (error) throw new Error(error.message);
    await logAudit({ actorId: context.userId, action: data.archived ? "domain.archive" : "domain.unarchive",
      targetType: "domain", targetId: data.id });
    return { ok: true };
  });

export const globalSearch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    query: z.string().min(1).max(200),
  }).parse(i))
  .handler(async ({ data, context }) => {
    await assertSuper(context.userId);
    const q = data.query.trim();
    const like = `%${q}%`;
    const [dom, lic, prof, auth] = await Promise.all([
      supabaseAdmin.from("domains").select("id, name, slug, status")
        .or(`name.ilike.${like},slug.ilike.${like}`).limit(20),
      supabaseAdmin.from("licenses").select("id, license_key, domain_id, status, valid_until")
        .ilike("license_key", like).limit(20),
      supabaseAdmin.from("profiles").select("id, display_name, domain_id")
        .ilike("display_name", like).limit(20),
      supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    ]);
    const emailMatches = (auth.data.users ?? [])
      .filter((u) => (u.email ?? "").toLowerCase().includes(q.toLowerCase()))
      .slice(0, 20)
      .map((u) => ({ id: u.id, email: u.email }));
    return {
      domains: dom.data ?? [],
      licenses: lic.data ?? [],
      profiles: prof.data ?? [],
      users_by_email: emailMatches,
    };
  });

export const getDomainStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ domain_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertSuper(context.userId);
    const { data: stats, error } = await supabaseAdmin.rpc("superadmin_domain_stats", { _domain_id: data.domain_id });
    if (error) throw new Error(error.message);
    return stats as any;
  });

export const exportDomainData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ domain_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertSuper(context.userId);
    const tables = [
      "domains", "licenses", "domain_modules", "profiles", "user_roles",
      "app_settings", "einsaetze", "einsatz_gruende", "einsatz_historie",
      "dateien", "datei_verknuepfungen", "schluessel_buch",
      "intrahub_posts", "chat_conversations", "chat_messages",
    ];
    const dump: Record<string, any[]> = {};
    for (const t of tables) {
      const filterCol = t === "domains" ? "id" : "domain_id";
      try {
        const { data: rows } = await (supabaseAdmin as any).from(t).select("*").eq(filterCol, data.domain_id).limit(50000);
        dump[t] = rows ?? [];
      } catch { dump[t] = []; }
    }
    await logAudit({ actorId: context.userId, action: "domain.export",
      targetType: "domain", targetId: data.domain_id,
      metadata: { tables: tables.length } });
    return {
      domain_id: data.domain_id,
      generated_at: new Date().toISOString(),
      tables: dump,
    };
  });

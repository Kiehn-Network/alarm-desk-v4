import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireEffectiveDomainId, getEffectiveDomainId } from "@/lib/tenant.server";

const ROLES = ["admin", "dispatcher", "fahrer", "user"] as const;
const roleEnum = z.enum(ROLES);

// Returns the effective domain for the caller. Throws for non-admin callers
// or superadmins that are not currently impersonating any domain.
async function requireDomainAdmin(userId: string): Promise<string> {
  const { data: roles, error } = await supabaseAdmin
    .from("user_roles")
    .select("role, domain_id")
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  const isSuper = (roles ?? []).some((r: any) => r.role === "superadmin");
  const domainId = await getEffectiveDomainId(supabaseAdmin, userId);
  if (isSuper) {
    if (!domainId) throw new Error("Bitte zuerst in eine Domäne wechseln (Impersonation).");
    return domainId;
  }
  const isAdmin = (roles ?? []).some(
    (r: any) => r.role === "admin" && r.domain_id && r.domain_id === domainId,
  );
  if (!isAdmin) throw new Error("Nur Administratoren dürfen diese Aktion ausführen");
  if (!domainId) throw new Error("Keine Domäne zugewiesen");
  return domainId;
}

// Ensures the target user belongs to the admin's domain (or is unassigned).
async function assertUserInDomain(userId: string, domainId: string) {
  const { data } = await supabaseAdmin
    .from("profiles").select("domain_id").eq("id", userId).maybeSingle();
  if (!data || data.domain_id !== domainId) {
    throw new Error("Nutzer gehört nicht zu deiner Domäne");
  }
}

// ---------- Support PIN ----------

export const getSupportPin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const domainId = await requireDomainAdmin(context.userId);
    const { data } = await supabaseAdmin.from("domains")
      .select("support_pin").eq("id", domainId).maybeSingle();
    return { pin: (data as any)?.support_pin ?? null, domain_id: domainId };
  });

export const regenerateSupportPin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const domainId = await requireDomainAdmin(context.userId);
    const { data, error } = await supabaseAdmin.rpc("regenerate_support_pin", { _domain_id: domainId });
    if (error) throw new Error(error.message);
    return { pin: data as unknown as string };
  });

// Returns active forced impersonation row targeting the admin's domain (if any)
export const getForcedImpersonation = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const domainId = await requireDomainAdmin(context.userId);
    const { data } = await supabaseAdmin.from("superadmin_impersonation")
      .select("superadmin_id, started_at, reason, forced")
      .eq("target_domain_id", domainId).eq("forced", true).maybeSingle();
    if (!data) return { active: false as const };
    const { data: u } = await supabaseAdmin.auth.admin.getUserById((data as any).superadmin_id);
    return {
      active: true as const,
      started_at: (data as any).started_at,
      reason: (data as any).reason,
      superadmin_email: u.user?.email ?? null,
    };
  });

export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const domainId = await requireDomainAdmin(context.userId);
    // Only profiles within this domain.
    const { data: profiles } = await supabaseAdmin
      .from("profiles").select("id, display_name, avatar_url, einsatz_selectable").eq("domain_id", domainId);
    const ids = (profiles ?? []).map((p: any) => p.id);
    if (ids.length === 0) return { users: [] };
    const { data: roles } = await supabaseAdmin
      .from("user_roles").select("user_id, role, domain_id").in("user_id", ids);
    const { data: authData } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const authMap = Object.fromEntries((authData?.users ?? []).map((u: any) => [u.id, u]));
    const profMap = Object.fromEntries((profiles ?? []).map((p: any) => [p.id, p]));
    const roleMap: Record<string, string[]> = {};
    (roles ?? []).forEach((r: any) => {
      // Only surface roles tied to this domain.
      if (!r.domain_id || r.domain_id === domainId) {
        (roleMap[r.user_id] ||= []).push(r.role);
      }
    });
    return {
      users: ids.map((id) => {
        const u: any = authMap[id] ?? {};
        return {
          id,
          email: u.email ?? "",
          created_at: u.created_at ?? null,
          last_sign_in_at: u.last_sign_in_at ?? null,
          banned_until: u.banned_until ?? null,
          display_name: profMap[id]?.display_name ?? null,
          avatar_url: profMap[id]?.avatar_url ?? null,
          einsatz_selectable: (profMap[id] as any)?.einsatz_selectable !== false,
          roles: roleMap[id] ?? [],
        };
      }),
    };
  });

export const createUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      email: z.string().email().max(255),
      password: z.string().min(8).max(72),
      display_name: z.string().trim().min(1).max(120),
      role: roleEnum,
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const domainId = await requireDomainAdmin(context.userId);
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { display_name: data.display_name },
    });
    if (error) throw new Error(error.message);
    const uid = created.user!.id;
    // Bind user to caller's domain and replace default trigger role.
    await supabaseAdmin.from("profiles").update({
      display_name: data.display_name, domain_id: domainId,
    }).eq("id", uid);
    await supabaseAdmin.from("user_roles").delete().eq("user_id", uid);
    const { error: rErr } = await supabaseAdmin.from("user_roles").insert({
      user_id: uid, role: data.role, domain_id: domainId,
    });
    if (rErr) throw new Error(rErr.message);
    return { id: uid };
  });

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ user_id: z.string().uuid(), role: roleEnum }).parse(i))
  .handler(async ({ data, context }) => {
    const domainId = await requireDomainAdmin(context.userId);
    await assertUserInDomain(data.user_id, domainId);
    // Never let a domain admin grant superadmin via this endpoint.
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.user_id);
    const { error } = await supabaseAdmin.from("user_roles").insert({
      user_id: data.user_id, role: data.role, domain_id: domainId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateUserProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      user_id: z.string().uuid(),
      display_name: z.string().trim().min(1).max(120),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const domainId = await requireDomainAdmin(context.userId);
    await assertUserInDomain(data.user_id, domainId);
    const { error } = await supabaseAdmin
      .from("profiles").update({ display_name: data.display_name }).eq("id", data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setUserEinsatzSelectable = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    user_id: z.string().uuid(),
    selectable: z.boolean(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const domainId = await requireDomainAdmin(context.userId);
    await assertUserInDomain(data.user_id, domainId);
    const { error } = await (supabaseAdmin as any)
      .from("profiles")
      .update({ einsatz_selectable: data.selectable })
      .eq("id", data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const resetUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ user_id: z.string().uuid(), password: z.string().min(8).max(72) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const domainId = await requireDomainAdmin(context.userId);
    await assertUserInDomain(data.user_id, domainId);
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, { password: data.password });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ user_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const domainId = await requireDomainAdmin(context.userId);
    if (data.user_id === context.userId) throw new Error("Du kannst dich nicht selbst löschen");
    await assertUserInDomain(data.user_id, domainId);
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const impersonateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ user_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const domainId = await requireDomainAdmin(context.userId);
    if (data.user_id === context.userId) throw new Error("Du bist bereits angemeldet");
    await assertUserInDomain(data.user_id, domainId);
    const { data: target, error: uErr } = await supabaseAdmin.auth.admin.getUserById(data.user_id);
    if (uErr || !target.user?.email) throw new Error(uErr?.message ?? "Benutzer nicht gefunden");
    const { data: link, error: lErr } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink", email: target.user.email,
    });
    if (lErr) throw new Error(lErr.message);
    const hashed = (link as any)?.properties?.hashed_token;
    if (!hashed) throw new Error("Token konnte nicht erzeugt werden");
    return { token_hash: hashed as string, email: target.user.email };
  });

// Einsatzgründe management — strictly scoped to caller's domain.
export const listAllGruende = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const domainId = await requireDomainAdmin(context.userId);
    const { data, error } = await supabaseAdmin
      .from("einsatz_gruende").select("*").eq("domain_id", domainId).order("name");
    if (error) throw new Error(error.message);
    return { gruende: data ?? [] };
  });

export const upsertGrund = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      id: z.string().uuid().optional(),
      name: z.string().trim().min(1).max(200),
      aktiv: z.boolean().default(true),
      einsatz_typ: z.enum(["av_einsatz", "hausnotruf"]).nullable().optional(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const domainId = await requireDomainAdmin(context.userId);
    if (data.id) {
      // Verify the Grund belongs to caller's domain before updating.
      const { data: existing } = await supabaseAdmin
        .from("einsatz_gruende").select("domain_id").eq("id", data.id).maybeSingle();
      if (!existing || existing.domain_id !== domainId) {
        throw new Error("Eintrag gehört nicht zu deiner Domäne");
      }
      const { error } = await supabaseAdmin
        .from("einsatz_gruende").update({ name: data.name, aktiv: data.aktiv, einsatz_typ: data.einsatz_typ ?? null } as any).eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin
        .from("einsatz_gruende").insert({
          name: data.name, aktiv: data.aktiv, created_by: context.userId, domain_id: domainId,
          einsatz_typ: data.einsatz_typ ?? null,
        } as any);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const deleteGrund = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const domainId = await requireDomainAdmin(context.userId);
    const { data: existing } = await supabaseAdmin
      .from("einsatz_gruende").select("domain_id").eq("id", data.id).maybeSingle();
    if (!existing || existing.domain_id !== domainId) {
      throw new Error("Eintrag gehört nicht zu deiner Domäne");
    }
    const { error } = await supabaseAdmin.from("einsatz_gruende").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Stats — scoped to caller's domain.
export const adminStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const domainId = await requireDomainAdmin(context.userId);
    const [profilesR, rolesR, dateienR, einsaetzeR, gruendeR] = await Promise.all([
      supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }).eq("domain_id", domainId),
      supabaseAdmin.from("user_roles").select("role, domain_id").eq("domain_id", domainId),
      supabaseAdmin.from("dateien").select("id", { count: "exact", head: true }).eq("domain_id", domainId).is("deleted_at", null),
      supabaseAdmin.from("einsaetze").select("status").eq("domain_id", domainId),
      supabaseAdmin.from("einsatz_gruende").select("id", { count: "exact", head: true }).eq("domain_id", domainId),
    ]);
    const byRole: Record<string, number> = { admin: 0, dispatcher: 0, fahrer: 0, user: 0 };
    (rolesR.data ?? []).forEach((r: any) => { byRole[r.role] = (byRole[r.role] ?? 0) + 1; });
    const byStatus: Record<string, number> = {};
    (einsaetzeR.data ?? []).forEach((e: any) => { byStatus[e.status] = (byStatus[e.status] ?? 0) + 1; });
    return {
      totalUsers: profilesR.count ?? 0,
      byRole,
      dateienCount: dateienR.count ?? 0,
      einsaetzeTotal: (einsaetzeR.data ?? []).length,
      einsaetzeByStatus: byStatus,
      gruendeCount: gruendeR.count ?? 0,
    };
  });

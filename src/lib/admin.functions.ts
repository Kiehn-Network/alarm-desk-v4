import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireEffectiveDomainId } from "@/lib/tenant.server";

const ROLES = ["admin", "dispatcher", "fahrer"] as const;
const roleEnum = z.enum(ROLES);

async function assertAdmin(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Nur Administratoren dürfen diese Aktion ausführen");
}

export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (authErr) throw new Error(authErr.message);
    const users = authData.users ?? [];
    const ids = users.map((u) => u.id);
    const { data: profiles } = await supabaseAdmin
      .from("profiles").select("id, display_name, avatar_url").in("id", ids);
    const { data: roles } = await supabaseAdmin
      .from("user_roles").select("user_id, role").in("user_id", ids);
    const profMap = Object.fromEntries((profiles ?? []).map((p: any) => [p.id, p]));
    const roleMap: Record<string, string[]> = {};
    (roles ?? []).forEach((r: any) => {
      (roleMap[r.user_id] ||= []).push(r.role);
    });
    return {
      users: users.map((u) => ({
        id: u.id,
        email: u.email ?? "",
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at,
        banned_until: (u as any).banned_until ?? null,
        display_name: profMap[u.id]?.display_name ?? null,
        avatar_url: profMap[u.id]?.avatar_url ?? null,
        roles: roleMap[u.id] ?? [],
      })),
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
    await assertAdmin(context.userId);
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { display_name: data.display_name },
    });
    if (error) throw new Error(error.message);
    const uid = created.user!.id;
    // handle_new_user trigger inserts a default role; replace it with the chosen one.
    await supabaseAdmin.from("user_roles").delete().eq("user_id", uid);
    const { error: rErr } = await supabaseAdmin.from("user_roles").insert({ user_id: uid, role: data.role });
    if (rErr) throw new Error(rErr.message);
    await supabaseAdmin.from("profiles").update({ display_name: data.display_name }).eq("id", uid);
    return { id: uid };
  });

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ user_id: z.string().uuid(), role: roleEnum }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.user_id);
    const { error } = await supabaseAdmin.from("user_roles").insert({ user_id: data.user_id, role: data.role });
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
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("profiles").update({ display_name: data.display_name }).eq("id", data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const resetUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ user_id: z.string().uuid(), password: z.string().min(8).max(72) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, { password: data.password });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ user_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    if (data.user_id === context.userId) throw new Error("Du kannst dich nicht selbst löschen");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const impersonateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ user_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    if (data.user_id === context.userId) {
      throw new Error("Du bist bereits angemeldet");
    }
    const { data: target, error: uErr } = await supabaseAdmin.auth.admin.getUserById(data.user_id);
    if (uErr || !target.user?.email) {
      throw new Error(uErr?.message ?? "Benutzer nicht gefunden");
    }
    const { data: link, error: lErr } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: target.user.email,
    });
    if (lErr) throw new Error(lErr.message);
    const hashed = (link as any)?.properties?.hashed_token;
    if (!hashed) throw new Error("Token konnte nicht erzeugt werden");
    return { token_hash: hashed as string, email: target.user.email };
  });

// Einsatzgründe management
export const listAllGruende = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data, error } = await supabaseAdmin
      .from("einsatz_gruende").select("*").order("name");
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
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    if (data.id) {
      const { error } = await supabaseAdmin
        .from("einsatz_gruende").update({ name: data.name, aktiv: data.aktiv }).eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const domainId = await requireEffectiveDomainId(supabaseAdmin, context.userId);
      const { error } = await supabaseAdmin
        .from("einsatz_gruende").insert({ name: data.name, aktiv: data.aktiv, created_by: context.userId, domain_id: domainId });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const deleteGrund = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin.from("einsatz_gruende").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Stats
export const adminStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const [usersR, rolesR, dateienR, einsaetzeR, gruendeR] = await Promise.all([
      supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1 }),
      supabaseAdmin.from("user_roles").select("role"),
      supabaseAdmin.from("dateien").select("id", { count: "exact", head: true }).is("deleted_at", null),
      supabaseAdmin.from("einsaetze").select("status"),
      supabaseAdmin.from("einsatz_gruende").select("id", { count: "exact", head: true }),
    ]);
    const byRole: Record<string, number> = { admin: 0, dispatcher: 0, fahrer: 0 };
    (rolesR.data ?? []).forEach((r: any) => { byRole[r.role] = (byRole[r.role] ?? 0) + 1; });
    const byStatus: Record<string, number> = {};
    (einsaetzeR.data ?? []).forEach((e: any) => { byStatus[e.status] = (byStatus[e.status] ?? 0) + 1; });
    return {
      totalUsers: (usersR.data as any)?.total ?? (usersR.data?.users?.length ?? 0),
      byRole,
      dateienCount: dateienR.count ?? 0,
      einsaetzeTotal: (einsaetzeR.data ?? []).length,
      einsaetzeByStatus: byStatus,
      gruendeCount: gruendeR.count ?? 0,
    };
  });
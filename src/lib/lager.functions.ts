import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireEffectiveDomainId } from "@/lib/tenant.server";

// =================================================================
// LAGER — Personen, Artikel, Buchungen und Lager-Admins
// =================================================================

export type LagerPerson = {
  id: string;
  name: string;
  personalnummer: string | null;
  transponder_id: string;
  aktiv: boolean;
  notiz: string | null;
  rolle?: string | null;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
};

export type LagerArtikel = {
  id: string;
  domain_id: string;
  bezeichnung: string;
  beschreibung: string | null;
  barcode: string;
  barcode_generiert: boolean;
  einheit: string;
  lagerort: string | null;
  bestand: number;
  mindestbestand: number;
  alarm_email: string | null;
  aktiv: boolean;
  last_alert_at: string | null;
  created_at: string;
  updated_at: string;
};

export type LagerBuchung = {
  id: string;
  artikel_id: string;
  artikel_bezeichnung?: string | null;
  domain_id: string;
  person_id: string | null;
  person_name: string | null;
  richtung: "eingang" | "ausgang";
  menge: number;
  bestand_nachher: number;
  signatur: string | null;
  notiz: string | null;
  created_at: string;
};

function normalizeTransponder(value: unknown) {
  return String(value ?? "").trim().toUpperCase();
}

async function lagerAdminContext(context: { supabase: any; userId: string }) {
  const domainId = await requireEffectiveDomainId(context.supabase, context.userId);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [{ data: roles }, { data: lagerAdmin }] = await Promise.all([
    supabaseAdmin.from("user_roles").select("role,domain_id").eq("user_id", context.userId),
    (supabaseAdmin as any).from("lager_admins").select("id").eq("domain_id", domainId).eq("user_id", context.userId).maybeSingle(),
  ]);
  const isDomainAdmin = (roles ?? []).some((r: any) =>
    r.role === "admin" && r.domain_id === domainId,
  ) || (roles ?? []).some((r: any) => r.role === "superadmin");
  if (!isDomainAdmin && !lagerAdmin) throw new Error("Nur Lager-Admins dürfen diese Aktion ausführen.");
  return { domainId, supabaseAdmin, isDomainAdmin };
}

async function domainAdminContext(context: { supabase: any; userId: string }) {
  const domainId = await requireEffectiveDomainId(context.supabase, context.userId);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: roles } = await supabaseAdmin.from("user_roles").select("role,domain_id").eq("user_id", context.userId);
  const allowed = (roles ?? []).some((r: any) => r.role === "superadmin") ||
    (roles ?? []).some((r: any) => r.role === "admin" && r.domain_id === domainId);
  if (!allowed) throw new Error("Nur Domänen-Administratoren dürfen Lager-Admins verwalten.");
  return { domainId, supabaseAdmin };
}

export const listLagerPersonen = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const domainId = await requireEffectiveDomainId(context.supabase, context.userId);
    const { data, error } = await context.supabase.from("lager_personen").select("*").eq("domain_id", domainId).order("name");
    if (error) throw new Error(error.message);
    return { rows: (data ?? []) as LagerPerson[] };
  });

export const upsertLagerPerson = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id?: string; name: string; personalnummer?: string | null; transponder_id: string; aktiv?: boolean; notiz?: string | null }) => input)
  .handler(async ({ data, context }) => {
    const domainId = await requireEffectiveDomainId(context.supabase, context.userId);
    const name = String(data.name ?? "").trim();
    const transponder = normalizeTransponder(data.transponder_id);
    if (!name) throw new Error("Bitte einen Namen angeben.");
    if (!transponder) throw new Error("Bitte eine Transponder-Nummer erfassen.");
    const payload = { domain_id: domainId, name, personalnummer: data.personalnummer?.toString().trim() || null, transponder_id: transponder, aktiv: data.aktiv ?? true, notiz: data.notiz?.toString().trim() || null, rolle: "technik" };
    if (data.id) {
      const { error } = await context.supabase.from("lager_personen").update(payload).eq("id", data.id).eq("domain_id", domainId);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: inserted, error } = await context.supabase.from("lager_personen").insert(payload).select("id").single();
    if (error) throw new Error(error.code === "23505" ? "Diese Transponder-Nummer ist bereits vergeben." : error.message);
    return { id: inserted.id as string };
  });

export const deleteLagerPerson = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const domainId = await requireEffectiveDomainId(context.supabase, context.userId);
    const { error } = await context.supabase.from("lager_personen").delete().eq("id", data.id).eq("domain_id", domainId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const lagerTransponderLogin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { transponder_id: string }) => input)
  .handler(async ({ data, context }) => {
    const domainId = await requireEffectiveDomainId(context.supabase, context.userId);
    const transponder = normalizeTransponder(data.transponder_id);
    const { data: person, error } = await context.supabase.from("lager_personen").select("*").eq("domain_id", domainId).eq("transponder_id", transponder).maybeSingle();
    if (error) throw new Error(error.message);
    if (!person) throw new Error("Transponder unbekannt. Bitte beim Administrator melden.");
    if (!person.aktiv) throw new Error("Dieser Transponder ist gesperrt.");
    await context.supabase.from("lager_personen").update({ last_login_at: new Date().toISOString() }).eq("id", person.id).eq("domain_id", domainId);
    return { person: person as LagerPerson };
  });

export const listLagerArtikel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const domainId = await requireEffectiveDomainId(context.supabase, context.userId);
    const { data, error } = await context.supabase.from("lager_artikel").select("*").eq("domain_id", domainId).order("bezeichnung");
    if (error) throw new Error(error.message);
    return { rows: (data ?? []) as LagerArtikel[] };
  });

export const upsertLagerArtikel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id?: string; bezeichnung: string; beschreibung?: string | null; barcode: string; barcode_generiert?: boolean; einheit?: string; lagerort?: string | null; bestand?: number; mindestbestand?: number; alarm_email?: string | null; aktiv?: boolean }) => input)
  .handler(async ({ data, context }) => {
    const { domainId, supabaseAdmin } = await lagerAdminContext(context);
    const bezeichnung = data.bezeichnung.trim();
    const barcode = data.barcode.trim().toUpperCase();
    if (!bezeichnung) throw new Error("Bitte eine Artikelbezeichnung angeben.");
    if (!barcode) throw new Error("Bitte einen Barcode angeben oder generieren.");
    const payload = { domain_id: domainId, bezeichnung, beschreibung: data.beschreibung?.trim() || null, barcode, barcode_generiert: data.barcode_generiert ?? false, einheit: data.einheit?.trim() || "Stk", lagerort: data.lagerort?.trim() || null, bestand: Math.max(0, Math.trunc(Number(data.bestand ?? 0))), mindestbestand: Math.max(0, Math.trunc(Number(data.mindestbestand ?? 0))), alarm_email: data.alarm_email?.trim() || null, aktiv: data.aktiv ?? true };
    const query = data.id
      ? supabaseAdmin.from("lager_artikel").update(payload).eq("id", data.id).eq("domain_id", domainId)
      : supabaseAdmin.from("lager_artikel").insert(payload);
    const { error } = await query;
    if (error) throw new Error(error.code === "23505" ? "Dieser Barcode ist in der Domäne bereits vergeben." : error.message);
    return { ok: true };
  });

export const deleteLagerArtikel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { domainId, supabaseAdmin } = await lagerAdminContext(context);
    const { error } = await supabaseAdmin.from("lager_artikel").delete().eq("id", data.id).eq("domain_id", domainId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listLagerBuchungen = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { artikel_id?: string }) => input)
  .handler(async ({ data, context }) => {
    const { domainId, supabaseAdmin } = await lagerAdminContext(context);
    let query = supabaseAdmin.from("lager_buchungen").select("*, lager_artikel(bezeichnung)").eq("domain_id", domainId).order("created_at", { ascending: false }).limit(100);
    if (data.artikel_id) query = query.eq("artikel_id", data.artikel_id);
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return { rows: (rows ?? []).map((r: any) => ({ ...r, artikel_bezeichnung: r.lager_artikel?.bezeichnung ?? null })) as LagerBuchung[] };
  });

export const getLagerSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const domainId = await requireEffectiveDomainId(context.supabase, context.userId);
    const { data, error } = await context.supabase.from("lager_settings").select("alarm_email,alarm_aktiv").eq("domain_id", domainId).maybeSingle();
    if (error) throw new Error(error.message);
    return { alarm_email: data?.alarm_email ?? "", alarm_aktiv: data?.alarm_aktiv !== false };
  });

export const saveLagerSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { alarm_email?: string | null; alarm_aktiv: boolean }) => input)
  .handler(async ({ data, context }) => {
    const { domainId, supabaseAdmin } = await lagerAdminContext(context);
    const { error } = await supabaseAdmin.from("lager_settings").upsert({ domain_id: domainId, alarm_email: data.alarm_email?.trim() || null, alarm_aktiv: data.alarm_aktiv }, { onConflict: "domain_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listLagerAdmins = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { domainId, supabaseAdmin } = await domainAdminContext(context);
    const { data, error } = await (supabaseAdmin as any).from("lager_admins").select("id,user_id,created_at").eq("domain_id", domainId).order("created_at");
    if (error) throw new Error(error.message);
    const ids = (data ?? []).map((r: any) => r.user_id);
    const { data: profiles } = await supabaseAdmin.from("profiles").select("id,display_name").in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
    const names = Object.fromEntries((profiles ?? []).map((p: any) => [p.id, p.display_name]));
    return { rows: (data ?? []).map((r: any) => ({ ...r, display_name: names[r.user_id] ?? "Unbekannt" })) };
  });

export const setLagerAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { user_id: string; enabled: boolean }) => input)
  .handler(async ({ data, context }) => {
    const { domainId, supabaseAdmin } = await domainAdminContext(context);
    const { data: profile } = await supabaseAdmin.from("profiles").select("id").eq("id", data.user_id).eq("domain_id", domainId).maybeSingle();
    if (!profile) throw new Error("Benutzer gehört nicht zu deiner Domäne.");
    const table = (supabaseAdmin as any).from("lager_admins");
    const result = data.enabled
      ? await table.upsert({ domain_id: domainId, user_id: data.user_id }, { onConflict: "domain_id,user_id" })
      : await table.delete().eq("domain_id", domainId).eq("user_id", data.user_id);
    if (result.error) throw new Error(result.error.message);
    return { ok: true };
  });

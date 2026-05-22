import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireEffectiveDomainId } from "@/lib/tenant.server";
import { enqueueErpForEinsatz } from "@/lib/esrp.server";

async function maybeAutoErp(einsatzId: string, domainId: string, userId: string) {
  try {
    const { data: s } = await supabaseAdmin
      .from("erp_settings").select("aktiv,auto_on_abschluss")
      .eq("domain_id", domainId).maybeSingle();
    if (!s?.aktiv || !s?.auto_on_abschluss) return;
    await enqueueErpForEinsatz({ einsatz_id: einsatzId, domain_id: domainId, created_by: userId });
  } catch { /* best effort */ }
}

const prioritaet = z.enum(["niedrig", "normal", "hoch", "kritisch"]);

const createSchema = z.object({
  einsatzgrund: z.string().trim().min(1).max(200),
  einsatzgrund_id: z.string().uuid().optional().nullable(),
  einsatz_typ: z.enum(["av_einsatz", "hausnotruf"]).optional(),
  hausnotruf_provider: z.enum(["malteser", "johanniter", "lgwa"]).optional().nullable(),
  kunden_name: z.string().max(200).optional().nullable(),
  address: z.string().max(255).optional().nullable(),
  key_number: z.string().max(100).optional().nullable(),
  anlagen_nr: z.string().max(100).optional().nullable(),
  teilnehmer_id: z.string().max(100).optional().nullable(),
  beschreibung: z.string().max(4000).optional().nullable(),
  assigned_to: z.string().uuid(),
  datei_id: z.string().uuid().optional().nullable(),
});

const updateSchema = createSchema.partial().extend({ id: z.string().uuid() });

const isoOrNull = z.union([z.string().datetime({ offset: true }), z.literal("")]).optional().nullable();

const editSchema = z.object({
  id: z.string().uuid(),
  einsatzgrund: z.string().trim().min(1).max(200).optional(),
  kunden_name: z.string().max(200).optional().nullable(),
  address: z.string().max(255).optional().nullable(),
  key_number: z.string().max(100).optional().nullable(),
  anlagen_nr: z.string().max(100).optional().nullable(),
  teilnehmer_id: z.string().max(100).optional().nullable(),
  beschreibung: z.string().max(4000).optional().nullable(),
  assigned_to: z.string().uuid().optional().nullable(),
  status: z.enum(["in_bearbeitung", "abgeschlossen"]).optional(),
  vor_ort_am: isoOrNull,
  abfahrt_am: isoOrNull,
  einsatz_ende_am: isoOrNull,
  abgeschlossen_am: isoOrNull,
});

const TRACKABLE = [
  "einsatzgrund","kunden_name","address","key_number","anlagen_nr",
  "teilnehmer_id","prioritaet","beschreibung","geplant_am","status",
  "assigned_to","ablehnung_grund","approved_by","abgeschlossen_am",
  "vor_ort_am","abfahrt_am","einsatz_ende_am",
  "bericht_typ","hausnotruf_problem","hausnotruf_loesung",
] as const;

async function logHistory(
  supabase: any,
  userId: string,
  einsatzId: string,
  before: Record<string, any>,
  patch: Record<string, any>,
  domainId: string,
) {
  const entries = TRACKABLE.filter((k) => k in patch)
    .map((k) => ({
      einsatz_id: einsatzId,
      field_name: k,
      old_value: before?.[k] != null ? String(before[k]) : null,
      new_value: (patch as any)[k] != null ? String((patch as any)[k]) : null,
      changed_by: userId,
      domain_id: domainId,
    }))
    .filter((e) => (e.old_value ?? null) !== (e.new_value ?? null));
  if (entries.length > 0) await supabase.from("einsatz_historie").insert(entries);
}

export const listEinsaetze = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("einsaetze").select("*")
      .order("created_at", { ascending: false }).limit(500);
    if (error) throw new Error(error.message);

    const ids = new Set<string>();
    (data ?? []).forEach((e: any) => {
      if (e.created_by) ids.add(e.created_by);
      if (e.approved_by) ids.add(e.approved_by);
      if (e.assigned_to) ids.add(e.assigned_to);
    });
    let profiles: Record<string, string> = {};
    if (ids.size > 0) {
      const { data: ps } = await supabase
        .from("profiles").select("id, display_name").in("id", Array.from(ids));
      profiles = Object.fromEntries((ps ?? []).map((p: any) => [p.id, p.display_name ?? ""]));
    }
    return { einsaetze: data ?? [], profiles };
  });

export const listMeineEinsaetze = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("einsaetze").select("*")
      .eq("assigned_to", userId)
      .order("created_at", { ascending: false }).limit(200);
    if (error) throw new Error(error.message);
    const ids = new Set<string>();
    (data ?? []).forEach((e: any) => {
      if (e.created_by) ids.add(e.created_by);
    });
    let profiles: Record<string, string> = {};
    if (ids.size > 0) {
      const { data: ps } = await supabase
        .from("profiles").select("id, display_name").in("id", Array.from(ids));
      profiles = Object.fromEntries((ps ?? []).map((p: any) => [p.id, p.display_name ?? ""]));
    }
    return { einsaetze: data ?? [], profiles };
  });

export const listEinsatzGruende = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("einsatz_gruende").select("*").eq("aktiv", true).order("name");
    if (error) throw new Error(error.message);
    return { gruende: data ?? [] };
  });

export const createEinsatzGrund = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ name: z.string().trim().min(1).max(200) }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const domainId = await requireEffectiveDomainId(supabase, userId);
    const { data: row, error } = await supabase
      .from("einsatz_gruende")
      .insert({ name: data.name, created_by: userId, domain_id: domainId })
      .select().single();
    if (error) throw new Error(error.message);
    return row;
  });

export const createEinsatz = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => createSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const domainId = await requireEffectiveDomainId(supabase, userId);
    const payload: any = {
      einsatzgrund: data.einsatzgrund,
      einsatzgrund_id: data.einsatzgrund_id ?? null,
      einsatz_typ: data.einsatz_typ ?? "av_einsatz",
      hausnotruf_provider: (data.einsatz_typ === "hausnotruf" ? (data.hausnotruf_provider ?? null) : null),
      kunden_name: data.kunden_name ?? null,
      address: data.address ?? null,
      key_number: data.key_number ?? null,
      anlagen_nr: data.anlagen_nr ?? null,
      teilnehmer_id: data.teilnehmer_id ?? null,
      beschreibung: data.beschreibung ?? null,
      prioritaet: "normal",
      status: "in_bearbeitung",
      created_by: userId,
      domain_id: domainId,
      assigned_to: data.assigned_to,
      assigned_at: new Date().toISOString(),
      approved_by: userId,
      approved_at: new Date().toISOString(),
    };
    const { data: row, error } = await supabase
      .from("einsaetze").insert(payload).select().single();
    if (error) throw new Error(error.message);
    await supabase.from("einsatz_historie").insert({
      einsatz_id: row.id, field_name: "status",
      old_value: null, new_value: row.status, changed_by: userId,
      domain_id: domainId,
    });
    return row;
  });

export const updateEinsatz = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => updateSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const domainId = await requireEffectiveDomainId(supabase, userId);
    const { id, ...patch } = data;
    const { data: before, error: bErr } = await supabase
      .from("einsaetze").select("*").eq("id", id).single();
    if (bErr) throw new Error(bErr.message);
    const cleanPatch: any = { ...patch };
    if (cleanPatch.geplant_am === "") cleanPatch.geplant_am = null;
    const { data: row, error } = await supabase
      .from("einsaetze").update(cleanPatch).eq("id", id).select().single();
    if (error) throw new Error(error.message);
    await logHistory(supabase, userId, id, before, cleanPatch, domainId);
    return row;
  });

export const editEinsatzFull = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => editSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const domainId = await requireEffectiveDomainId(supabase, userId);
    // Nur Admin/Dispatcher/Superadmin dürfen Einsätze vollständig bearbeiten
    const { data: roles } = await supabaseAdmin
      .from("user_roles").select("role").eq("user_id", userId);
    const canEdit = (roles ?? []).some((r: any) =>
      r.role === "admin" || r.role === "dispatcher" || r.role === "superadmin");
    if (!canEdit) throw new Error("Keine Berechtigung");

    const { id, ...rest } = data;
    const { data: before, error: bErr } = await supabase
      .from("einsaetze").select("*").eq("id", id).single();
    if (bErr) throw new Error(bErr.message);

    const patch: any = {};
    for (const [k, v] of Object.entries(rest)) {
      if (v === undefined) continue;
      patch[k] = v === "" ? null : v;
    }
    // Status-bezogene Zeitfelder automatisch pflegen
    if (patch.status === "abgeschlossen" && !patch.abgeschlossen_am && !before?.abgeschlossen_am) {
      patch.abgeschlossen_am = new Date().toISOString();
    }
    if (patch.status === "in_bearbeitung" && before?.status === "abgeschlossen") {
      // Reaktivieren: Abschluss-Zeitstempel entfernen, wenn nicht explizit gesetzt
      if (patch.abgeschlossen_am === undefined) patch.abgeschlossen_am = null;
    }

    const { data: row, error } = await supabase
      .from("einsaetze").update(patch).eq("id", id).select().single();
    if (error) throw new Error(error.message);
    await logHistory(supabase, userId, id, before ?? {}, patch, domainId);
    if (patch.status === "abgeschlossen" && before?.status !== "abgeschlossen") {
      await maybeAutoErp(id, domainId, userId);
    }
    return row;
  });

export const freigebenEinsatz = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const domainId = await requireEffectiveDomainId(supabase, userId);
    const { data: before } = await supabase
      .from("einsaetze").select("*").eq("id", data.id).single();
    const patch = { status: "freigegeben" as const, approved_by: userId, approved_at: new Date().toISOString(), ablehnung_grund: null };
    const { data: row, error } = await supabase
      .from("einsaetze").update(patch).eq("id", data.id).select().single();
    if (error) throw new Error(error.message);
    await logHistory(supabase, userId, data.id, before ?? {}, patch, domainId);
    return row;
  });

export const ablehnenEinsatz = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid(), grund: z.string().trim().min(1).max(1000) }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const domainId = await requireEffectiveDomainId(supabase, userId);
    const { data: before } = await supabase
      .from("einsaetze").select("*").eq("id", data.id).single();
    const patch = { status: "abgelehnt" as const, approved_by: userId, approved_at: new Date().toISOString(), ablehnung_grund: data.grund };
    const { data: row, error } = await supabase
      .from("einsaetze").update(patch).eq("id", data.id).select().single();
    if (error) throw new Error(error.message);
    await logHistory(supabase, userId, data.id, before ?? {}, patch, domainId);
    return row;
  });

export const zuweisenEinsatz = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid(), fahrer_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const domainId = await requireEffectiveDomainId(supabase, userId);
    const { data: before } = await supabase
      .from("einsaetze").select("*").eq("id", data.id).single();
    if (!before || before.status !== "freigegeben") {
      throw new Error("Nur freigegebene Einsätze können zugewiesen werden");
    }
    const patch = { assigned_to: data.fahrer_id, assigned_at: new Date().toISOString(), status: "in_bearbeitung" as const };
    const { data: row, error } = await supabase
      .from("einsaetze").update(patch).eq("id", data.id).select().single();
    if (error) throw new Error(error.message);
    await logHistory(supabase, userId, data.id, before, patch, domainId);
    return row;
  });

export const abschliessenEinsatz = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const domainId = await requireEffectiveDomainId(supabase, userId);
    const { data: before } = await supabase
      .from("einsaetze").select("*").eq("id", data.id).single();
    const now = new Date().toISOString();
    const patch: any = { status: "abgeschlossen", abgeschlossen_am: now };
    if (!before?.einsatz_ende_am) patch.einsatz_ende_am = now;
    const { data: row, error } = await supabase
      .from("einsaetze").update(patch).eq("id", data.id).select().single();
    if (error) throw new Error(error.message);
    await logHistory(supabase, userId, data.id, before ?? {}, patch, domainId);
    if (before?.status !== "abgeschlossen") {
      await maybeAutoErp(data.id, domainId, userId);
    }
    return row;
  });

export const setEinsatzZeit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      id: z.string().uuid(),
      feld: z.enum(["vor_ort", "abfahrt", "ende"]),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const domainId = await requireEffectiveDomainId(supabase, userId);
    const col =
      data.feld === "vor_ort" ? "vor_ort_am"
      : data.feld === "abfahrt" ? "abfahrt_am"
      : "einsatz_ende_am";
    const { data: before } = await supabase
      .from("einsaetze").select("*").eq("id", data.id).single();
    if (before?.[col]) return before;
    const patch: any = { [col]: new Date().toISOString() };
    const { data: row, error } = await supabase
      .from("einsaetze").update(patch).eq("id", data.id).select().single();
    if (error) throw new Error(error.message);
    await logHistory(supabase, userId, data.id, before ?? {}, patch, domainId);
    return row;
  });

export const updateEinsatzBericht = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      id: z.string().uuid(),
      bericht_typ: z.enum(["hausnotruf", "av_einsatz"]),
      bericht_data: z.record(z.string(), z.any()).optional().nullable(),
      hausnotruf_problem: z.string().max(4000).optional().nullable(),
      hausnotruf_loesung: z.string().max(4000).optional().nullable(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const domainId = await requireEffectiveDomainId(supabase, userId);
    const { data: before } = await supabase
      .from("einsaetze").select("*").eq("id", data.id).single();
    // Admin/Disponent dürfen Berichte auch nach Abschluss bearbeiten
    if (before?.status === "abgeschlossen") {
      const { data: roles } = await supabaseAdmin
        .from("user_roles").select("role").eq("user_id", userId);
      const canEdit = (roles ?? []).some((r: any) => r.role === "admin" || r.role === "dispatcher" || r.role === "superadmin");
      if (!canEdit) {
        throw new Error("Bericht kann nach Abschluss nicht mehr bearbeitet werden");
      }
    }
    const patch: any = {
      bericht_typ: data.bericht_typ,
      bericht_data: data.bericht_data ?? null,
      hausnotruf_problem: data.hausnotruf_problem ?? null,
      hausnotruf_loesung: data.hausnotruf_loesung ?? null,
    };
    const { data: row, error } = await supabase
      .from("einsaetze").update(patch).eq("id", data.id).select().single();
    if (error) throw new Error(error.message);
    await supabase.from("einsatz_historie").insert({
      einsatz_id: data.id, field_name: "bericht",
      old_value: before?.bericht_data ? JSON.stringify(before.bericht_data) : null,
      new_value: JSON.stringify(patch.bericht_data),
      changed_by: userId,
      domain_id: domainId,
    });
    return row;
  });

export const listDateienForEinsatz = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ einsatz_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: e } = await supabase
      .from("einsaetze").select("kunden_name,address,key_number,anlagen_nr,teilnehmer_id")
      .eq("id", data.einsatz_id).single();
    if (!e) return { dateien: [] };
    const ors: string[] = [];
    const add = (col: string, val: any) => {
      if (!val) return;
      const v = String(val).replace(/[%_,()]/g, "").trim();
      if (v.length === 0) return;
      ors.push(`${col}.ilike.%${v}%`);
    };
    add("kunden_name", e.kunden_name);
    add("address", e.address);
    add("key_number", e.key_number);
    add("anlagen_nr", e.anlagen_nr);
    add("teilnehmer_id", e.teilnehmer_id);
    if (ors.length === 0) return { dateien: [] };
    const { data: rows, error } = await supabase
      .from("dateien")
      .select("id,filename,kunden_name,address,key_number,anlagen_nr,teilnehmer_id,notiz,storage_path,mime_type,size_bytes,created_at")
      .is("deleted_at", null)
      .or(ors.join(","))
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return { dateien: rows ?? [] };
  });

export const listFahrer = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const domainId = await requireEffectiveDomainId(supabase, userId);
    // Strictly limit Fahrer to the caller's domain.
    const { data: roles, error } = await supabaseAdmin
      .from("user_roles").select("user_id")
      .eq("role", "fahrer").eq("domain_id", domainId);
    if (error) throw new Error(error.message);
    const ids = (roles ?? []).map((r) => r.user_id);
    if (ids.length === 0) return { fahrer: [] };
    const { data: profiles } = await supabaseAdmin
      .from("profiles").select("id, display_name")
      .in("id", ids).eq("domain_id", domainId);
    return { fahrer: profiles ?? [] };
  });

export const searchKundenDateien = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ q: z.string().trim().min(1).max(200) }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const q = data.q.replace(/[%_]/g, "");
    const pattern = `%${q}%`;
    const { data: rows, error } = await supabase
      .from("dateien")
      .select("id, kunden_name, address, key_number, anlagen_nr, teilnehmer_id, notiz, filename")
      .is("deleted_at", null)
      .or(
        [
          `kunden_name.ilike.${pattern}`,
          `address.ilike.${pattern}`,
          `key_number.ilike.${pattern}`,
          `anlagen_nr.ilike.${pattern}`,
          `teilnehmer_id.ilike.${pattern}`,
          `filename.ilike.${pattern}`,
        ].join(","),
      )
      .order("kunden_name", { ascending: true, nullsFirst: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return { results: rows ?? [] };
  });

export const listEinsatzHistorie = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ einsatz_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: entries, error } = await supabase
      .from("einsatz_historie").select("*")
      .eq("einsatz_id", data.einsatz_id)
      .order("changed_at", { ascending: false });
    if (error) throw new Error(error.message);
    const ids = Array.from(new Set((entries ?? []).map((e: any) => e.changed_by).filter(Boolean))) as string[];
    let names: Record<string, string> = {};
    if (ids.length > 0) {
      const { data: ps } = await supabase.from("profiles").select("id, display_name").in("id", ids);
      names = Object.fromEntries((ps ?? []).map((p: any) => [p.id, p.display_name ?? ""]));
    }
    return { entries: (entries ?? []).map((e: any) => ({ ...e, changed_by_name: e.changed_by ? names[e.changed_by] ?? null : null })) };
  });

export const stornierenEinsatz = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      id: z.string().uuid(),
      grund: z.string().trim().min(1).max(1000),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const domainId = await requireEffectiveDomainId(supabase, userId);
    const { data: before } = await supabase
      .from("einsaetze").select("*").eq("id", data.id).single();
    const patch = {
      status: "storniert" as const,
      storniert_at: new Date().toISOString(),
      storniert_by: userId,
      storniert_grund: data.grund,
    };
    const { data: row, error } = await supabase
      .from("einsaetze").update(patch).eq("id", data.id).select().single();
    if (error) throw new Error(error.message);
    await logHistory(supabase, userId, data.id, before ?? {}, patch, domainId);
    return row;
  });

export const updateKundenEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    id: z.string().uuid(),
    email: z.string().email().max(200),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("einsaetze").update({ kunden_email: data.email }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const searchKundenEinsaetze = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      q: z.string().trim().max(200).optional().nullable(),
      from: z.string().datetime().optional().nullable(),
      to: z.string().datetime().optional().nullable(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let query = supabase
      .from("einsaetze")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (data.from) query = query.gte("created_at", data.from);
    if (data.to) query = query.lte("created_at", data.to);
    const q = (data.q ?? "").trim();
    if (q.length > 0) {
      const safe = q.replace(/[%_,()]/g, "");
      const pattern = `%${safe}%`;
      // UUID-Suche zusätzlich, wenn es wie eine ID aussieht
      const ors = [
        `kunden_name.ilike.${pattern}`,
        `address.ilike.${pattern}`,
        `key_number.ilike.${pattern}`,
        `anlagen_nr.ilike.${pattern}`,
        `teilnehmer_id.ilike.${pattern}`,
        `einsatzgrund.ilike.${pattern}`,
      ];
      if (/^[0-9a-f-]{4,}$/i.test(safe)) {
        ors.push(`id::text.ilike.${pattern}`);
      }
      query = query.or(ors.join(","));
    }
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    const ids = new Set<string>();
    (rows ?? []).forEach((e: any) => {
      if (e.assigned_to) ids.add(e.assigned_to);
      if (e.created_by) ids.add(e.created_by);
    });
    let profiles: Record<string, string> = {};
    if (ids.size > 0) {
      const { data: ps } = await supabase
        .from("profiles").select("id, display_name").in("id", Array.from(ids));
      profiles = Object.fromEntries((ps ?? []).map((p: any) => [p.id, p.display_name ?? ""]));
    }
    return { einsaetze: rows ?? [], profiles };
  });
export const deleteEinsatz = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const domainId = await requireEffectiveDomainId(supabase, userId);
    // Nur Domain-Admins / Superadmins dürfen löschen
    const { data: roles } = await supabaseAdmin
      .from("user_roles").select("role, domain_id").eq("user_id", userId);
    const isAllowed = (roles ?? []).some((r: any) =>
      r.role === "superadmin" || (r.role === "admin" && r.domain_id === domainId));
    if (!isAllowed) throw new Error("Nur Domänen-Admins können Einsätze löschen");

    // Verknüpfte Daten zuerst entfernen (keine FKs definiert, aber sauber halten)
    await supabase.from("einsatz_historie").delete().eq("einsatz_id", data.id);
    await supabase.from("einsatz_email_log").delete().eq("einsatz_id", data.id);
    await supabase.from("schluessel_buch").delete().eq("einsatz_id", data.id);

    const { error } = await supabase.from("einsaetze").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

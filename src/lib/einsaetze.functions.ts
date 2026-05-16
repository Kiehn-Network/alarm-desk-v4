import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const prioritaet = z.enum(["niedrig", "normal", "hoch", "kritisch"]);

const createSchema = z.object({
  einsatzgrund: z.string().trim().min(1).max(200),
  einsatzgrund_id: z.string().uuid().optional().nullable(),
  kunden_name: z.string().max(200).optional().nullable(),
  address: z.string().max(255).optional().nullable(),
  key_number: z.string().max(100).optional().nullable(),
  anlagen_nr: z.string().max(100).optional().nullable(),
  teilnehmer_id: z.string().max(100).optional().nullable(),
  prioritaet: prioritaet.default("normal"),
  beschreibung: z.string().max(4000).optional().nullable(),
  geplant_am: z.string().optional().nullable(),
  status: z.enum(["entwurf", "wartet_freigabe"]).default("wartet_freigabe"),
});

const updateSchema = createSchema.partial().extend({ id: z.string().uuid() });

const TRACKABLE = [
  "einsatzgrund","kunden_name","address","key_number","anlagen_nr",
  "teilnehmer_id","prioritaet","beschreibung","geplant_am","status",
  "assigned_to","ablehnung_grund","approved_by","abgeschlossen_am",
] as const;

async function logHistory(
  supabase: any,
  userId: string,
  einsatzId: string,
  before: Record<string, any>,
  patch: Record<string, any>,
) {
  const entries = TRACKABLE.filter((k) => k in patch)
    .map((k) => ({
      einsatz_id: einsatzId,
      field_name: k,
      old_value: before?.[k] != null ? String(before[k]) : null,
      new_value: (patch as any)[k] != null ? String((patch as any)[k]) : null,
      changed_by: userId,
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
    const { data: row, error } = await supabase
      .from("einsatz_gruende")
      .insert({ name: data.name, created_by: userId })
      .select().single();
    if (error) throw new Error(error.message);
    return row;
  });

export const createEinsatz = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => createSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const payload: any = { ...data, created_by: userId };
    if (!payload.geplant_am) delete payload.geplant_am;
    const { data: row, error } = await supabase
      .from("einsaetze").insert(payload).select().single();
    if (error) throw new Error(error.message);
    await supabase.from("einsatz_historie").insert({
      einsatz_id: row.id, field_name: "status",
      old_value: null, new_value: row.status, changed_by: userId,
    });
    return row;
  });

export const updateEinsatz = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => updateSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { id, ...patch } = data;
    const { data: before, error: bErr } = await supabase
      .from("einsaetze").select("*").eq("id", id).single();
    if (bErr) throw new Error(bErr.message);
    const cleanPatch: any = { ...patch };
    if (cleanPatch.geplant_am === "") cleanPatch.geplant_am = null;
    const { data: row, error } = await supabase
      .from("einsaetze").update(cleanPatch).eq("id", id).select().single();
    if (error) throw new Error(error.message);
    await logHistory(supabase, userId, id, before, cleanPatch);
    return row;
  });

export const freigebenEinsatz = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: before } = await supabase
      .from("einsaetze").select("*").eq("id", data.id).single();
    const patch = { status: "freigegeben" as const, approved_by: userId, approved_at: new Date().toISOString(), ablehnung_grund: null };
    const { data: row, error } = await supabase
      .from("einsaetze").update(patch).eq("id", data.id).select().single();
    if (error) throw new Error(error.message);
    await logHistory(supabase, userId, data.id, before ?? {}, patch);
    return row;
  });

export const ablehnenEinsatz = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid(), grund: z.string().trim().min(1).max(1000) }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: before } = await supabase
      .from("einsaetze").select("*").eq("id", data.id).single();
    const patch = { status: "abgelehnt" as const, approved_by: userId, approved_at: new Date().toISOString(), ablehnung_grund: data.grund };
    const { data: row, error } = await supabase
      .from("einsaetze").update(patch).eq("id", data.id).select().single();
    if (error) throw new Error(error.message);
    await logHistory(supabase, userId, data.id, before ?? {}, patch);
    return row;
  });

export const zuweisenEinsatz = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid(), fahrer_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: before } = await supabase
      .from("einsaetze").select("*").eq("id", data.id).single();
    if (!before || before.status !== "freigegeben") {
      throw new Error("Nur freigegebene Einsätze können zugewiesen werden");
    }
    const patch = { assigned_to: data.fahrer_id, assigned_at: new Date().toISOString(), status: "in_bearbeitung" as const };
    const { data: row, error } = await supabase
      .from("einsaetze").update(patch).eq("id", data.id).select().single();
    if (error) throw new Error(error.message);
    await logHistory(supabase, userId, data.id, before, patch);
    return row;
  });

export const abschliessenEinsatz = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: before } = await supabase
      .from("einsaetze").select("*").eq("id", data.id).single();
    const patch = { status: "abgeschlossen" as const, abgeschlossen_am: new Date().toISOString() };
    const { data: row, error } = await supabase
      .from("einsaetze").update(patch).eq("id", data.id).select().single();
    if (error) throw new Error(error.message);
    await logHistory(supabase, userId, data.id, before ?? {}, patch);
    return row;
  });

export const listFahrer = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { data: roles, error } = await supabaseAdmin
      .from("user_roles").select("user_id").eq("role", "fahrer");
    if (error) throw new Error(error.message);
    const ids = (roles ?? []).map((r) => r.user_id);
    if (ids.length === 0) return { fahrer: [] };
    const { data: profiles } = await supabaseAdmin
      .from("profiles").select("id, display_name").in("id", ids);
    return { fahrer: profiles ?? [] };
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

export const deleteEinsatz = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("einsaetze").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
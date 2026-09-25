import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireEffectiveDomainId } from "@/lib/tenant.server";

// =================================================================
// FUHRPARK — Fahrzeuge, Termine (HU/Inspektion), Schäden, KM-Log
// =================================================================

const SHORT = z.string().trim().max(200).nullish();
const LONG = z.string().trim().max(4000).nullish();

export const FAHRZEUG_STATUS = [
  { value: "aktiv", label: "Aktiv" },
  { value: "werkstatt", label: "In der Werkstatt" },
  { value: "ausgemustert", label: "Ausgemustert" },
] as const;

export const TANKARTEN = [
  { value: "benzin", label: "Benzin" },
  { value: "diesel", label: "Diesel" },
  { value: "elektro", label: "Elektro" },
  { value: "hybrid", label: "Hybrid" },
  { value: "gas", label: "Gas" },
] as const;

export const TERMIN_ARTEN = [
  { value: "hu", label: "HU / TÜV" },
  { value: "inspektion", label: "Inspektion" },
  { value: "erste_hilfe", label: "Erste-Hilfe-Kurs" },
  { value: "sonstige", label: "Sonstiges" },
] as const;

export const SCHADEN_SCHWERE = [
  { value: "leicht", label: "Leicht" },
  { value: "mittel", label: "Mittel" },
  { value: "schwer", label: "Schwer" },
] as const;

export const SCHADEN_STATUS = [
  { value: "offen", label: "Offen" },
  { value: "in_reparatur", label: "In Reparatur" },
  { value: "behandelt", label: "Behandelt" },
] as const;

export type FahrzeugRow = {
  id: string;
  kennzeichen: string;
  bezeichnung: string | null;
  art: string | null;
  marke: string | null;
  modell: string | null;
  baujahr: number | null;
  vin: string | null;
  km_stand: number | null;
  tankart: string;
  status: string;
  hauptfahrer: string | null;
  notizen: string | null;
  erstellt_von_name: string | null;
  created_at: string;
  updated_at: string;
  naechster_termin: { art: string; faellig_am: string } | null;
};

export type TerminRow = {
  id: string;
  fahrzeug_id: string;
  art: string;
  faellig_am: string | null;
  erledigt_am: string | null;
  km_stand: number | null;
  kosten: number | null;
  beschreibung: string | null;
  erstellt_von_name: string | null;
  created_at: string;
};

export type SchadenRow = {
  id: string;
  fahrzeug_id: string;
  gemeldet_am: string;
  beschreibung: string;
  schwere: string;
  status: string;
  kosten: number | null;
  gemeldet_von_name: string | null;
  notizen: string | null;
  marker_seite: string | null;
  marker_x: number | null;
  marker_y: number | null;
  created_at: string;
};

const MARKER_SEITEN = ["front", "heck", "links", "rechts"];
const markerSchema = z
  .object({
    seite: z.string().trim().max(10),
    x: z.number().min(0).max(100),
    y: z.number().min(0).max(100),
  })
  .nullish();

function markerNormal(m: { seite: string; x: number; y: number } | null | undefined) {
  if (!m || !MARKER_SEITEN.includes(m.seite)) return { marker_seite: null, marker_x: null, marker_y: null };
  return { marker_seite: m.seite, marker_x: m.x, marker_y: m.y };
}

export type KmEintragRow = {
  id: string;
  fahrzeug_id: string;
  km_stand: number;
  notiert_am: string;
  notiert_von_name: string | null;
  notizen: string | null;
  created_at: string;
};

function statusNormal(value: unknown) {
  const v = String(value ?? "");
  return FAHRZEUG_STATUS.some((s) => s.value === v) ? v : "aktiv";
}
function tankNormal(value: unknown) {
  const v = String(value ?? "");
  return TANKARTEN.some((s) => s.value === v) ? v : "benzin";
}
function terminArtNormal(value: unknown) {
  const v = String(value ?? "");
  return TERMIN_ARTEN.some((s) => s.value === v) ? v : "sonstige";
}
function schwereNormal(value: unknown) {
  const v = String(value ?? "");
  return SCHADEN_SCHWERE.some((s) => s.value === v) ? v : "leicht";
}
function schadenStatusNormal(value: unknown) {
  const v = String(value ?? "");
  return SCHADEN_STATUS.some((s) => s.value === v) ? v : "offen";
}

async function anzeigeName(supabase: any, userId: string) {
  const { data } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", userId)
    .maybeSingle();
  return data?.display_name || data?.email || "Unbekannt";
}

function fahrzeugDto(row: any, nextTermin?: { art: string; faellig_am: string } | null): FahrzeugRow {
  return {
    id: row.id,
    kennzeichen: row.kennzeichen,
    bezeichnung: row.bezeichnung ?? null,
    art: row.art ?? null,
    marke: row.marke ?? null,
    modell: row.modell ?? null,
    baujahr: row.baujahr ?? null,
    vin: row.vin ?? null,
    km_stand: row.km_stand ?? null,
    tankart: row.tankart,
    status: row.status,
    hauptfahrer: row.hauptfahrer ?? null,
    notizen: row.notizen ?? null,
    erstellt_von_name: row.erstellt_von_name ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    naechster_termin: nextTermin ?? null,
  };
}

export const listFahrzeuge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        q: z.string().trim().max(200).optional().default(""),
        status: z.array(z.string().trim().max(30)).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const domainId = await requireEffectiveDomainId(supabase, userId);

    let query = supabase
      .from("fuhrpark_fahrzeuge")
      .select("*")
      .eq("domain_id", domainId)
      .order("kennzeichen", { ascending: true })
      .limit(500);
    if (data.status?.length) query = query.in("status", data.status);

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);

    // Nächsten offenen Termin je Fahrzeug holen
    const { data: termine, error: tErr } = await supabase
      .from("fuhrpark_termine")
      .select("fahrzeug_id, art, faellig_am")
      .eq("domain_id", domainId)
      .is("erledigt_am", null)
      .not("faellig_am", "is", null)
      .order("faellig_am", { ascending: true });
    if (tErr) throw new Error(tErr.message);

    const naechster = new Map<string, { art: string; faellig_am: string }>();
    for (const t of termine ?? []) {
      if (t.fahrzeug_id && !naechster.has(t.fahrzeug_id)) {
        naechster.set(t.fahrzeug_id, { art: t.art, faellig_am: t.faellig_am });
      }
    }

    const term = data.q.trim().toLowerCase();
    const result = (rows ?? []).filter((r: any) => {
      if (!term) return true;
      return [r.kennzeichen, r.bezeichnung, r.marke, r.modell, r.vin, r.hauptfahrer]
        .some((v) => String(v ?? "").toLowerCase().includes(term));
    });

    return { rows: result.map((r: any) => fahrzeugDto(r, naechster.get(r.id) ?? null)) };
  });

export const getFahrzeug = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: row, error } = await supabase
      .from("fuhrpark_fahrzeuge")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Fahrzeug nicht gefunden.");

    const [termine, schaeden, kmLog] = await Promise.all([
      supabase
        .from("fuhrpark_termine")
        .select("*")
        .eq("fahrzeug_id", data.id)
        .order("faellig_am", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false }),
      supabase
        .from("fuhrpark_schaeden")
        .select("*")
        .eq("fahrzeug_id", data.id)
        .order("gemeldet_am", { ascending: false }),
      supabase
        .from("fuhrpark_km_log")
        .select("*")
        .eq("fahrzeug_id", data.id)
        .order("notiert_am", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(200),
    ]);

    return {
      fahrzeug: fahrzeugDto(row),
      termine: (termine.data ?? []).map((t: any) => ({
        id: t.id,
        fahrzeug_id: t.fahrzeug_id,
        art: t.art,
        faellig_am: t.faellig_am ?? null,
        erledigt_am: t.erledigt_am ?? null,
        km_stand: t.km_stand ?? null,
        kosten: t.kosten != null ? Number(t.kosten) : null,
        beschreibung: t.beschreibung ?? null,
        erstellt_von_name: t.erstellt_von_name ?? null,
        created_at: t.created_at,
      })) as TerminRow[],
      schaeden: (schaeden.data ?? []).map((s: any) => ({
        id: s.id,
        fahrzeug_id: s.fahrzeug_id,
        gemeldet_am: s.gemeldet_am,
        beschreibung: s.beschreibung,
        schwere: s.schwere,
        status: s.status,
        kosten: s.kosten != null ? Number(s.kosten) : null,
        gemeldet_von_name: s.gemeldet_von_name ?? null,
        notizen: s.notizen ?? null,
        marker_seite: s.marker_seite ?? null,
        marker_x: s.marker_x != null ? Number(s.marker_x) : null,
        marker_y: s.marker_y != null ? Number(s.marker_y) : null,
        created_at: s.created_at,
      })) as SchadenRow[],
      kmLog: (kmLog.data ?? []).map((k: any) => ({
        id: k.id,
        fahrzeug_id: k.fahrzeug_id,
        km_stand: Number(k.km_stand),
        notiert_am: k.notiert_am,
        notiert_von_name: k.notiert_von_name ?? null,
        notizen: k.notizen ?? null,
        created_at: k.created_at,
      })) as KmEintragRow[],
    };
  });

const fahrzeugBasis = {
  kennzeichen: z.string().trim().min(1, "Kennzeichen fehlt").max(40),
  bezeichnung: SHORT,
  art: SHORT,
  marke: SHORT,
  modell: SHORT,
  baujahr: z.number().int().min(1900).max(2100).nullish(),
  vin: SHORT,
  tankart: z.string().trim().max(20).optional(),
  status: z.string().trim().max(30).optional(),
  hauptfahrer: SHORT,
  notizen: LONG,
};

export const createFahrzeug = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ ...fahrzeugBasis, km_stand: z.number().int().min(0).nullish() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const domainId = await requireEffectiveDomainId(supabase, userId);
    const name = await anzeigeName(supabase, userId);

    const { data: row, error } = await supabase
      .from("fuhrpark_fahrzeuge")
      .insert({
        ...data,
        art: data.art?.trim() || "",
        tankart: tankNormal(data.tankart),
        status: statusNormal(data.status),
        domain_id: domainId,
        erstellt_von: userId,
        erstellt_von_name: name,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return { fahrzeug: fahrzeugDto(row) };
  });

export const updateFahrzeug = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        id: z.string().uuid(),
        kennzeichen: z.string().trim().min(1).max(40).optional(),
        bezeichnung: SHORT,
        art: SHORT,
        marke: SHORT,
        modell: SHORT,
        baujahr: z.number().int().min(1900).max(2100).nullish(),
        vin: SHORT,
        km_stand: z.number().int().min(0).nullish(),
        tankart: z.string().trim().max(20).optional(),
        status: z.string().trim().max(30).optional(),
        hauptfahrer: SHORT,
        notizen: LONG,
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { id, ...rest } = data;

    const patch: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(rest)) if (v !== undefined) patch[k] = v;
    if (patch.tankart !== undefined) patch.tankart = tankNormal(patch.tankart);
    if (patch.status !== undefined) patch.status = statusNormal(patch.status);

    const { data: row, error } = await supabase
      .from("fuhrpark_fahrzeuge")
      .update(patch as never)
      .eq("id", id)
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Fahrzeug nicht gefunden.");
    return { fahrzeug: fahrzeugDto(row) };
  });

export const deleteFahrzeug = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("fuhrpark_fahrzeuge").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const createTermin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        fahrzeug_id: z.string().uuid(),
        art: z.string().trim().max(30).optional(),
        faellig_am: z.string().trim().max(10).nullish(),
        km_stand: z.number().int().min(0).nullish(),
        kosten: z.number().min(0).nullish(),
        beschreibung: LONG,
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const domainId = await requireEffectiveDomainId(supabase, userId);
    const name = await anzeigeName(supabase, userId);

    const { data: row, error } = await supabase
      .from("fuhrpark_termine")
      .insert({
        fahrzeug_id: data.fahrzeug_id,
        art: terminArtNormal(data.art),
        faellig_am: data.faellig_am || null,
        km_stand: data.km_stand ?? null,
        kosten: data.kosten ?? null,
        beschreibung: data.beschreibung ?? null,
        domain_id: domainId,
        erstellt_von: userId,
        erstellt_von_name: name,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, id: row.id };
  });

export const updateTermin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        id: z.string().uuid(),
        art: z.string().trim().max(30).optional(),
        faellig_am: z.string().trim().max(10).nullish(),
        km_stand: z.number().int().min(0).nullish(),
        kosten: z.number().min(0).nullish(),
        beschreibung: LONG,
        erledigt: z.boolean().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { id, erledigt, ...rest } = data;

    const patch: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(rest)) if (v !== undefined) patch[k] = v;
    if (patch.art !== undefined) patch.art = terminArtNormal(patch.art);
    if (erledigt !== undefined) patch.erledigt_am = erledigt ? new Date().toISOString() : null;

    const { error } = await supabase.from("fuhrpark_termine").update(patch as never).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteTermin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("fuhrpark_termine").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const createSchaden = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        fahrzeug_id: z.string().uuid(),
        gemeldet_am: z.string().trim().max(10).nullish(),
        beschreibung: z.string().trim().min(1, "Beschreibung fehlt").max(2000),
        schwere: z.string().trim().max(20).optional(),
        kosten: z.number().min(0).nullish(),
        notizen: LONG,
        marker: markerSchema,
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const domainId = await requireEffectiveDomainId(supabase, userId);
    const name = await anzeigeName(supabase, userId);

    const { error } = await supabase.from("fuhrpark_schaeden").insert({
      fahrzeug_id: data.fahrzeug_id,
      gemeldet_am: data.gemeldet_am || new Date().toISOString().slice(0, 10),
      beschreibung: data.beschreibung,
      schwere: schwereNormal(data.schwere),
      kosten: data.kosten ?? null,
      notizen: data.notizen ?? null,
      ...markerNormal(data.marker),
      domain_id: domainId,
      gemeldet_von: userId,
      gemeldet_von_name: name,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateSchaden = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        id: z.string().uuid(),
        schwere: z.string().trim().max(20).optional(),
        status: z.string().trim().max(30).optional(),
        kosten: z.number().min(0).nullish(),
        notizen: LONG,
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { id, ...rest } = data;

    const patch: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(rest)) if (v !== undefined) patch[k] = v;
    if (patch.schwere !== undefined) patch.schwere = schwereNormal(patch.schwere);
    if (patch.status !== undefined) patch.status = schadenStatusNormal(patch.status);

    const { error } = await supabase.from("fuhrpark_schaeden").update(patch as never).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteSchaden = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("fuhrpark_schaeden").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const addKmEintrag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        fahrzeug_id: z.string().uuid(),
        km_stand: z.number().int().min(0),
        notiert_am: z.string().trim().max(10).nullish(),
        notizen: z.string().trim().max(500).nullish(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const domainId = await requireEffectiveDomainId(supabase, userId);
    const name = await anzeigeName(supabase, userId);

    const { data: fahrzeug } = await supabase
      .from("fuhrpark_fahrzeuge")
      .select("km_stand")
      .eq("id", data.fahrzeug_id)
      .maybeSingle();

    const { error } = await supabase.from("fuhrpark_km_log").insert({
      fahrzeug_id: data.fahrzeug_id,
      km_stand: data.km_stand,
      notiert_am: data.notiert_am || new Date().toISOString().slice(0, 10),
      notizen: data.notizen || null,
      domain_id: domainId,
      notiert_von: userId,
      notiert_von_name: name,
    });
    if (error) throw new Error(error.message);

    // Fahrzeug-Kilometerstand nur nach vorne korrigieren
    if (fahrzeug?.km_stand == null || data.km_stand > Number(fahrzeug.km_stand)) {
      await supabase.from("fuhrpark_fahrzeuge").update({ km_stand: data.km_stand }).eq("id", data.fahrzeug_id);
    }
    return { ok: true };
  });

export const deleteKmEintrag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("fuhrpark_km_log").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

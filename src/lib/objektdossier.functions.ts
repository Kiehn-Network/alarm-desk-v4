import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireEffectiveDomainId } from "@/lib/tenant.server";

// =================================================================
// OBJEKTDOSSIER — Einsatzanleitung pro Kunde/Objekt (Zentrale & Fahrer)
// =================================================================

const SHORT = z.string().trim().max(300).nullish();
const LONG = z.string().trim().max(4000).nullish();

function leer(value: string | null | undefined) {
  return (value ?? "").trim();
}

export type DossierRow = {
  id: string;
  kunden_name: string;
  key_number: string | null;
  teilnehmer_id: string | null;
  anlagen_nr: string | null;
  address: string | null;
  anfahrt: string | null;
  parken: string | null;
  schluessel: string | null;
  alarm_plan: string | null;
  gefahren: string | null;
  technik: string | null;
  oeffnungszeiten: string | null;
  notiz: string | null;
  fahrer_sichtbar: boolean;
  erstellt_von_name: string | null;
  created_at: string;
  updated_at: string;
};

export type KontaktRow = {
  id: string;
  name: string;
  rolle: string | null;
  telefon: string;
  prioritaet: number;
  aktiv: boolean;
  notiz: string | null;
};

const dossierFelder = {
  kunden_name: z.string().trim().min(1, "Kundenname fehlt").max(200),
  key_number: SHORT,
  teilnehmer_id: SHORT,
  anlagen_nr: SHORT,
  address: SHORT,
  anfahrt: LONG,
  parken: LONG,
  schluessel: LONG,
  alarm_plan: LONG,
  gefahren: LONG,
  technik: LONG,
  oeffnungszeiten: LONG,
  notiz: LONG,
  fahrer_sichtbar: z.boolean().optional().default(true),
};

async function anzeigeName(supabase: any, userId: string) {
  const { data } = await supabase
    .from("profiles")
    .select("display_name, email")
    .eq("id", userId)
    .maybeSingle();
  return data?.display_name || data?.email || "Unbekannt";
}

async function rollenVon(supabase: any, userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  return (data ?? []).map((r: any) => String(r.role));
}

function dossierDto(row: any): DossierRow {
  return {
    id: row.id,
    kunden_name: row.kunden_name,
    key_number: row.key_number ?? null,
    teilnehmer_id: row.teilnehmer_id ?? null,
    anlagen_nr: row.anlagen_nr ?? null,
    address: row.address ?? null,
    anfahrt: row.anfahrt ?? null,
    parken: row.parken ?? null,
    schluessel: row.schluessel ?? null,
    alarm_plan: row.alarm_plan ?? null,
    gefahren: row.gefahren ?? null,
    technik: row.technik ?? null,
    oeffnungszeiten: row.oeffnungszeiten ?? null,
    notiz: row.notiz ?? null,
    fahrer_sichtbar: row.fahrer_sichtbar !== false,
    erstellt_von_name: row.erstellt_von_name ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export const listDossiers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ q: z.string().trim().max(200).optional().default("") }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const domainId = await requireEffectiveDomainId(supabase, userId);

    const { data: rows, error } = await supabase
      .from("objekt_dossiers")
      .select("*")
      .eq("domain_id", domainId)
      .order("kunden_name", { ascending: true })
      .limit(1000);
    if (error) throw new Error(error.message);

    const term = leer(data.q).toLowerCase();
    const gefiltert = term
      ? (rows ?? []).filter((r: any) =>
          [r.kunden_name, r.address, r.key_number, r.anlagen_nr, r.teilnehmer_id]
            .some((v) => String(v ?? "").toLowerCase().includes(term)),
        )
      : (rows ?? []);

    return { rows: gefiltert.map(dossierDto) };
  });

export const getDossier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: row, error } = await supabase
      .from("objekt_dossiers")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Objektdossier nicht gefunden.");

    const [{ data: kontakte }, { data: dateien }] = await Promise.all([
      supabase
        .from("objekt_kontakte")
        .select("*")
        .eq("dossier_id", data.id)
        .order("prioritaet", { ascending: true })
        .order("name", { ascending: true }),
      supabase
        .from("dateien")
        .select("id, filename, folder, key_number, kunden_name, address, created_at")
        .eq("domain_id", row.domain_id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(200),
    ]);

    const name = leer(row.kunden_name).toLowerCase();
    const key = leer(row.key_number).toLowerCase();
    const addr = leer(row.address).toLowerCase();
    const passend = (dateien ?? []).filter((d: any) => {
      if (key && leer(d.key_number).toLowerCase() === key) return true;
      if (addr && leer(d.address).toLowerCase() === addr) return true;
      if (name && leer(d.kunden_name).toLowerCase() === name) return true;
      return false;
    });

    return {
      dossier: dossierDto(row),
      kontakte: (kontakte ?? []).map((k: any) => ({
        id: k.id,
        name: k.name,
        rolle: k.rolle ?? null,
        telefon: k.telefon,
        prioritaet: k.prioritaet ?? 1,
        aktiv: k.aktiv !== false,
        notiz: k.notiz ?? null,
      })) as KontaktRow[],
      dateien: passend.slice(0, 12).map((d: any) => ({
        id: d.id,
        filename: d.filename,
        folder: d.folder ?? null,
        created_at: d.created_at,
      })),
    };
  });

export const createDossier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object(dossierFelder).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const domainId = await requireEffectiveDomainId(supabase, userId);
    const name = await anzeigeName(supabase, userId);

    const { data: row, error } = await supabase
      .from("objekt_dossiers")
      .insert({ ...data, domain_id: domainId, erstellt_von: userId, erstellt_von_name: name })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return { dossier: dossierDto(row) };
  });

export const updateDossier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid(), ...dossierFelder }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { id, ...felder } = data;
    const name = await anzeigeName(supabase, userId);

    const { data: row, error } = await supabase
      .from("objekt_dossiers")
      .update({ ...felder, aktualisiert_von: userId })
      .eq("id", id)
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Objektdossier nicht gefunden.");
    return { dossier: dossierDto(row) };
  });

export const deleteDossier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("objekt_dossiers").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const saveKontakt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        dossier_id: z.string().uuid(),
        id: z.string().uuid().optional(),
        name: z.string().trim().min(1, "Name fehlt").max(120),
        rolle: SHORT,
        telefon: z.string().trim().min(1, "Telefon fehlt").max(60),
        prioritaet: z.number().int().min(1).max(99).optional().default(1),
        aktiv: z.boolean().optional().default(true),
        notiz: z.string().trim().max(1000).nullish(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const domainId = await requireEffectiveDomainId(supabase, userId);
    const { id, ...felder } = data;

    if (id) {
      const { data: row, error } = await supabase
        .from("objekt_kontakte")
        .update(felder)
        .eq("id", id)
        .select("*")
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!row) throw new Error("Kontakt nicht gefunden.");
      return { ok: true };
    }

    const { error } = await supabase
      .from("objekt_kontakte")
      .insert({ ...felder, domain_id: domainId, dossier_id: data.dossier_id });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteKontakt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("objekt_kontakte").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Dossier zu einem Einsatz/Kunden finden – für den Fahrer-Button "Objektinfo".
 * Fahrer bekommen nur Dossiers mit freigegebener Fahreransicht.
 */
export const findDossierForKunde = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        kunden_name: z.string().trim().max(200).optional().nullable(),
        key_number: z.string().trim().max(100).optional().nullable(),
        address: z.string().trim().max(300).optional().nullable(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const domainId = await requireEffectiveDomainId(supabase, userId);

    const name = leer(data.kunden_name).toLowerCase();
    const key = leer(data.key_number).toLowerCase();
    const addr = leer(data.address).toLowerCase();
    if (!name && !key && !addr) return { dossier: null, kontakte: [] as KontaktRow[] };

    const ors: string[] = [];
    if (name) ors.push(`kunden_name.ilike.%${name.replace(/[%_]/g, "")}%`);
    if (key) ors.push(`key_number.eq.${key}`);
    if (addr) ors.push(`address.ilike.%${addr.replace(/[%_]/g, "")}%`);

    const { data: rows, error } = await supabase
      .from("objekt_dossiers")
      .select("*")
      .eq("domain_id", domainId)
      .or(ors.join(","))
      .limit(20);
    if (error) throw new Error(error.message);

    const rollen = await rollenVon(supabase, userId);
    const istNurFahrer = rollen.length > 0 && rollen.every((r) => r === "fahrer" || r === "user");
    const erlaubt = istNurFahrer ? (rows ?? []).filter((r: any) => r.fahrer_sichtbar !== false) : (rows ?? []);

    // Trefferqualität: exakte Schlüssel-Nr. > exakte Adresse > Name
    const评分 = (r: any) => {
      let score = 0;
      if (key && leer(r.key_number).toLowerCase() === key) score += 6;
      if (addr && leer(r.address).toLowerCase() === addr) score += 4;
      if (name && leer(r.kunden_name).toLowerCase() === name) score += 3;
      return score;
    };
    const bester = [...erlaubt].sort((a: any, b: any) => 评分(b) - 评分(a))[0];
    if (!bester) return { dossier: null, kontakte: [] as KontaktRow[] };

    const { data: kontakte } = await supabase
      .from("objekt_kontakte")
      .select("*")
      .eq("dossier_id", bester.id)
      .eq("aktiv", true)
      .order("prioritaet", { ascending: true });

    return {
      dossier: dossierDto(bester),
      kontakte: (kontakte ?? []).map((k: any) => ({
        id: k.id,
        name: k.name,
        rolle: k.rolle ?? null,
        telefon: k.telefon,
        prioritaet: k.prioritaet ?? 1,
        aktiv: k.aktiv !== false,
        notiz: k.notiz ?? null,
      })) as KontaktRow[],
    };
  });

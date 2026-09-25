import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireEffectiveDomainId } from "@/lib/tenant.server";

// =================================================================
// SERVICE CENTER — Anfragen & Aufträge mit Nummernkreis, Frist, Zuständigkeit
// =================================================================

const SHORT = z.string().trim().max(300).nullish();
const LONG = z.string().trim().max(4000).nullish();

export const AUFTRAG_TYPEN = [
  { value: "anfrage", label: "Anfrage" },
  { value: "stoerung", label: "Störung" },
  { value: "austausch", label: "Austausch / Lieferung" },
  { value: "wartung", label: "Wartung" },
  { value: "schluessel", label: "Schlüssel" },
  { value: "sonstiges", label: "Sonstiges" },
] as const;

export const AUFTRAG_STATUS = [
  { value: "offen", label: "Offen" },
  { value: "in_bearbeitung", label: "In Bearbeitung" },
  { value: "wartet_kunde", label: "Wartet auf Kunde" },
  { value: "erledigt", label: "Erledigt" },
  { value: "abgebrochen", label: "Abgebrochen" },
] as const;

export const AUFTRAG_PRIO = [
  { value: "niedrig", label: "Niedrig" },
  { value: "normal", label: "Normal" },
  { value: "hoch", label: "Hoch" },
] as const;

export type AuftragRow = {
  id: string;
  nummer: number;
  typ: string;
  betreff: string;
  beschreibung: string | null;
  kunden_name: string | null;
  key_number: string | null;
  teilnehmer_id: string | null;
  address: string | null;
  status: string;
  prioritaet: string;
  faellig_am: string | null;
  zugewiesen_an: string | null;
  zugewiesen_name: string | null;
  einsatz_id: string | null;
  erstellt_von_name: string | null;
  created_at: string;
  updated_at: string;
  erledigt_am: string | null;
};

export type NotizRow = {
  id: string;
  text: string;
  erstellt_von_name: string | null;
  created_at: string;
};

function typNormal(value: unknown) {
  const v = String(value ?? "");
  return AUFTRAG_TYPEN.some((t) => t.value === v) ? v : "anfrage";
}
function statusNormal(value: unknown) {
  const v = String(value ?? "");
  return AUFTRAG_STATUS.some((t) => t.value === v) ? v : "offen";
}
function prioNormal(value: unknown) {
  const v = String(value ?? "");
  return AUFTRAG_PRIO.some((t) => t.value === v) ? v : "normal";
}

async function anzeigeName(supabase: any, userId: string) {
  const { data } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", userId)
    .maybeSingle();
  return data?.display_name || data?.email || "Unbekannt";
}

function auftragDto(row: any): AuftragRow {
  return {
    id: row.id,
    nummer: Number(row.nummer),
    typ: row.typ,
    betreff: row.betreff,
    beschreibung: row.beschreibung ?? null,
    kunden_name: row.kunden_name ?? null,
    key_number: row.key_number ?? null,
    teilnehmer_id: row.teilnehmer_id ?? null,
    address: row.address ?? null,
    status: row.status,
    prioritaet: row.prioritaet,
    faellig_am: row.faellig_am ?? null,
    zugewiesen_an: row.zugewiesen_an ?? null,
    zugewiesen_name: row.zugewiesen_name ?? null,
    einsatz_id: row.einsatz_id ?? null,
    erstellt_von_name: row.erstellt_von_name ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    erledigt_am: row.erledigt_am ?? null,
  };
}

const auftragBasis = {
  betreff: z.string().trim().min(1, "Betreff fehlt").max(200),
  beschreibung: LONG,
  typ: z.string().trim().max(40).optional(),
  prioritaet: z.string().trim().max(20).optional(),
  faellig_am: z.string().trim().max(10).nullish(),
  kunden_name: SHORT,
  key_number: SHORT,
  teilnehmer_id: SHORT,
  address: SHORT,
  zugewiesen_an: z.string().uuid().nullish(),
  zugewiesen_name: SHORT,
};

export const listAuftraege = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        status: z.array(z.string().trim().max(30)).optional(),
        q: z.string().trim().max(200).optional().default(""),
        nurUeberfaellig: z.boolean().optional().default(false),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const domainId = await requireEffectiveDomainId(supabase, userId);

    let query = supabase
      .from("service_auftraege")
      .select("*")
      .eq("domain_id", domainId)
      .order("status", { ascending: true })
      .order("faellig_am", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(500);

    if (data.status?.length) query = query.in("status", data.status);

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);

    const term = data.q.trim().toLowerCase();
    const heute = new Date().toISOString().slice(0, 10);
    let result = (rows ?? []).filter((r: any) => {
      if (!term) return true;
      return [r.betreff, r.kunden_name, r.key_number, r.beschreibung, r.zugewiesen_name, String(r.nummer)]
        .some((v) => String(v ?? "").toLowerCase().includes(term));
    });
    if (data.nurUeberfaellig) {
      result = result.filter(
        (r: any) => r.faellig_am && r.faellig_am < heute && r.status !== "erledigt" && r.status !== "abgebrochen",
      );
    }

    return { rows: result.map(auftragDto) };
  });

export const getAuftrag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: row, error } = await supabase
      .from("service_auftraege")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Auftrag nicht gefunden.");

    const { data: notizen } = await supabase
      .from("service_notizen")
      .select("*")
      .eq("auftrag_id", data.id)
      .order("created_at", { ascending: false });

    return {
      auftrag: auftragDto(row),
      notizen: (notizen ?? []).map((n: any) => ({
        id: n.id,
        text: n.text,
        erstellt_von_name: n.erstellt_von_name ?? null,
        created_at: n.created_at,
      })) as NotizRow[],
    };
  });

export const createAuftrag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object(auftragBasis).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const domainId = await requireEffectiveDomainId(supabase, userId);
    const name = await anzeigeName(supabase, userId);

    const { data: nummer, error: nrError } = await supabase.rpc("next_service_nr", { _domain_id: domainId });
    if (nrError) throw new Error(nrError.message);

    const { data: row, error } = await supabase
      .from("service_auftraege")
      .insert({
        ...data,
        typ: typNormal(data.typ),
        prioritaet: prioNormal(data.prioritaet),
        status: "offen",
        nummer,
        domain_id: domainId,
        erstellt_von: userId,
        erstellt_von_name: name,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return { auftrag: auftragDto(row) };
  });

export const updateAuftrag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        id: z.string().uuid(),
        betreff: z.string().trim().min(1).max(200).optional(),
        beschreibung: LONG,
        typ: z.string().trim().max(40).optional(),
        prioritaet: z.string().trim().max(20).optional(),
        status: z.string().trim().max(30).optional(),
        faellig_am: z.string().trim().max(10).nullish(),
        kunden_name: SHORT,
        key_number: SHORT,
        teilnehmer_id: SHORT,
        address: SHORT,
        zugewiesen_an: z.string().uuid().nullish(),
        zugewiesen_name: SHORT,
        einsatz_id: z.string().uuid().nullish(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { id, ...rest } = data;

    const patch: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(rest)) if (v !== undefined) patch[k] = v;
    if (patch.typ !== undefined) patch.typ = typNormal(patch.typ);
    if (patch.prioritaet !== undefined) patch.prioritaet = prioNormal(patch.prioritaet);
    if (patch.status !== undefined) {
      patch.status = statusNormal(patch.status);
      patch.erledigt_am = patch.status === "erledigt" ? new Date().toISOString() : null;
    }
    if (patch.einsatz_id === null) patch.einsatz_id = null;

    const { data: row, error } = await supabase
      .from("service_auftraege")
      .update(patch as never)
      .eq("id", id)
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Auftrag nicht gefunden.");
    return { auftrag: auftragDto(row) };
  });

export const deleteAuftrag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("service_auftraege").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const addNotiz = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ auftrag_id: z.string().uuid(), text: z.string().trim().min(1, "Text fehlt").max(4000) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const domainId = await requireEffectiveDomainId(supabase, userId);
    const name = await anzeigeName(supabase, userId);

    const { error } = await supabase.from("service_notizen").insert({
      auftrag_id: data.auftrag_id,
      text: data.text,
      domain_id: domainId,
      erstellt_von: userId,
      erstellt_von_name: name,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteNotiz = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("service_notizen").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Teammitglieder der Domäne – für die Zuständigkeit im Service Center. */
export const listTeam = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const domainId = await requireEffectiveDomainId(supabase, userId);

    const { data: profiles, error } = await supabase
      .from("profiles")
      .select("id, display_name")
      .eq("domain_id", domainId)
      .order("display_name", { ascending: true, nullsFirst: false })
      .limit(300);
    if (error) throw new Error(error.message);

    return {
      team: (profiles ?? []).map((p: any) => ({
        id: p.id,
        name: p.display_name || p.email || "Unbekannt",
      })),
    };
  });

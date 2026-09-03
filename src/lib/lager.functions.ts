import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireEffectiveDomainId } from "@/lib/tenant.server";

// =================================================================
// LAGER — Transponder-Login und Verwaltung der Lager-Personen
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

function normalizeTransponder(value: unknown) {
  return String(value ?? "").trim().toUpperCase();
}

/** Liste aller Lager-Personen der aktuellen Domäne. */
export const listLagerPersonen = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const domainId = await requireEffectiveDomainId(supabase, userId);
    const { data, error } = await supabase
      .from("lager_personen")
      .select("*")
      .eq("domain_id", domainId)
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return { rows: (data ?? []) as LagerPerson[] };
  });

/** Anlegen oder Ändern einer Lager-Person (nur Domänen-Admin per RLS). */
export const upsertLagerPerson = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    id?: string;
    name: string;
    personalnummer?: string | null;
    transponder_id: string;
    aktiv?: boolean;
    notiz?: string | null;
  }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const domainId = await requireEffectiveDomainId(supabase, userId);

    const name = String(data.name ?? "").trim();
    const transponder = normalizeTransponder(data.transponder_id);
    if (!name) throw new Error("Bitte einen Namen angeben.");
    if (!transponder) throw new Error("Bitte eine Transponder-Nummer erfassen.");

    const payload = {
      domain_id: domainId,
      name,
      personalnummer: data.personalnummer?.toString().trim() || null,
      transponder_id: transponder,
      aktiv: data.aktiv ?? true,
      notiz: data.notiz?.toString().trim() || null,
      rolle: "technik",
    };

    if (data.id) {
      const { error } = await supabase
        .from("lager_personen")
        .update(payload)
        .eq("id", data.id)
        .eq("domain_id", domainId);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }

    const { data: inserted, error } = await supabase
      .from("lager_personen")
      .insert(payload)
      .select("id")
      .single();
    if (error) {
      if (error.code === "23505") throw new Error("Diese Transponder-Nummer ist bereits vergeben.");
      throw new Error(error.message);
    }
    return { id: inserted.id as string };
  });

/** Lager-Person entfernen (nur Domänen-Admin per RLS). */
export const deleteLagerPerson = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const domainId = await requireEffectiveDomainId(supabase, userId);
    const { error } = await supabase
      .from("lager_personen")
      .delete()
      .eq("id", data.id)
      .eq("domain_id", domainId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Transponder-Login: prüft die gescannte Nummer gegen die Lager-Personen. */
export const lagerTransponderLogin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { transponder_id: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const domainId = await requireEffectiveDomainId(supabase, userId);
    const transponder = normalizeTransponder(data.transponder_id);
    if (!transponder) throw new Error("Kein Transponder erkannt.");

    const { data: person, error } = await supabase
      .from("lager_personen")
      .select("*")
      .eq("domain_id", domainId)
      .eq("transponder_id", transponder)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!person) throw new Error("Transponder unbekannt. Bitte beim Administrator melden.");
    if (!person.aktiv) throw new Error("Dieser Transponder ist gesperrt.");

    await supabase
      .from("lager_personen")
      .update({ last_login_at: new Date().toISOString() })
      .eq("id", person.id)
      .eq("domain_id", domainId);

    return { person: person as LagerPerson };
  });

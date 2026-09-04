import { createServerFn } from "@tanstack/react-start";

// Öffentliche Lager-Station: der Transponder ist die einzige Anmeldung.
export type LagerKioskPerson = {
  id: string;
  name: string;
  personalnummer: string | null;
  domain_id: string;
  domain_name: string | null;
};

export type LagerKioskArtikel = {
  id: string;
  bezeichnung: string;
  beschreibung: string | null;
  barcode: string;
  barcode_generiert: boolean;
  einheit: string;
  lagerort: string | null;
  bestand: number;
  mindestbestand: number;
};

function normalize(value: unknown) { return String(value ?? "").trim().toUpperCase(); }

async function getActivePerson(supabaseAdmin: any, personId: string) {
  const { data: person, error } = await supabaseAdmin.from("lager_personen").select("id,name,personalnummer,aktiv,domain_id").eq("id", personId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!person || !person.aktiv) throw new Error("Die Lager-Anmeldung ist nicht mehr aktiv.");
  return person;
}

export const kioskTransponderLogin = createServerFn({ method: "POST" })
  .inputValidator((input: { transponder_id: string }) => input)
  .handler(async ({ data }) => {
    const transponder = normalize(data.transponder_id);
    if (transponder.length < 4) throw new Error("Kein gültiger Transponder erkannt.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: person, error } = await supabaseAdmin.from("lager_personen").select("id,name,personalnummer,aktiv,domain_id").eq("transponder_id", transponder).maybeSingle();
    if (error) throw new Error(error.message);
    if (!person) throw new Error("Transponder unbekannt. Bitte beim Administrator melden.");
    if (!person.aktiv) throw new Error("Dieser Transponder ist gesperrt.");
    await supabaseAdmin.from("lager_personen").update({ last_login_at: new Date().toISOString() }).eq("id", person.id);
    const { data: domain } = await supabaseAdmin.from("domains").select("name").eq("id", person.domain_id).maybeSingle();
    return { person: { id: person.id, name: person.name, personalnummer: person.personalnummer ?? null, domain_id: person.domain_id, domain_name: domain?.name ?? null } satisfies LagerKioskPerson };
  });

export const kioskFindArtikel = createServerFn({ method: "POST" })
  .inputValidator((input: { person_id: string; barcode: string }) => input)
  .handler(async ({ data }) => {
    const barcode = normalize(data.barcode);
    if (!barcode) throw new Error("Bitte einen Artikel scannen.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const person = await getActivePerson(supabaseAdmin, data.person_id);
    const { data: artikel, error } = await supabaseAdmin.from("lager_artikel").select("id,bezeichnung,beschreibung,barcode,barcode_generiert,einheit,lagerort,bestand,mindestbestand").eq("domain_id", person.domain_id).eq("barcode", barcode).eq("aktiv", true).maybeSingle();
    if (error) throw new Error(error.message);
    if (!artikel) throw new Error("Kein aktiver Artikel mit diesem Barcode gefunden.");
    return { artikel: artikel as LagerKioskArtikel };
  });

export const kioskBuchen = createServerFn({ method: "POST" })
  .inputValidator((input: { person_id: string; artikel_id: string; richtung: "eingang" | "ausgang"; menge: number; signatur?: string | null; notiz?: string | null }) => input)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const person = await getActivePerson(supabaseAdmin, data.person_id);
    const { data: artikel } = await supabaseAdmin.from("lager_artikel").select("id,domain_id").eq("id", data.artikel_id).eq("domain_id", person.domain_id).maybeSingle();
    if (!artikel) throw new Error("Artikel gehört nicht zur aktiven Domäne.");
    const { performBuchung } = await import("@/lib/lager-buchung.server");
    return performBuchung({ domain_id: person.domain_id, artikel_id: artikel.id, richtung: data.richtung, menge: data.menge, person_id: person.id, person_name: person.name, signatur: data.signatur ?? null, notiz: data.notiz ?? null });
  });

export const kioskBuchenBatch = createServerFn({ method: "POST" })
  .inputValidator((input: {
    person_id: string;
    richtung: "eingang" | "ausgang";
    ziel: "auto" | "projekt";
    ziel_bezeichnung?: string | null;
    signatur?: string | null;
    notiz?: string | null;
    positionen: { artikel_id: string; menge: number }[];
  }) => input)
  .handler(async ({ data }) => {
    if (!Array.isArray(data.positionen) || data.positionen.length === 0) {
      throw new Error("Bitte mindestens einen Artikel scannen.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const person = await getActivePerson(supabaseAdmin, data.person_id);
    const { performBuchung } = await import("@/lib/lager-buchung.server");

    const zielText = data.ziel === "auto" ? "Auto" : "Projekt";
    const bezeichnung = String(data.ziel_bezeichnung ?? "").trim();
    const notizParts = [`${zielText}${bezeichnung ? `: ${bezeichnung}` : ""}`];
    if (data.notiz?.trim()) notizParts.push(data.notiz.trim());
    const notiz = notizParts.join(" · ");

    const results: { bestand: number; bezeichnung: string; einheit: string }[] = [];
    for (const pos of data.positionen) {
      const { data: artikel } = await supabaseAdmin
        .from("lager_artikel").select("id").eq("id", pos.artikel_id).eq("domain_id", person.domain_id).maybeSingle();
      if (!artikel) throw new Error("Artikel gehört nicht zur aktiven Domäne.");
      const res = await performBuchung({
        domain_id: person.domain_id,
        artikel_id: artikel.id,
        richtung: data.richtung,
        menge: pos.menge,
        person_id: person.id,
        person_name: person.name,
        signatur: data.signatur ?? null,
        notiz,
      });
      results.push(res);
    }
    return { positionen: results, anzahl: results.length };
  });

export type LagerKioskFahrzeug = {
  id: string;
  kennzeichen: string;
  bezeichnung: string | null;
  fahrer: string | null;
  code: string;
};

export const kioskFindFahrzeug = createServerFn({ method: "POST" })
  .inputValidator((input: { person_id: string; code: string }) => input)
  .handler(async ({ data }) => {
    const code = normalize(data.code);
    if (!code) throw new Error("Bitte einen Fahrzeug-QR-Code scannen.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const person = await getActivePerson(supabaseAdmin, data.person_id);
    const { data: fahrzeug, error } = await supabaseAdmin
      .from("lager_fahrzeuge")
      .select("id,kennzeichen,bezeichnung,fahrer,code")
      .eq("domain_id", person.domain_id)
      .eq("code", code)
      .eq("aktiv", true)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!fahrzeug) throw new Error("Kein aktives Fahrzeug mit diesem QR-Code gefunden.");
    return { fahrzeug: fahrzeug as LagerKioskFahrzeug };
  });

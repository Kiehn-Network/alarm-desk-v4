import { createServerFn } from "@tanstack/react-start";

// =================================================================
// LAGER-KIOSK — öffentliche Transponder-Anmeldung (ohne AlarmDesk-Login)
// Läuft parallel zum AlarmDesk, bleibt aber in derselben Domäne:
// die Domäne wird über die Transponder-Nummer der Person ermittelt.
// =================================================================

export type LagerKioskPerson = {
  id: string;
  name: string;
  personalnummer: string | null;
  domain_id: string;
  domain_name: string | null;
};

function normalizeTransponder(value: unknown) {
  return String(value ?? "").trim().toUpperCase();
}

/** Öffentlicher Transponder-Login für die Lager-Station (Kiosk). */
export const kioskTransponderLogin = createServerFn({ method: "POST" })
  .inputValidator((input: { transponder_id: string }) => input)
  .handler(async ({ data }) => {
    const transponder = normalizeTransponder(data.transponder_id);
    if (transponder.length < 4) throw new Error("Kein gültiger Transponder erkannt.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: person, error } = await supabaseAdmin
      .from("lager_personen")
      .select("id,name,personalnummer,aktiv,domain_id")
      .eq("transponder_id", transponder)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!person) throw new Error("Transponder unbekannt. Bitte beim Administrator melden.");
    if (!person.aktiv) throw new Error("Dieser Transponder ist gesperrt.");

    await supabaseAdmin
      .from("lager_personen")
      .update({ last_login_at: new Date().toISOString() })
      .eq("id", person.id);

    const { data: domain } = await supabaseAdmin
      .from("domains")
      .select("name")
      .eq("id", person.domain_id)
      .maybeSingle();

    return {
      person: {
        id: person.id as string,
        name: person.name as string,
        personalnummer: (person.personalnummer as string | null) ?? null,
        domain_id: person.domain_id as string,
        domain_name: (domain?.name as string | undefined) ?? null,
      } satisfies LagerKioskPerson,
    };
  });

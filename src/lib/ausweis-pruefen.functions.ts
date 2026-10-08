import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type AusweisPruefung =
  | { gefunden: false }
  | { gefunden: true; name: string; funktion: string | null; foto: string | null; ausweisNr: string | null; gueltigBis: string | null; firma: string | null; status: "gueltig" | "abgelaufen" | "unbefristet" };

/** Öffentliche Prüfung: gibt nur die auf dem Ausweis ohnehin sichtbaren Daten zurück. */
export const pruefeAusweis = createServerFn({ method: "GET" })
  .inputValidator(z.object({ token: z.string().uuid() }))
  .handler(async ({ data }): Promise<AusweisPruefung> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: d } = await supabaseAdmin
      .from("dienstausweis_daten")
      .select("user_id, domain_id, funktion, foto, ausweis_nr, gueltig_bis")
      .eq("pruef_token", data.token)
      .maybeSingle();
    if (!d) return { gefunden: false };
    const [{ data: p }, { data: dom }] = await Promise.all([
      supabaseAdmin.from("profiles").select("display_name").eq("id", d.user_id).maybeSingle(),
      supabaseAdmin.from("domains").select("name").eq("id", d.domain_id).maybeSingle(),
    ]);
    let status: "gueltig" | "abgelaufen" | "unbefristet" = "unbefristet";
    if (d.gueltig_bis) {
      const heute = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" }).format(new Date());
      status = d.gueltig_bis >= heute ? "gueltig" : "abgelaufen";
    }
    return {
      gefunden: true,
      name: p?.display_name || "Unbekannt",
      funktion: d.funktion,
      foto: d.foto,
      ausweisNr: d.ausweis_nr,
      gueltigBis: d.gueltig_bis,
      firma: dom?.name ?? null,
      status,
    };
  });

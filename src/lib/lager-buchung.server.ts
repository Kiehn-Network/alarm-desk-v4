import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { maybeSendBestandsAlarm } from "@/lib/lager-alert.server";

export type BuchungInput = {
  domain_id: string;
  artikel_id: string;
  richtung: "eingang" | "ausgang";
  menge: number;
  person_id?: string | null;
  person_name?: string | null;
  signatur?: string | null;
  notiz?: string | null;
};

/** Führt eine Ein-/Ausbuchung durch, schreibt die Historie und prüft den Meldebestand. */
export async function performBuchung(input: BuchungInput) {
  const menge = Math.trunc(Number(input.menge));
  if (!Number.isFinite(menge) || menge <= 0) throw new Error("Bitte eine Menge größer 0 angeben.");

  const { data: artikel, error: aErr } = await supabaseAdmin
    .from("lager_artikel")
    .select("id, domain_id, bezeichnung, bestand, einheit, aktiv")
    .eq("id", input.artikel_id)
    .eq("domain_id", input.domain_id)
    .maybeSingle();
  if (aErr) throw new Error(aErr.message);
  if (!artikel) throw new Error("Artikel nicht gefunden.");
  if (!artikel.aktiv) throw new Error("Dieser Artikel ist deaktiviert.");

  const delta = input.richtung === "eingang" ? menge : -menge;
  const neu = (artikel.bestand ?? 0) + delta;
  if (neu < 0) throw new Error(`Nicht genügend Bestand. Verfügbar: ${artikel.bestand} ${artikel.einheit ?? ""}`.trim());

  const { error: uErr } = await supabaseAdmin
    .from("lager_artikel")
    .update({ bestand: neu })
    .eq("id", artikel.id);
  if (uErr) throw new Error(uErr.message);

  const { error: bErr } = await supabaseAdmin.from("lager_buchungen").insert({
    domain_id: input.domain_id,
    artikel_id: artikel.id,
    person_id: input.person_id ?? null,
    person_name: input.person_name ?? null,
    richtung: input.richtung,
    menge,
    bestand_nachher: neu,
    signatur: input.signatur ?? null,
    notiz: input.notiz ?? null,
  });
  if (bErr) throw new Error(bErr.message);

  await maybeSendBestandsAlarm(artikel.id);

  return { bestand: neu, bezeichnung: artikel.bezeichnung as string, einheit: (artikel.einheit as string) ?? "Stk" };
}

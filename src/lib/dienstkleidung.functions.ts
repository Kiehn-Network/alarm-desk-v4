import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireEffectiveDomainId } from "@/lib/tenant.server";

// =================================================================
// DIENSTKLEIDUNG — Artikelkatalog, Ausgaben mit Größe/Zustand,
// Rückgabe und Fälligkeit, Verbleib je Mitarbeiter
// =================================================================

export const KLEIDUNG_KATEGORIEN = [
  { value: "poloshirt", label: "Poloshirt / T-Shirt" },
  { value: "hemd", label: "Hemd" },
  { value: "hose", label: "Hose" },
  { value: "jacke", label: "Jacke / Mantel" },
  { value: "weste", label: "Weste" },
  { value: "schuhe", label: "Schuhe / Stiefel" },
  { value: "krawatte", label: "Krawatte / Zubehör" },
  { value: "sonstiges", label: "Sonstiges" },
] as const;

export const KLEIDUNG_ZUSTAEND = [
  { value: "neu", label: "Neu" },
  { value: "getragen", label: "Getragen – guter Zustand" },
  { value: "abgenutzt", label: "Abgenutzt" },
  { value: "defekt", label: "Defekt / zu ersetzen" },
] as const;

const S = z.string().trim().max(300).nullish();
const L = z.string().trim().max(4000).nullish();
const pick = (list: readonly { value: string }[], v: unknown, d: string) =>
  list.some((x) => x.value === v) ? String(v) : d;

const katNormal = (v: unknown) => pick(KLEIDUNG_KATEGORIEN, v, "sonstiges");
const zustandNormal = (v: unknown) => pick(KLEIDUNG_ZUSTAEND, v, "neu");

const artikelSchema = z.object({
  name: z.string().trim().min(1).max(200),
  kategorie: z.string().max(30),
  groessen: S,
  notizen: L,
});

const ausgabeSchema = z.object({
  artikel_id: z.string().uuid(),
  mitarbeiter_id: z.string().uuid(),
  groesse: z.string().trim().max(30).nullish(),
  zustand: z.string().max(20),
  ausgegeben_am: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  rueckgabe_faellig: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
  notizen: L,
});

/** Heutiges Datum in Europe/Berlin als YYYY-MM-DD. */
export function heuteBerlin() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" }).format(new Date());
}

function istUeberfaellig(faellig: string | null | undefined, zurueck: string | null | undefined) {
  if (!faellig || zurueck) return false;
  return faellig < heuteBerlin();
}

export const listKleidung = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const domainId = await requireEffectiveDomainId(supabase, userId);
    const [artikel, ausgaben, mitarbeiter] = await Promise.all([
      supabase.from("kleidung_artikel").select("*").eq("domain_id", domainId).order("kategorie").order("name").limit(2000),
      supabase.from("kleidung_ausgaben").select("*").eq("domain_id", domainId).order("created_at", { ascending: false }).limit(3000),
      supabase.from("profiles").select("id, display_name").eq("domain_id", domainId).order("display_name").limit(1000),
    ]);
    if (artikel.error) throw new Error(artikel.error.message);
    if (ausgaben.error) throw new Error(ausgaben.error.message);
    if (mitarbeiter.error) throw new Error(mitarbeiter.error.message);
    const namen = new Map((mitarbeiter.data ?? []).map((m: any) => [m.id, m.display_name || "Unbekannt"]));
    const rows = (ausgaben.data ?? []).map((a: any) => ({
      ...a,
      mitarbeiter_name: namen.get(a.mitarbeiter_id) ?? "Unbekannt",
      ueberfaellig: istUeberfaellig(a.rueckgabe_faellig, a.zurueckgegeben_am),
    }));
    return { artikel: artikel.data ?? [], ausgaben: rows, mitarbeiter: mitarbeiter.data ?? [] };
  });

export const saveArtikel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => artikelSchema.extend({ id: z.string().uuid().nullish() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const domainId = await requireEffectiveDomainId(supabase, userId);
    const row = {
      name: data.name,
      kategorie: katNormal(data.kategorie),
      groessen: data.groessen || null,
      notizen: data.notizen || null,
    };
    if (data.id) {
      const { error } = await supabase.from("kleidung_artikel").update({ ...row, updated_at: new Date().toISOString() }).eq("id", data.id).eq("domain_id", domainId);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from("kleidung_artikel").insert({ ...row, domain_id: domainId });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const deleteArtikel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("kleidung_artikel").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const saveAusgabe = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => ausgabeSchema.extend({ id: z.string().uuid().nullish() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const domainId = await requireEffectiveDomainId(supabase, userId);
    const row = {
      artikel_id: data.artikel_id,
      mitarbeiter_id: data.mitarbeiter_id,
      groesse: data.groesse || null,
      zustand: zustandNormal(data.zustand),
      ausgegeben_am: data.ausgegeben_am,
      rueckgabe_faellig: data.rueckgabe_faellig || null,
      notizen: data.notizen || null,
    };
    if (data.id) {
      const { error } = await supabase.from("kleidung_ausgaben").update({ ...row, updated_at: new Date().toISOString() }).eq("id", data.id).eq("domain_id", domainId);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from("kleidung_ausgaben").insert({ ...row, domain_id: domainId });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const rueckgabeAusgabe = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      id: z.string().uuid(),
      zurueckgegeben_am: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      rueckgabe_zustand: z.string().max(20),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("kleidung_ausgaben")
      .update({
        zurueckgegeben_am: data.zurueckgegeben_am,
        rueckgabe_zustand: zustandNormal(data.rueckgabe_zustand),
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteAusgabe = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("kleidung_ausgaben").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

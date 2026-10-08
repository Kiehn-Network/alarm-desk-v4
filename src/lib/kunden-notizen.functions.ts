import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireEffectiveDomainId } from "@/lib/tenant.server";
import { gehoertZuKunde, type KundenKennung } from "@/lib/kundenakte.functions";

export type KundenNotiz = {
  id: string; text: string; created_at: string; created_by: string;
  autor: string; einsatz_id: string | null; eigene: boolean;
};

const clean = (s: string) => s.replace(/[%_,()*"\\]/g, " ").trim();

async function ladeNotizen(supabase: any, userId: string, k: KundenKennung): Promise<KundenNotiz[]> {
  const ors: string[] = [];
  const name = clean(k.name ?? "");
  if (name) ors.push(`kunden_name.ilike.%${name}%`);
  if (k.tn && clean(k.tn)) ors.push(`teilnehmer_id.eq.${clean(k.tn)}`);
  if (k.anl && clean(k.anl)) ors.push(`anlagen_nr.eq.${clean(k.anl)}`);
  if (!ors.length) return [];
  const { data, error } = await supabase.from("kunden_notizen").select("*")
    .or(ors.join(",")).order("created_at", { ascending: false }).limit(200);
  if (error) throw new Error(error.message);
  const rows = (data ?? []).filter((r: any) => gehoertZuKunde(k, r));
  const ids = Array.from(new Set(rows.map((r: any) => r.created_by))) as string[];
  let namen: Record<string, string> = {};
  if (ids.length) {
    const { data: ps } = await supabase.from("profiles").select("id, display_name").in("id", ids);
    namen = Object.fromEntries((ps ?? []).map((p: any) => [p.id, p.display_name ?? ""]));
  }
  return rows.map((r: any) => ({
    id: r.id, text: r.text, created_at: r.created_at, created_by: r.created_by,
    einsatz_id: r.einsatz_id, autor: namen[r.created_by] || "Unbekannt", eigene: r.created_by === userId,
  }));
}

async function kennungAusEinsatz(supabase: any, einsatzId: string) {
  const { data, error } = await supabase.from("einsaetze")
    .select("id,kunden_name,teilnehmer_id,anlagen_nr,key_number,address").eq("id", einsatzId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Einsatz nicht gefunden.");
  return data;
}

/** Notizen zum Kunden eines Einsatzes (Fahrer-Ansicht). */
export const listNotizenForEinsatz = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ einsatzId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const e = await kennungAusEinsatz(context.supabase, data.einsatzId);
    return ladeNotizen(context.supabase, context.userId, {
      name: e.kunden_name ?? "", tn: e.teilnehmer_id, anl: e.anlagen_nr, key: e.key_number, addr: e.address,
    });
  });

/** Notizen zu einer Kundenkennung (Kundenakte / Leitstelle). */
export const listNotizenForKunde = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    name: z.string().trim().max(200).default(""),
    tn: z.string().trim().max(100).nullish(), anl: z.string().trim().max(100).nullish(),
    key: z.string().trim().max(100).nullish(), addr: z.string().trim().max(300).nullish(),
  }).parse(i))
  .handler(async ({ data, context }) => ladeNotizen(context.supabase, context.userId, data));

export const addNotizForEinsatz = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ einsatzId: z.string().uuid(), text: z.string().trim().min(1).max(2000) }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const domainId = await requireEffectiveDomainId(supabase, userId);
    const e = await kennungAusEinsatz(supabase, data.einsatzId);
    const { error } = await supabase.from("kunden_notizen").insert({
      domain_id: domainId, einsatz_id: e.id, created_by: userId, text: data.text,
      kunden_name: e.kunden_name, teilnehmer_id: e.teilnehmer_id, anlagen_nr: e.anlagen_nr,
      key_number: e.key_number, address: e.address,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteKundenNotiz = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("kunden_notizen").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireEffectiveDomainId } from "@/lib/tenant.server";

// =================================================================
// FINDO-ID — Schlüsselanhänger mit Chip-UID, Fundmeldungen, Rückführung
// =================================================================

export const FINDO_PAKETE = [
  { value: "anhaenger", label: "Nur Anhänger" },
  { value: "basis", label: "Basis (4,99 €/Monat)" },
  { value: "protect", label: "Protect (9,99 €/Monat)" },
] as const;

export const ANHAENGER_STATUS = [
  { value: "aktiv", label: "Aktiv" },
  { value: "verloren", label: "Als verloren gemeldet" },
  { value: "gesperrt", label: "Gesperrt" },
] as const;

export const FUND_STATUS = [
  { value: "gemeldet", label: "Fund gemeldet" },
  { value: "erwartet", label: "Schlüssel erwartet" },
  { value: "eingegangen", label: "Schlüssel eingegangen" },
  { value: "informiert", label: "Besitzer informiert" },
  { value: "zurueckgegeben", label: "Zurückgegeben" },
  { value: "abgeschlossen", label: "Abgeschlossen ohne Rückgabe" },
] as const;

export const FUND_WEGE = [
  { value: "online", label: "Online-Meldung" },
  { value: "post", label: "Direkt per Post" },
  { value: "abgabe", label: "Persönlich abgegeben" },
] as const;

/** FID vergleichbar machen: Großbuchstaben, ohne Leerzeichen/Doppelpunkte/Bindestriche. */
export function fidNormal(v: string) {
  return v.toUpperCase().replace(/[\s:\-]/g, "");
}
/** FID lesbar formatieren: Zweiergruppen, z. B. "04 A8 7C 92". */
export function fidAnzeige(v: string) {
  const n = fidNormal(v);
  return /^[0-9A-F]+$/.test(n) ? (n.match(/.{1,2}/g) ?? []).join(" ") : n;
}

const S = z.string().trim().max(300).nullish();
const L = z.string().trim().max(4000).nullish();
const pick = (list: readonly { value: string }[], v: unknown, d: string) =>
  list.some((x) => x.value === v) ? String(v) : d;

const anhaengerSchema = z.object({
  fid: z.string().trim().min(4).max(40),
  besitzer_name: z.string().trim().min(1).max(200),
  besitzer_telefon: S,
  besitzer_email: S,
  besitzer_adresse: S,
  paket: z.string().max(20),
  ersatz_lagerort: S,
  status: z.string().max(20),
  notizen: L,
});

function anhaengerRow(d: z.infer<typeof anhaengerSchema>) {
  return {
    fid: fidNormal(d.fid),
    besitzer_name: d.besitzer_name,
    besitzer_telefon: d.besitzer_telefon || null,
    besitzer_email: d.besitzer_email || null,
    besitzer_adresse: d.besitzer_adresse || null,
    paket: pick(FINDO_PAKETE, d.paket, "basis"),
    ersatz_lagerort: d.paket === "protect" ? d.ersatz_lagerort || null : null,
    status: pick(ANHAENGER_STATUS, d.status, "aktiv"),
    notizen: d.notizen || null,
  };
}

function dbFehler(e: { message: string; code?: string }) {
  if (e.code === "23505") return new Error("Diese FID ist bereits vergeben.");
  return new Error(e.message);
}

export const listFindo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const domainId = await requireEffectiveDomainId(supabase, userId);
    const [a, f] = await Promise.all([
      supabase.from("findo_anhaenger").select("*").eq("domain_id", domainId).order("created_at", { ascending: false }).limit(2000),
      supabase.from("findo_fundmeldungen").select("*").eq("domain_id", domainId).order("created_at", { ascending: false }).limit(1000),
    ]);
    if (a.error) throw new Error(a.error.message);
    if (f.error) throw new Error(f.error.message);
    return { anhaenger: a.data ?? [], meldungen: f.data ?? [] };
  });

export const saveAnhaenger = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => anhaengerSchema.extend({ id: z.string().uuid().nullish() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const domainId = await requireEffectiveDomainId(supabase, userId);
    const row = anhaengerRow(data);
    if (data.id) {
      const { error } = await supabase.from("findo_anhaenger").update({ ...row, updated_at: new Date().toISOString() }).eq("id", data.id).eq("domain_id", domainId);
      if (error) throw dbFehler(error);
    } else {
      const { error } = await supabase.from("findo_anhaenger").insert({ ...row, domain_id: domainId });
      if (error) throw dbFehler(error);
    }
    return { ok: true };
  });

export const deleteAnhaenger = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("findo_anhaenger").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Interne Erfassung, z. B. wenn ein Schlüssel per Post ankommt. */
export const createMeldungIntern = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ fid: z.string().trim().min(4).max(40), weg: z.string().max(20), finder_name: S, finder_kontakt: S, fundort: S, nachricht: L }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const domainId = await requireEffectiveDomainId(supabase, userId);
    const { data: a } = await supabase.from("findo_anhaenger").select("id").eq("domain_id", domainId).eq("fid", fidNormal(data.fid)).maybeSingle();
    if (!a) throw new Error("Keine Findo-ID mit dieser FID gefunden.");
    const weg = pick(FUND_WEGE, data.weg, "post");
    const { data: p } = await supabase.from("profiles").select("display_name").eq("id", userId).maybeSingle();
    const { error } = await supabase.from("findo_fundmeldungen").insert({
      domain_id: domainId, anhaenger_id: a.id, weg,
      status: weg === "online" ? "gemeldet" : "eingegangen",
      finder_name: data.finder_name || null, finder_kontakt: data.finder_kontakt || null,
      fundort: data.fundort || null, nachricht: data.nachricht || null,
      bearbeitet_von_name: p?.display_name ?? null,
    });
    if (error) throw new Error(error.message);
    await supabase.from("findo_anhaenger").update({ status: "verloren" }).eq("id", a.id);
    return { ok: true };
  });

export const updateMeldung = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid(), status: z.string().max(20), notizen: L }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: p } = await supabase.from("profiles").select("display_name").eq("id", userId).maybeSingle();
    const status = pick(FUND_STATUS, data.status, "gemeldet");
    const { data: m, error } = await supabase
      .from("findo_fundmeldungen")
      .update({ status, notizen: data.notizen || null, bearbeitet_von_name: p?.display_name ?? null, updated_at: new Date().toISOString() })
      .eq("id", data.id).select("anhaenger_id").maybeSingle();
    if (error) throw new Error(error.message);
    if (m && (status === "zurueckgegeben" || status === "abgeschlossen")) {
      await supabase.from("findo_anhaenger").update({ status: "aktiv" }).eq("id", m.anhaenger_id);
    }
    return { ok: true };
  });

export const deleteMeldung = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("findo_fundmeldungen").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Öffentlich: Finder meldet einen Fund ----------
// Gibt bewusst KEINE Besitzerdaten zurück, nur die Rücksendestelle.

export const pruefeFid = createServerFn({ method: "POST" })
  .inputValidator((i) => z.object({ fid: z.string().trim().min(4).max(40) }).parse(i))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: a } = await supabaseAdmin.from("findo_anhaenger").select("id, domain_id, status").eq("fid", fidNormal(data.fid)).maybeSingle();
    if (!a || a.status === "gesperrt") return { gefunden: false as const };
    const { data: dom } = await supabaseAdmin.from("domains").select("name").eq("id", a.domain_id).maybeSingle();
    return { gefunden: true as const, stelle: dom?.name ?? "Alarmzentrale" };
  });

export const meldeFund = createServerFn({ method: "POST" })
  .inputValidator((i) =>
    z.object({
      fid: z.string().trim().min(4).max(40),
      finder_name: z.string().trim().max(120).nullish(),
      finder_kontakt: z.string().trim().max(200).nullish(),
      fundort: z.string().trim().max(300).nullish(),
      nachricht: z.string().trim().max(1500).nullish(),
      sendet_per_post: z.boolean().optional(),
    }).parse(i),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: a } = await supabaseAdmin.from("findo_anhaenger").select("id, domain_id, status").eq("fid", fidNormal(data.fid)).maybeSingle();
    if (!a || a.status === "gesperrt") return { ok: false as const };
    // Spam-Schutz: höchstens 3 offene Online-Meldungen je Anhänger in 24 h
    const seit = new Date(Date.now() - 86400000).toISOString();
    const { count } = await supabaseAdmin.from("findo_fundmeldungen").select("id", { count: "exact", head: true }).eq("anhaenger_id", a.id).gte("created_at", seit);
    if ((count ?? 0) >= 3) return { ok: true as const };
    await supabaseAdmin.from("findo_fundmeldungen").insert({
      domain_id: a.domain_id, anhaenger_id: a.id, weg: "online",
      status: data.sendet_per_post ? "erwartet" : "gemeldet",
      finder_name: data.finder_name || null, finder_kontakt: data.finder_kontakt || null,
      fundort: data.fundort || null, nachricht: data.nachricht || null,
    });
    await supabaseAdmin.from("findo_anhaenger").update({ status: "verloren" }).eq("id", a.id);
    return { ok: true as const };
  });

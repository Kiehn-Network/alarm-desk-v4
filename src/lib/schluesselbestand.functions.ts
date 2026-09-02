import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireEffectiveDomainId } from "@/lib/tenant.server";

// =================================================================
// SCHLÜSSELBESTAND — Stammdaten, Soll/Ist-Abgleich, Inventur
// =================================================================

export type BestandRow = {
  id: string;
  key_number: string;
  bezeichnung: string | null;
  kunden_name: string | null;
  address: string | null;
  objekt: string | null;
  schrank: string | null;
  fach: string | null;
  anzahl_soll: number;
  zustand: string;
  label_code: string | null;
  notiz: string | null;
  aktiv: boolean;
  created_at: string;
  updated_at: string;
  /** aus Schlüsselbuch abgeleitet */
  draussen: number;
  im_depot: number;
  traeger: string[];
  ueberfaellig: boolean;
  warnungen: string[];
};

const OPEN_STATUS: Array<"ausgegeben" | "uebernommen" | "rueckgabe_offen"> = ["ausgegeben", "uebernommen", "rueckgabe_offen"];

export const listSchluesselBestand = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const domainId = await requireEffectiveDomainId(supabase, userId);

    const [{ data: bestand, error }, { data: buch }] = await Promise.all([
      supabase
        .from("schluessel_bestand")
        .select("*")
        .eq("domain_id", domainId)
        .order("key_number", { ascending: true }),
      supabase
        .from("schluessel_buch")
        .select("key_number, status, traeger_name, ausgegeben_at")
        .eq("domain_id", domainId)
        .in("status", OPEN_STATUS),
    ]);
    if (error) throw new Error(error.message);

    const now = Date.now();
    const byKey = new Map<string, { count: number; traeger: string[]; ueberfaellig: boolean }>();
    for (const b of buch ?? []) {
      const k = (b.key_number ?? "").trim().toLowerCase();
      const cur = byKey.get(k) ?? { count: 0, traeger: [], ueberfaellig: false };
      cur.count += 1;
      if (b.traeger_name && !cur.traeger.includes(b.traeger_name)) cur.traeger.push(b.traeger_name);
      if (b.ausgegeben_at && now - new Date(b.ausgegeben_at).getTime() > 24 * 3600 * 1000) cur.ueberfaellig = true;
      byKey.set(k, cur);
    }

    const rows: BestandRow[] = (bestand ?? []).map((b: any) => {
      const live = byKey.get((b.key_number ?? "").trim().toLowerCase());
      const draussen = live?.count ?? 0;
      const im_depot = b.anzahl_soll - draussen;
      const warnungen: string[] = [];
      if (im_depot < 0) warnungen.push("Mehr Schlüssel unterwegs als im Bestand hinterlegt");
      if (live?.ueberfaellig) warnungen.push("Rückgabe überfällig (> 24 h)");
      if (b.zustand && b.zustand !== "ok") warnungen.push(`Zustand: ${b.zustand}`);
      if (!b.aktiv) warnungen.push("Inaktiv / ausgemustert");
      return {
        ...b,
        draussen,
        im_depot,
        traeger: live?.traeger ?? [],
        ueberfaellig: live?.ueberfaellig ?? false,
        warnungen,
      };
    });

    // Schlüssel, die im Buch bewegt werden, aber keinen Bestands-Eintrag haben
    const known = new Set(rows.map((r) => r.key_number.trim().toLowerCase()));
    const unbekannt = [...byKey.keys()].filter((k) => k && !known.has(k));

    return { rows, unbekannt };
  });

const upsertSchema = z.object({
  id: z.string().uuid().optional(),
  key_number: z.string().trim().min(1).max(100),
  bezeichnung: z.string().max(200).optional().nullable(),
  kunden_name: z.string().max(200).optional().nullable(),
  address: z.string().max(300).optional().nullable(),
  objekt: z.string().max(200).optional().nullable(),
  schrank: z.string().max(100).optional().nullable(),
  fach: z.string().max(100).optional().nullable(),
  anzahl_soll: z.coerce.number().int().min(0).max(9999).default(1),
  zustand: z.string().max(50).default("ok"),
  label_code: z.string().max(120).optional().nullable(),
  notiz: z.string().max(2000).optional().nullable(),
  aktiv: z.boolean().default(true),
});

export const upsertSchluesselBestand = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => upsertSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const domainId = await requireEffectiveDomainId(supabase, userId);
    const { id, ...rest } = data;
    const payload: any = { ...rest, domain_id: domainId };
    for (const k of Object.keys(payload)) if (payload[k] === "") payload[k] = null;

    if (id) {
      const { data: row, error } = await supabase
        .from("schluessel_bestand").update(payload).eq("id", id).select().single();
      if (error) throw new Error(error.message);
      return row;
    }
    const { data: row, error } = await supabase
      .from("schluessel_bestand").insert({ ...payload, created_by: userId }).select().single();
    if (error) {
      if (error.code === "23505") throw new Error("Diese Schlüsselnummer existiert bereits im Bestand.");
      throw new Error(error.message);
    }
    return row;
  });

export const deleteSchluesselBestand = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("schluessel_bestand").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const importSchema = z.object({
  rows: z.array(z.object({
    key_number: z.string().trim().min(1).max(100),
    bezeichnung: z.string().max(200).optional().nullable(),
    kunden_name: z.string().max(200).optional().nullable(),
    address: z.string().max(300).optional().nullable(),
    objekt: z.string().max(200).optional().nullable(),
    schrank: z.string().max(100).optional().nullable(),
    fach: z.string().max(100).optional().nullable(),
    anzahl_soll: z.coerce.number().int().min(0).max(9999).default(1),
    notiz: z.string().max(2000).optional().nullable(),
  })).min(1).max(5000),
  updateExisting: z.boolean().default(true),
});

export const importSchluesselBestand = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => importSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const domainId = await requireEffectiveDomainId(supabase, userId);

    const { data: existing } = await supabase
      .from("schluessel_bestand").select("id, key_number").eq("domain_id", domainId);
    const map = new Map((existing ?? []).map((e: any) => [e.key_number.trim().toLowerCase(), e.id]));

    let created = 0, updated = 0, skipped = 0;
    for (const r of data.rows) {
      const existingId = map.get(r.key_number.trim().toLowerCase());
      if (existingId) {
        if (!data.updateExisting) { skipped++; continue; }
        const { error } = await supabase.from("schluessel_bestand").update({ ...r }).eq("id", existingId);
        if (error) throw new Error(error.message);
        updated++;
      } else {
        const { error } = await supabase.from("schluessel_bestand")
          .insert({ ...r, domain_id: domainId, created_by: userId });
        if (error) throw new Error(error.message);
        created++;
      }
    }
    return { created, updated, skipped };
  });

// ---------------- Inventur ----------------

export const listInventuren = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const domainId = await requireEffectiveDomainId(supabase, userId);
    const { data, error } = await supabase
      .from("schluessel_inventuren").select("*").eq("domain_id", domainId)
      .order("gestartet_at", { ascending: false }).limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const startInventur = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ titel: z.string().trim().min(1).max(200) }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const domainId = await requireEffectiveDomainId(supabase, userId);

    const { data: inv, error } = await supabase.from("schluessel_inventuren")
      .insert({ domain_id: domainId, titel: data.titel, gestartet_von: userId })
      .select().single();
    if (error) throw new Error(error.message);

    const { data: bestand } = await supabase
      .from("schluessel_bestand").select("id, key_number, anzahl_soll")
      .eq("domain_id", domainId).eq("aktiv", true);

    if (bestand?.length) {
      const { error: pErr } = await supabase.from("schluessel_inventur_positionen").insert(
        bestand.map((b: any) => ({
          domain_id: domainId, inventur_id: inv.id, bestand_id: b.id,
          key_number: b.key_number, anzahl_soll: b.anzahl_soll,
        })),
      );
      if (pErr) throw new Error(pErr.message);
    }
    return inv;
  });

export const listInventurPositionen = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ inventur_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("schluessel_inventur_positionen").select("*")
      .eq("inventur_id", data.inventur_id).order("key_number", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const setInventurPosition = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    id: z.string().uuid(),
    anzahl_ist: z.coerce.number().int().min(0).max(9999),
    notiz: z.string().max(1000).optional().nullable(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: pos, error: pErr } = await supabase
      .from("schluessel_inventur_positionen").select("anzahl_soll").eq("id", data.id).single();
    if (pErr) throw new Error(pErr.message);

    const soll = pos?.anzahl_soll ?? 0;
    const ergebnis = data.anzahl_ist === soll ? "ok" : data.anzahl_ist < soll ? "fehlt" : "zusaetzlich";

    const { data: row, error } = await supabase.from("schluessel_inventur_positionen")
      .update({
        anzahl_ist: data.anzahl_ist,
        notiz: data.notiz ?? null,
        ergebnis,
        geprueft_von: userId,
        geprueft_at: new Date().toISOString(),
      })
      .eq("id", data.id).select().single();
    if (error) throw new Error(error.message);
    return row;
  });

export const abschliessenInventur = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid(), notiz: z.string().max(2000).optional().nullable() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase.from("schluessel_inventuren")
      .update({ status: "abgeschlossen", abgeschlossen_at: new Date().toISOString(), notiz: data.notiz ?? null })
      .eq("id", data.id).select().single();
    if (error) throw new Error(error.message);
    return row;
  });

// ---------------- Kundenansicht (Dateiverwaltung) ----------------

/**
 * Schlüsselbestand zu einem Kunden / einer Schlüssel-Nr. inkl. Live-Status
 * aus dem Schlüsselbuch (für die Kunden-/Dateiverwaltung).
 */
export const listBestandForKunde = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      kunden_name: z.string().trim().max(200).optional().nullable(),
      key_number: z.string().trim().max(100).optional().nullable(),
      address: z.string().trim().max(300).optional().nullable(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const domainId = await requireEffectiveDomainId(supabase, userId);

    const name = (data.kunden_name ?? "").trim();
    const key = (data.key_number ?? "").trim();
    const addr = (data.address ?? "").trim();
    if (!name && !key && !addr) return { rows: [] as BestandRow[] };

    // Die Schlüssel-Nr. in der Dateiverwaltung ist die führende Verknüpfung.
    // Dadurch werden auch Bestandszeilen ohne separat gepflegten Kundennamen gefunden.
    const dateiOrs: string[] = [];
    if (name) dateiOrs.push(`kunden_name.ilike.%${name}%`);
    if (key) dateiOrs.push(`key_number.eq.${key}`);
    if (addr) dateiOrs.push(`address.ilike.%${addr}%`);
    const { data: dateien, error: dateiError } = await supabase
      .from("dateien")
      .select("key_number")
      .eq("domain_id", domainId)
      .is("deleted_at", null)
      .or(dateiOrs.join(","))
      .limit(5000);
    if (dateiError) throw new Error(dateiError.message);

    const dateiKeys = (dateien ?? [])
      .map((d: any) => (d.key_number ?? "").trim())
      .filter(Boolean);
    const allKeys = [...new Set([key, ...dateiKeys].filter(Boolean))];

    let q = supabase.from("schluessel_bestand").select("*").eq("domain_id", domainId);
    const bestandOrs: string[] = [];
    if (name) bestandOrs.push(`kunden_name.ilike.%${name}%`);
    if (addr) bestandOrs.push(`address.ilike.%${addr}%`);
    if (allKeys.length) bestandOrs.push(`key_number.in.(${allKeys.join(",")})`);
    if (!bestandOrs.length) return { rows: [] as BestandRow[] };
    q = q.or(bestandOrs.join(","));
    const { data: bestand, error } = await q.order("key_number", { ascending: true }).limit(200);
    if (error) throw new Error(error.message);
    if (!bestand?.length) return { rows: [] as BestandRow[] };

    const keys = bestand.map((b: any) => b.key_number);
    const { data: buch } = await supabase
      .from("schluessel_buch")
      .select("key_number, status, traeger_name, ausgegeben_at")
      .eq("domain_id", domainId)
      .in("status", OPEN_STATUS)
      .in("key_number", keys);

    const now = Date.now();
    const byKey = new Map<string, { count: number; traeger: string[]; ueberfaellig: boolean }>();
    for (const b of buch ?? []) {
      const k = (b.key_number ?? "").trim().toLowerCase();
      const cur = byKey.get(k) ?? { count: 0, traeger: [], ueberfaellig: false };
      cur.count += 1;
      if (b.traeger_name && !cur.traeger.includes(b.traeger_name)) cur.traeger.push(b.traeger_name);
      if (b.ausgegeben_at && now - new Date(b.ausgegeben_at).getTime() > 24 * 3600 * 1000) cur.ueberfaellig = true;
      byKey.set(k, cur);
    }

    const rows: BestandRow[] = bestand.map((b: any) => {
      const live = byKey.get((b.key_number ?? "").trim().toLowerCase());
      const draussen = live?.count ?? 0;
      const im_depot = b.anzahl_soll - draussen;
      const warnungen: string[] = [];
      if (im_depot < 0) warnungen.push("Mehr Schlüssel unterwegs als im Bestand hinterlegt");
      if (live?.ueberfaellig) warnungen.push("Rückgabe überfällig (> 24 h)");
      if (b.zustand && b.zustand !== "ok") warnungen.push(`Zustand: ${b.zustand}`);
      if (!b.aktiv) warnungen.push("Inaktiv / ausgemustert");
      return {
        ...b,
        draussen,
        im_depot,
        traeger: live?.traeger ?? [],
        ueberfaellig: live?.ueberfaellig ?? false,
        warnungen,
      };
    });

    return { rows };
  });

// =================================================================
// Verknüpfung mit der Dateiverwaltung (Schlüssel-Nr. beim Kunden)
// =================================================================

export type DateiSchluessel = {
  key_number: string;
  kunden_name: string | null;
  address: string | null;
  count: number;
};

/** Alle in der Dateiverwaltung hinterlegten Schlüssel-Nummern der Domäne. */
export const listDateiSchluessel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const domainId = await requireEffectiveDomainId(supabase, userId);

    const { data, error } = await supabase
      .from("dateien")
      .select("key_number, kunden_name, address")
      .eq("domain_id", domainId)
      .is("deleted_at", null)
      .not("key_number", "is", null)
      .limit(5000);
    if (error) throw new Error(error.message);

    const map = new Map<string, DateiSchluessel>();
    for (const d of data ?? []) {
      const k = (d.key_number ?? "").trim();
      if (!k) continue;
      const cur = map.get(k.toLowerCase());
      if (cur) {
        cur.count += 1;
        if (!cur.kunden_name && d.kunden_name) cur.kunden_name = d.kunden_name;
        if (!cur.address && d.address) cur.address = d.address;
      } else {
        map.set(k.toLowerCase(), {
          key_number: k,
          kunden_name: d.kunden_name ?? null,
          address: d.address ?? null,
          count: 1,
        });
      }
    }
    const rows = Array.from(map.values()).sort((a, b) =>
      a.key_number.localeCompare(b.key_number, "de", { numeric: true }),
    );
    return { rows };
  });

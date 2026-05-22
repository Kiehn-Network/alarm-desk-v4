import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireEffectiveDomainId } from "@/lib/tenant.server";

// ---------- OBJEKTE ----------

export const listObjekte = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("owks_objekte")
      .select("*")
      .order("name");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const upsertObjekt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      id: z.string().uuid().nullish(),
      name: z.string().trim().min(1).max(200),
      kunden_name: z.string().trim().max(200).nullish(),
      adresse: z.string().trim().max(300).nullish(),
      ort: z.string().trim().max(120).nullish(),
      plz: z.string().trim().max(20).nullish(),
      lat: z.number().nullish(),
      lng: z.number().nullish(),
      notizen: z.string().max(2000).nullish(),
      aktiv: z.boolean().optional(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const domain_id = await requireEffectiveDomainId(supabase, userId);
    if (data.id) {
      const { error } = await supabase.from("owks_objekte")
        .update({ ...data, id: undefined }).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await supabase.from("owks_objekte")
      .insert({ ...data, id: undefined, domain_id, created_by: userId })
      .select("id").single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const deleteObjekt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("owks_objekte").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- RUNDGÄNGE ----------

export const listRundgaenge = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("owks_rundgaenge")
      .select("*, owks_kontrollpunkte(count)")
      .order("name");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const upsertRundgang = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      id: z.string().uuid().nullish(),
      name: z.string().trim().min(1).max(200),
      rundgang_nr: z.string().trim().max(50).nullish(),
      objekt_id: z.string().uuid().nullish(),
      beschreibung: z.string().max(2000).nullish(),
      aktiv: z.boolean().optional(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const domain_id = await requireEffectiveDomainId(supabase, userId);
    if (data.id) {
      const { error } = await supabase.from("owks_rundgaenge")
        .update({ ...data, id: undefined }).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await supabase.from("owks_rundgaenge")
      .insert({ ...data, id: undefined, domain_id, created_by: userId })
      .select("id").single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const deleteRundgang = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("owks_rundgaenge").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- KONTROLLPUNKTE (NFC) ----------

export const listKontrollpunkte = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ rundgang_id: z.string().uuid().nullish() }).parse(i ?? {}))
  .handler(async ({ data, context }) => {
    let q = context.supabase.from("owks_kontrollpunkte").select("*").order("reihenfolge");
    if (data.rundgang_id) q = q.eq("rundgang_id", data.rundgang_id);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const upsertKontrollpunkt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      id: z.string().uuid().nullish(),
      rundgang_id: z.string().uuid(),
      objekt_id: z.string().uuid().nullish(),
      bezeichnung: z.string().trim().min(1).max(200),
      raum: z.string().trim().max(120).nullish(),
      reihenfolge: z.number().int().min(0).max(9999).default(0),
      nfc_uid: z.string().trim().max(64).nullish(),
      nfc_tag_typ: z.enum(["ntag213","ntag215","ntag216","mifare_classic","mifare_ultralight","desfire","sonstige"]).default("ntag213"),
      lat: z.number().nullish(),
      lng: z.number().nullish(),
      notizen: z.string().max(2000).nullish(),
      aktiv: z.boolean().optional(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const domain_id = await requireEffectiveDomainId(supabase, userId);
    if (data.id) {
      const { error } = await supabase.from("owks_kontrollpunkte")
        .update({ ...data, id: undefined }).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await supabase.from("owks_kontrollpunkte")
      .insert({ ...data, id: undefined, domain_id, created_by: userId })
      .select("id").single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const deleteKontrollpunkt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("owks_kontrollpunkte").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- BESTREIFUNGSPLÄNE ----------

export const listBestreifungsplaene = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("owks_bestreifungsplaene")
      .select("*, owks_rundgaenge(id,name,objekt_id), owks_objekte(id,name)")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const upsertBestreifungsplan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      id: z.string().uuid().nullish(),
      rundgang_id: z.string().uuid(),
      objekt_id: z.string().uuid().nullish(),
      zeit_von: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
      zeit_bis: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
      durchgaenge: z.number().int().min(1).max(100),
      min_dauer_minuten: z.number().int().min(0).max(1440).nullish(),
      max_dauer_minuten: z.number().int().min(0).max(1440).nullish(),
      unterschreitung_unzulaessig: z.boolean().optional(),
      reihenfolge_modus: z.enum(["ignorieren","warnen","strikt"]).default("ignorieren"),
      manuell_buchen: z.boolean().optional(),
      wochentage: z.array(z.number().int().min(1).max(7)).min(1),
      intervall_wochen: z.number().int().min(1).max(52),
      gueltig_ab: z.string(),
      gueltig_bis: z.string().nullish(),
      ferien_modus: z.string().max(50).default("ignorieren"),
      aktiv: z.boolean().optional(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const domain_id = await requireEffectiveDomainId(supabase, userId);
    if (data.id) {
      const { error } = await supabase.from("owks_bestreifungsplaene")
        .update({ ...data, id: undefined }).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await supabase.from("owks_bestreifungsplaene")
      .insert({ ...data, id: undefined, domain_id, created_by: userId })
      .select("id").single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const deleteBestreifungsplan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("owks_bestreifungsplaene").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- ZEITSTRAHL / BESTREIFUNGEN ----------

function dateRange(startISO: string, endISO: string): string[] {
  const s = new Date(startISO + "T00:00:00Z");
  const e = new Date(endISO + "T00:00:00Z");
  const out: string[] = [];
  for (let d = new Date(s); d <= e; d.setUTCDate(d.getUTCDate() + 1)) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

export const getZeitstrahl = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      von: z.string(),
      bis: z.string(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const domain_id = await requireEffectiveDomainId(supabase, userId);

    // Materialize plans -> bestreifungen for date range (idempotent best-effort)
    const { data: plaene } = await supabase
      .from("owks_bestreifungsplaene")
      .select("*").eq("aktiv", true);
    const dates = dateRange(data.von, data.bis);
    const toInsert: any[] = [];
    for (const p of plaene ?? []) {
      const ab = new Date(p.gueltig_ab + "T00:00:00Z").getTime();
      const bis = p.gueltig_bis ? new Date(p.gueltig_bis + "T23:59:59Z").getTime() : Infinity;
      for (const dStr of dates) {
        const d = new Date(dStr + "T00:00:00Z");
        const t = d.getTime();
        if (t < ab || t > bis) continue;
        const dow = ((d.getUTCDay() + 6) % 7) + 1; // 1=Mo..7=So
        const wt: number[] = p.wochentage ?? [];
        if (!wt.includes(dow)) continue;
        const zv = `${dStr}T${p.zeit_von.slice(0,5)}:00Z`;
        const zb = `${dStr}T${p.zeit_bis.slice(0,5)}:00Z`;
        toInsert.push({
          domain_id,
          plan_id: p.id,
          rundgang_id: p.rundgang_id,
          objekt_id: p.objekt_id,
          datum: dStr,
          zeit_von: zv,
          zeit_bis: zb,
          durchgaenge_soll: p.durchgaenge,
          status: "geplant",
          created_by: userId,
        });
      }
    }
    if (toInsert.length > 0) {
      // Naive dedupe: only insert rows that don't already exist
      const { data: existing } = await supabase.from("owks_bestreifungen")
        .select("plan_id,datum")
        .gte("datum", data.von).lte("datum", data.bis);
      const key = (p: string | null, d: string) => `${p ?? ""}|${d}`;
      const have = new Set((existing ?? []).map((r: any) => key(r.plan_id, r.datum)));
      const fresh = toInsert.filter((r) => !have.has(key(r.plan_id, r.datum)));
      if (fresh.length > 0) {
        await supabase.from("owks_bestreifungen").insert(fresh);
      }
    }

    const [{ data: bestreifungen }, { data: objekte }, { data: rundgaenge }] = await Promise.all([
      supabase.from("owks_bestreifungen").select("*")
        .gte("datum", data.von).lte("datum", data.bis).order("zeit_von"),
      supabase.from("owks_objekte").select("id,name").order("name"),
      supabase.from("owks_rundgaenge").select("id,name,objekt_id"),
    ]);
    return {
      bestreifungen: bestreifungen ?? [],
      objekte: objekte ?? [],
      rundgaenge: rundgaenge ?? [],
    };
  });

export const updateBestreifung = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      id: z.string().uuid(),
      zeit_von: z.string().optional(),
      zeit_bis: z.string().optional(),
      status: z.enum(["geplant","aktiv","erledigt","versaeumt","storniert"]).optional(),
      notizen: z.string().max(2000).nullish(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { id, ...patch } = data;
    const { error } = await context.supabase.from("owks_bestreifungen").update(patch).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteBestreifung = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("owks_bestreifungen").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- SCANS (Fahrer) ----------

export const recordScan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      nfc_uid: z.string().trim().min(1).max(64),
      bestreifung_id: z.string().uuid().nullish(),
      lat: z.number().nullish(),
      lng: z.number().nullish(),
      notiz: z.string().max(500).nullish(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const domain_id = await requireEffectiveDomainId(supabase, userId);

    const { data: kp } = await supabase.from("owks_kontrollpunkte")
      .select("*").eq("nfc_uid", data.nfc_uid).maybeSingle();
    if (!kp) throw new Error("Unbekannter NFC-Tag");

    // Find or create a durchgang for today on this rundgang
    const today = new Date().toISOString().slice(0, 10);
    let bestreifungId = data.bestreifung_id;
    if (!bestreifungId) {
      const { data: best } = await supabase.from("owks_bestreifungen")
        .select("id").eq("rundgang_id", kp.rundgang_id).eq("datum", today)
        .order("zeit_von").limit(1).maybeSingle();
      if (best) bestreifungId = best.id;
      else {
        const { data: created, error } = await supabase.from("owks_bestreifungen").insert({
          domain_id, rundgang_id: kp.rundgang_id, objekt_id: kp.objekt_id,
          datum: today,
          zeit_von: new Date().toISOString(),
          zeit_bis: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
          status: "aktiv", durchgaenge_soll: 1, created_by: userId,
        }).select("id").single();
        if (error) throw new Error(error.message);
        bestreifungId = created.id;
      }
    }

    // Find open durchgang or create
    const { data: dg } = await supabase.from("owks_durchgaenge")
      .select("*").eq("bestreifung_id", bestreifungId!)
      .eq("fahrer_id", userId).eq("status", "offen")
      .order("nummer", { ascending: false }).limit(1).maybeSingle();
    let durchgangId = dg?.id;
    if (!durchgangId) {
      const { data: created, error } = await supabase.from("owks_durchgaenge").insert({
        domain_id, bestreifung_id: bestreifungId, fahrer_id: userId,
        nummer: (dg?.nummer ?? 0) + 1, start_at: new Date().toISOString(), status: "offen",
      }).select("id").single();
      if (error) throw new Error(error.message);
      durchgangId = created.id;
    }

    const { error: sErr } = await supabase.from("owks_scans").insert({
      domain_id, durchgang_id: durchgangId, kontrollpunkt_id: kp.id,
      fahrer_id: userId, nfc_uid: data.nfc_uid,
      lat: data.lat ?? null, lng: data.lng ?? null, notiz: data.notiz ?? null,
    });
    if (sErr) throw new Error(sErr.message);
    return { ok: true, kontrollpunkt: { id: kp.id, bezeichnung: kp.bezeichnung, raum: kp.raum } };
  });

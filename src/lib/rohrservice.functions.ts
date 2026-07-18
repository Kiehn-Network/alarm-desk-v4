import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireEffectiveDomainId } from "@/lib/tenant.server";
import { sendEmailForDomain } from "@/lib/email-send.server";
import { loadDomainBranding, brandName } from "@/lib/email-brand.server";
import { renderBrandedEmail } from "@/lib/email-brand";
import { rewriteStorageUrl } from "@/lib/storage-url.server";

// ---------- Notiz / Variante ----------

export const getRohrserviceConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const domainId = await requireEffectiveDomainId(supabase, userId);
    const { data } = await supabase
      .from("app_settings")
      .select("rohrservice_variante, rohrservice_notiz, rohrservice_bericht_email")
      .eq("domain_id", domainId)
      .maybeSingle();
    const { data: files } = await supabase
      .from("rohrservice_notiz_dateien")
      .select("*")
      .order("sort_order")
      .order("created_at");
    return {
      variante: (data?.rohrservice_variante ?? "standard") as "standard" | "budeko",
      notiz: (data?.rohrservice_notiz ?? null) as string | null,
      bericht_email: (data?.rohrservice_bericht_email ?? null) as string | null,
      dateien: (files ?? []) as any[],
    };
  });

async function assertDomainAdmin(supabase: any, userId: string, domainId: string) {
  const { data } = await supabase
    .from("user_roles")
    .select("role,domain_id")
    .eq("user_id", userId)
    .in("role", ["admin", "superadmin"]);
  const ok = (data ?? []).some(
    (r: any) => r.role === "superadmin" || r.domain_id === domainId,
  );
  if (!ok) throw new Error("Nur Admins dürfen diese Einstellung ändern");
}

export const updateRohrserviceConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      variante: z.enum(["standard", "budeko"]).optional(),
      notiz: z.string().max(20000).nullable().optional(),
      bericht_email: z.string().trim().max(200).nullable().optional().transform((v) => {
        if (v === undefined) return undefined;
        if (v === null || v === "") return null;
        return v;
      }),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const domainId = await requireEffectiveDomainId(supabase, userId);
    await assertDomainAdmin(supabase, userId, domainId);

    const patch: any = { domain_id: domainId, updated_by: userId };
    if (data.variante !== undefined) patch.rohrservice_variante = data.variante;
    if (data.notiz !== undefined) patch.rohrservice_notiz = data.notiz;
    if (data.bericht_email !== undefined) patch.rohrservice_bericht_email = data.bericht_email;

    const { error } = await supabase
      .from("app_settings")
      .upsert(patch, { onConflict: "domain_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const uploadNotizSchema = z.object({
  label: z.string().trim().min(1).max(200),
  filename: z.string().min(1).max(200).regex(/^[A-Za-z0-9_\-. ]+$/),
  mime_type: z.string().max(120).optional().nullable(),
  file_base64: z.string().min(10).max(20_000_000),
});

export const uploadNotizDatei = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => uploadNotizSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const domainId = await requireEffectiveDomainId(supabase, userId);
    await assertDomainAdmin(supabase, userId, domainId);

    const safeName = data.filename.replace(/\s+/g, "_");
    const path = `${domainId}/${Date.now()}_${safeName}`;
    const buf = Buffer.from(data.file_base64, "base64");
    const up = await supabaseAdmin.storage
      .from("rohrservice-notizen")
      .upload(path, buf, {
        contentType: data.mime_type ?? "application/octet-stream",
        upsert: false,
      });
    if (up.error) throw new Error("Upload fehlgeschlagen: " + up.error.message);

    const { data: row, error } = await supabase
      .from("rohrservice_notiz_dateien")
      .insert({
        domain_id: domainId,
        label: data.label,
        storage_path: path,
        mime_type: data.mime_type ?? null,
        size_bytes: buf.byteLength,
        created_by: userId,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteNotizDatei = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const domainId = await requireEffectiveDomainId(supabase, userId);
    await assertDomainAdmin(supabase, userId, domainId);

    const { data: row } = await supabase
      .from("rohrservice_notiz_dateien")
      .select("storage_path")
      .eq("id", data.id)
      .maybeSingle();
    if (row?.storage_path) {
      await supabaseAdmin.storage.from("rohrservice-notizen").remove([row.storage_path]);
    }
    const { error } = await supabase
      .from("rohrservice_notiz_dateien")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Mitarbeiter ----------

export const getRohrserviceNotizSignedUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row } = await supabase
      .from("rohrservice_notiz_dateien")
      .select("storage_path")
      .eq("id", data.id)
      .maybeSingle();
    if (!row?.storage_path) throw new Error("Datei nicht gefunden");
    const { data: signed, error } = await supabaseAdmin.storage
      .from("rohrservice-notizen")
      .createSignedUrl(row.storage_path, 60 * 10);
    if (error) throw new Error(error.message);
    return { url: signed.signedUrl };
  });

export const listMitarbeiter = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("rohrservice_mitarbeiter")
      .select("*")
      .order("name");
    if (error) throw new Error(error.message);
    return { mitarbeiter: data ?? [] };
  });

const mitarbeiterSchema = z.object({
  name: z.string().trim().min(1).max(200),
  telefon_1: z.string().trim().max(60).optional().nullable(),
  telefon_2: z.string().trim().max(60).optional().nullable(),
  aktiv: z.boolean().optional(),
});

export const createMitarbeiter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => mitarbeiterSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const domainId = await requireEffectiveDomainId(supabase, userId);
    const { data: row, error } = await supabase
      .from("rohrservice_mitarbeiter")
      .insert({
        ...data,
        telefon_1: data.telefon_1 || null,
        telefon_2: data.telefon_2 || null,
        aktiv: data.aktiv ?? true,
        domain_id: domainId,
        created_by: userId,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateMitarbeiter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => mitarbeiterSchema.partial().extend({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { id, ...patch } = data;
    const { data: row, error } = await context.supabase
      .from("rohrservice_mitarbeiter")
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteMitarbeiter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("rohrservice_mitarbeiter")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Notdienst ----------

export const listNotdienst = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("rohrservice_notdienst")
      .select("*, mitarbeiter:rohrservice_mitarbeiter(id,name,telefon_1,telefon_2)")
      .order("von", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return { eintraege: data ?? [] };
  });

export const getCurrentNotdienst = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const now = new Date().toISOString();
    const { data, error } = await context.supabase
      .from("rohrservice_notdienst")
      .select("*, mitarbeiter:rohrservice_mitarbeiter(id,name,telefon_1,telefon_2)")
      .lte("von", now)
      .gte("bis", now)
      .order("von", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { eintrag: data };
  });

const notdienstSchema = z.object({
  mitarbeiter_id: z.string().uuid(),
  von: z.string().min(1),
  bis: z.string().min(1),
});

export const upsertNotdienst = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    notdienstSchema.extend({ id: z.string().uuid().optional() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const domainId = await requireEffectiveDomainId(supabase, userId);
    if (data.id) {
      const { data: row, error } = await supabase
        .from("rohrservice_notdienst")
        .update({ mitarbeiter_id: data.mitarbeiter_id, von: data.von, bis: data.bis })
        .eq("id", data.id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return row;
    }
    const { data: row, error } = await supabase
      .from("rohrservice_notdienst")
      .insert({
        mitarbeiter_id: data.mitarbeiter_id,
        von: data.von,
        bis: data.bis,
        domain_id: domainId,
        created_by: userId,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteNotdienst = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("rohrservice_notdienst")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Berichte ----------

const berichtSchema = z.object({
  anrufer_name: z.string().max(200).optional().nullable(),
  anrufer_telefon: z.string().max(60).optional().nullable(),
  anrufer_adresse: z.string().max(255).optional().nullable(),
  anrufer_firma: z.string().max(200).optional().nullable(),
  rechnung_name: z.string().max(200).optional().nullable(),
  rechnung_adresse: z.string().max(255).optional().nullable(),
  rechnung_telefon: z.string().max(60).optional().nullable(),
  mieter_name: z.string().max(200).optional().nullable(),
  mieter_telefon: z.string().max(60).optional().nullable(),
  mieter_strasse: z.string().max(200).optional().nullable(),
  mieter_ort: z.string().max(200).optional().nullable(),
  stoerungsart: z.string().max(4000).optional().nullable(),
  weiterleitung: z.enum(["mail", "mobil", "mail_naechster_tag"]).optional().nullable(),
  zeit_kundenanruf: z.string().optional().nullable(),
  zeit_weitergabe: z.string().optional().nullable(),
  monteur_weitergabe: z.string().max(200).optional().nullable(),
  zeit_rueckmeldung: z.string().optional().nullable(),
  monteur_rueckmeldung: z.string().max(200).optional().nullable(),
  diensthabender_alarmzentrale: z.string().max(200).optional().nullable(),
});

function cleanTimes(d: any) {
  const fields = ["zeit_kundenanruf", "zeit_weitergabe", "zeit_rueckmeldung"];
  const out: any = { ...d };
  for (const f of fields) if (out[f] === "" || out[f] == null) out[f] = null;
  return out;
}

export const listBerichte = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("rohrservice_berichte")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return { berichte: data ?? [] };
  });

export const getBericht = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("rohrservice_berichte")
      .select("*")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const createBericht = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => berichtSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const domainId = await requireEffectiveDomainId(supabase, userId);
    const { data: row, error } = await supabase
      .from("rohrservice_berichte")
      .insert({ ...cleanTimes(data), domain_id: domainId, created_by: userId })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateBericht = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => berichtSchema.extend({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { id, ...patch } = data;
    const { data: row, error } = await context.supabase
      .from("rohrservice_berichte")
      .update(cleanTimes(patch))
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteBericht = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("rohrservice_berichte")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Versand ----------

const sendSchema = z.object({
  id: z.string().uuid(),
  recipient_email: z.string().email().max(200),
  pdf_base64: z.string().min(100).max(8_000_000),
  filename: z.string().min(1).max(200).regex(/^[A-Za-z0-9_\-\.]+$/),
});

export const sendBericht = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => sendSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const domainId = await requireEffectiveDomainId(supabase, userId);

    const { data: bericht, error: bErr } = await supabase
      .from("rohrservice_berichte")
      .select("*")
      .eq("id", data.id)
      .single();
    if (bErr || !bericht) throw new Error("Bericht nicht gefunden");

    const path = `rohrservice/${data.id}/${Date.now()}_${data.filename}`;
    const pdfBuf = Buffer.from(data.pdf_base64, "base64");
    const upload = await supabaseAdmin.storage
      .from("dateien")
      .upload(path, pdfBuf, { contentType: "application/pdf", upsert: true });
    if (upload.error) throw new Error("Upload fehlgeschlagen: " + upload.error.message);

    const signed = await supabaseAdmin.storage
      .from("dateien")
      .createSignedUrl(path, 60 * 60 * 24 * 30);
    if (signed.error || !signed.data?.signedUrl) throw new Error("Signed URL fehlgeschlagen");
    const downloadUrl = rewriteStorageUrl(signed.data.signedUrl);

    const titel = `Rohrservice-Bericht #${bericht.bericht_nr}`;
    const subject = titel;
    const branding = await loadDomainBranding(domainId);
    const empfaengerName =
      (bericht as any).anrufer_name ||
      (bericht as any).rechnung_name ||
      (bericht as any).mieter_name ||
      null;
    const html = renderBrandedEmail({
      branding,
      brandName: brandName(branding),
      statusPill: "Rohrservice-Bericht",
      heading: titel,
      greetingName: empfaengerName,
      intro: "anbei finden Sie den Bericht zum Rohrservice-Einsatz als PDF-Dokument.",
      metaTitle: titel,
      metaSubtitle: "PDF · Download 30 Tage gültig",
      ctaLabel: "Bericht herunterladen",
      ctaUrl: downloadUrl,
      closingNote: "Bei Rückfragen zum Einsatz wenden Sie sich bitte an die für Sie zuständige Ansprechperson.",
      previewText: "Ihr Rohrservice-Bericht als PDF",
    });

    try {
      await sendEmailForDomain(domainId, {
        to: data.recipient_email,
        subject,
        html,
        label: "rohrservice-bericht",
      });
    } catch (e: any) {
      throw new Error("Versand fehlgeschlagen: " + String(e?.message ?? e).slice(0, 500));
    }

    await supabase
      .from("rohrservice_berichte")
      .update({
        versendet: true,
        versendet_an: data.recipient_email,
        versendet_am: new Date().toISOString(),
      })
      .eq("id", data.id);

    return { ok: true, downloadUrl, domainId };
  });
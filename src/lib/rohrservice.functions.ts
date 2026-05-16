import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireEffectiveDomainId } from "@/lib/tenant.server";

// ---------- Notiz / Variante ----------

export const getRohrserviceConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const domainId = await requireEffectiveDomainId(supabase, userId);
    const { data } = await supabase
      .from("app_settings")
      .select("rohrservice_variante, rohrservice_notiz")
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
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const domainId = await requireEffectiveDomainId(supabase, userId);
    await assertDomainAdmin(supabase, userId, domainId);

    const patch: any = { domain_id: domainId, updated_by: userId };
    if (data.variante !== undefined) patch.rohrservice_variante = data.variante;
    if (data.notiz !== undefined) patch.rohrservice_notiz = data.notiz;

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

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" } as any)[c],
  );
}

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
    const downloadUrl = signed.data.signedUrl;

    const titel = `Rohrservice-Bericht #${bericht.bericht_nr}`;
    const subject = titel;
    const html = `
      <div style="font-family:Arial,sans-serif;color:#222;max-width:600px;margin:auto;padding:24px">
        <h2 style="margin:0 0 16px">${escapeHtml(titel)}</h2>
        <p>Guten Tag,</p>
        <p>anbei finden Sie den Bericht zum Rohrservice-Einsatz als PDF.</p>
        <p style="margin:24px 0">
          <a href="${downloadUrl}"
             style="display:inline-block;background:#1e293b;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">
            Bericht herunterladen (PDF)
          </a>
        </p>
        <p style="font-size:12px;color:#666">Der Link ist 30 Tage gültig.</p>
        <p>Mit freundlichen Grüßen</p>
      </div>
    `;

    const SENDER_DOMAIN = "notify.einsatz-bericht.de";
    const FROM = `Rohrservice <bericht@${SENDER_DOMAIN}>`;
    const messageId = crypto.randomUUID();
    const idempotencyKey = `rohrservice-bericht-${data.id}-${Date.now()}`;

    const { error: enqErr } = await (supabaseAdmin as any).rpc("enqueue_email", {
      queue_name: "transactional_emails",
      payload: {
        message_id: messageId,
        to: data.recipient_email,
        from: FROM,
        sender_domain: SENDER_DOMAIN,
        subject,
        html,
        purpose: "transactional",
        label: "rohrservice-bericht",
        idempotency_key: idempotencyKey,
        queued_at: new Date().toISOString(),
      },
    });
    if (enqErr) throw new Error("Versand fehlgeschlagen: " + enqErr.message);

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
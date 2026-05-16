import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const inputSchema = z.object({
  einsatz_id: z.string().uuid(),
  recipient_email: z.string().email().max(200),
  pdf_base64: z.string().min(100).max(8_000_000),
  filename: z.string().min(1).max(200).regex(/^[A-Za-z0-9_\-\.]+$/),
});

export const sendBerichtEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => inputSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Berechtigung: Admin oder Disponent
    const { data: roles } = await supabaseAdmin
      .from("user_roles").select("role").eq("user_id", userId);
    const canSend = (roles ?? []).some(
      (r: any) => r.role === "admin" || r.role === "dispatcher",
    );
    if (!canSend) throw new Error("Nur Admin / Disponent dürfen Berichte versenden");

    const { data: einsatz, error: eErr } = await supabase
      .from("einsaetze").select("id, einsatzgrund, kunden_name").eq("id", data.einsatz_id).single();
    if (eErr || !einsatz) throw new Error("Einsatz nicht gefunden");

    // PDF in Storage hochladen → signed URL erzeugen
    const path = `berichte/${data.einsatz_id}/${Date.now()}_${data.filename}`;
    const pdfBuf = Buffer.from(data.pdf_base64, "base64");
    const upload = await supabaseAdmin.storage.from("dateien").upload(path, pdfBuf, {
      contentType: "application/pdf",
      upsert: true,
    });
    if (upload.error) throw new Error("Upload fehlgeschlagen: " + upload.error.message);

    const signed = await supabaseAdmin.storage
      .from("dateien").createSignedUrl(path, 60 * 60 * 24 * 30); // 30 Tage
    if (signed.error || !signed.data?.signedUrl) {
      throw new Error("Signed URL fehlgeschlagen");
    }
    const downloadUrl = signed.data.signedUrl;

    const subject = `Einsatzbericht: ${einsatz.einsatzgrund}`;
    const html = `
      <div style="font-family:Arial,sans-serif;color:#222;max-width:600px;margin:auto;padding:24px">
        <h2 style="margin:0 0 16px">Ihr Einsatzbericht</h2>
        <p>Guten Tag${einsatz.kunden_name ? ` ${escapeHtml(einsatz.kunden_name)}` : ""},</p>
        <p>anbei finden Sie den Bericht zu Ihrem Einsatz <b>${escapeHtml(einsatz.einsatzgrund)}</b> als PDF.</p>
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

    // Enqueue via Lovable Email queue (transactional_emails pgmq queue)
    const SENDER_DOMAIN = "notify.einsatz-bericht.de";
    const FROM = `Einsatzbericht <bericht@${SENDER_DOMAIN}>`;
    const messageId = crypto.randomUUID();
    const idempotencyKey = `einsatz-bericht-${data.einsatz_id}-${Date.now()}`;

    let status: "sent" | "failed" = "sent";
    let errorMessage: string | null = null;
    try {
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
          label: "einsatz-bericht",
          idempotency_key: idempotencyKey,
          queued_at: new Date().toISOString(),
        },
      });
      if (enqErr) {
        status = "failed";
        errorMessage = enqErr.message.slice(0, 500);
      }
    } catch (e: any) {
      status = "failed";
      errorMessage = String(e?.message ?? e).slice(0, 500);
    }

    await supabaseAdmin.from("einsatz_email_log").insert({
      einsatz_id: data.einsatz_id,
      recipient_email: data.recipient_email,
      status,
      error_message: errorMessage,
      sent_by: userId,
    });

    if (status === "failed") {
      throw new Error(
        "Versand fehlgeschlagen. Bitte stelle sicher, dass die Absender-Domain eingerichtet ist. Details: " +
          (errorMessage ?? ""),
      );
    }

    return { ok: true, downloadUrl };
  });

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" } as any)[c],
  );
}
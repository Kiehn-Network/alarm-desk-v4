import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireEffectiveDomainId } from "@/lib/tenant.server";
import { sendEmailForDomain } from "@/lib/email-send.server";

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
    const domainId = await requireEffectiveDomainId(supabase, userId);

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
    const html = renderBerichtEmail({
      kundenName: einsatz.kunden_name ?? null,
      einsatzgrund: einsatz.einsatzgrund ?? "Einsatz",
      downloadUrl,
    });

    let status: "sent" | "failed" = "sent";
    let errorMessage: string | null = null;
    try {
      await sendEmailForDomain(domainId, {
        to: data.recipient_email,
        subject,
        html,
        label: "einsatz-bericht",
      });
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
      domain_id: domainId,
    });

    if (status === "failed") {
      throw new Error("Versand fehlgeschlagen: " + (errorMessage ?? ""));
    }

    return { ok: true, downloadUrl };
  });

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" } as any)[c],
  );
}

function renderBerichtEmail(opts: {
  kundenName: string | null;
  einsatzgrund: string;
  downloadUrl: string;
}) {
  const { kundenName, einsatzgrund, downloadUrl } = opts;
  const greeting = kundenName
    ? `Guten Tag ${escapeHtml(kundenName)},`
    : "Guten Tag,";
  const year = new Date().getFullYear();

  return `<!DOCTYPE html>
<html lang="de">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta name="color-scheme" content="light" />
    <title>Einsatzbericht</title>
  </head>
  <body style="margin:0;padding:24px 12px;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">Ihr Einsatzbericht als PDF</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
            <!-- Header -->
            <tr>
              <td style="padding:8px 4px 20px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="vertical-align:middle;">
                      <table role="presentation" cellpadding="0" cellspacing="0">
                        <tr>
                          <td style="width:40px;height:40px;background:linear-gradient(135deg,#2563eb,#3b82f6);border-radius:10px;text-align:center;vertical-align:middle;">
                            <span style="color:#ffffff;font-size:20px;font-weight:800;line-height:40px;">A</span>
                          </td>
                          <td style="padding-left:12px;vertical-align:middle;">
                            <div style="color:#0f172a;font-size:16px;font-weight:700;line-height:20px;">AlarmDesk</div>
                            <div style="color:#64748b;font-size:10px;font-weight:700;letter-spacing:0.18em;line-height:12px;margin-top:2px;">EINSATZVERWALTUNG</div>
                          </td>
                        </tr>
                      </table>
                    </td>
                    <td style="text-align:right;vertical-align:middle;">
                      <span style="display:inline-block;font-size:11px;font-weight:600;color:#10b981;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:999px;padding:4px 10px;letter-spacing:0.05em;">● Einsatzbericht</span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Card -->
            <tr>
              <td style="background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;padding:32px 28px;box-shadow:0 1px 2px rgba(15,23,42,0.04);">
                <div style="color:#0f172a;font-size:24px;font-weight:700;margin:0 0 12px;letter-spacing:-0.01em;">Ihr Einsatzbericht</div>
                <p style="color:#334155;font-size:15px;line-height:1.6;margin:0 0 8px;">${greeting}</p>
                <p style="color:#334155;font-size:15px;line-height:1.6;margin:0 0 20px;">
                  anbei erhalten Sie den Bericht zu Ihrem Einsatz
                  <strong style="color:#0f172a;">${escapeHtml(einsatzgrund)}</strong>
                  als PDF-Dokument.
                </p>

                <!-- Info panel -->
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 24px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;">
                  <tr>
                    <td style="padding:14px 16px;">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                          <td style="width:36px;vertical-align:middle;">
                            <div style="width:32px;height:32px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;text-align:center;line-height:30px;color:#2563eb;font-size:16px;font-weight:700;">📄</div>
                          </td>
                          <td style="padding-left:12px;vertical-align:middle;">
                            <div style="color:#0f172a;font-size:13px;font-weight:600;line-height:18px;">${escapeHtml(einsatzgrund)}</div>
                            <div style="color:#64748b;font-size:12px;line-height:16px;margin-top:2px;">PDF · Download 30 Tage gültig</div>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>

                <!-- CTA -->
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td align="center" style="padding:8px 0 8px;">
                      <a href="${downloadUrl}" style="display:inline-block;background:linear-gradient(135deg,#2563eb,#3b82f6);background-color:#2563eb;color:#ffffff;font-size:15px;font-weight:700;border-radius:12px;padding:14px 28px;text-decoration:none;box-shadow:0 4px 14px rgba(37,99,235,0.35);">
                        Bericht herunterladen →
                      </a>
                    </td>
                  </tr>
                </table>

                <p style="color:#94a3b8;font-size:12px;margin:20px 0 6px;text-align:center;">
                  Falls der Button nicht funktioniert, kopieren Sie diesen Link in Ihren Browser:
                </p>
                <p style="margin:0;text-align:center;word-break:break-all;">
                  <a href="${downloadUrl}" style="color:#2563eb;font-size:12px;text-decoration:underline;">${downloadUrl}</a>
                </p>

                <div style="border-top:1px solid #f1f5f9;margin:24px 0 16px;"></div>

                <p style="color:#64748b;font-size:13px;line-height:1.6;margin:0;">
                  Bei Rückfragen zum Einsatz wenden Sie sich bitte an die für Sie zuständige Ansprechperson.
                </p>
                <p style="color:#0f172a;font-size:14px;font-weight:600;margin:16px 0 0;">
                  Mit freundlichen Grüßen
                </p>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="padding:20px 4px 0;text-align:center;">
                <div style="border-top:1px solid #f1f5f9;margin:0 0 16px;"></div>
                <p style="color:#94a3b8;font-size:11px;margin:4px 0 0;">© ${year} AlarmDesk · Einsatzverwaltung</p>
                <p style="color:#94a3b8;font-size:11px;margin:4px 0 0;">Diese E-Mail wurde automatisch versendet. Bitte nicht antworten.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
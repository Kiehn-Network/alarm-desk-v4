import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireEffectiveDomainId } from "@/lib/tenant.server";
import { sendEmailForDomain } from "@/lib/email-send.server";
import { loadDomainBranding, brandName } from "@/lib/email-brand.server";
import { renderBrandedEmail } from "@/lib/email-brand";
import { rewriteStorageUrl } from "@/lib/storage-url.server";
import { renderEinsatzInlineHtml } from "@/lib/bericht-inline";

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
      .from("einsaetze").select("*").eq("id", data.einsatz_id).single();
    if (eErr || !einsatz) throw new Error("Einsatz nicht gefunden");

    // Versandmodus der Domäne bestimmen (link = Download-Link, inline = Klartext in der E-Mail)
    const { data: settings } = await supabaseAdmin
      .from("app_settings").select("bericht_versand_mode").eq("domain_id", domainId).maybeSingle();
    const mode: "link" | "inline" = ((settings as any)?.bericht_versand_mode === "inline") ? "inline" : "link";

    let downloadUrl: string | null = null;
    if (mode === "link") {
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
      downloadUrl = rewriteStorageUrl(signed.data.signedUrl);
    }

    const subject = `Einsatzbericht: ${einsatz.einsatzgrund}`;
    const branding = await loadDomainBranding(domainId);
    const html = renderBrandedEmail({
      branding,
      brandName: brandName(branding),
      statusPill: "Einsatzbericht",
      heading: "Ihr Einsatzbericht",
      greetingName: einsatz.kunden_name ?? null,
      intro: mode === "inline"
        ? `nachfolgend finden Sie die Details zu Ihrem Einsatz "${einsatz.einsatzgrund ?? "Einsatz"}".`
        : `anbei erhalten Sie den Bericht zu Ihrem Einsatz "${einsatz.einsatzgrund ?? "Einsatz"}" als PDF-Dokument.`,
      metaTitle: mode === "inline" ? undefined : (einsatz.einsatzgrund ?? "Einsatzbericht"),
      metaSubtitle: mode === "inline" ? undefined : "PDF · Download 30 Tage gültig",
      ctaLabel: mode === "inline" ? undefined : "Bericht herunterladen",
      ctaUrl: mode === "inline" ? undefined : (downloadUrl ?? undefined),
      bodyHtml: mode === "inline" ? renderEinsatzInlineHtml(einsatz, null) : undefined,
      closingNote: "Bei Rückfragen zum Einsatz wenden Sie sich bitte an die für Sie zuständige Ansprechperson.",
      previewText: mode === "inline" ? "Ihr Einsatzbericht" : "Ihr Einsatzbericht als PDF",
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

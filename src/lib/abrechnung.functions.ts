import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireEffectiveDomainId } from "@/lib/tenant.server";
import { sendEmailForDomain } from "@/lib/email-send.server";
import { loadDomainBranding, brandName } from "@/lib/email-brand.server";
import { renderBrandedEmail } from "@/lib/email-brand";
import { rewriteStorageUrl } from "@/lib/storage-url.server";

const providerEnum = z.enum(["malteser", "johanniter", "lgwa"]);

function monthRange(monthStr: string) {
  // monthStr: "YYYY-MM"
  const [y, m] = monthStr.split("-").map(Number);
  if (!y || !m || m < 1 || m > 12) throw new Error("Ungültiger Monat");
  const start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0));
  const end = new Date(Date.UTC(y, m, 1, 0, 0, 0));
  return { startISO: start.toISOString(), endISO: end.toISOString(), firstOfMonth: `${y}-${String(m).padStart(2, "0")}-01` };
}

export const listProviderEinsaetze = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      provider: providerEnum,
      month: z.string().regex(/^\d{4}-\d{2}$/),
      excludeStorno: z.boolean().optional(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const domainId = await requireEffectiveDomainId(supabase, userId);
    const { startISO, endISO } = monthRange(data.month);
    let q = supabase
      .from("einsaetze").select("*")
      .eq("domain_id", domainId)
      .eq("einsatz_typ", "hausnotruf")
      .eq("hausnotruf_provider", data.provider)
      .gte("created_at", startISO).lt("created_at", endISO)
      .order("created_at", { ascending: true })
      .limit(2000);
    if (data.excludeStorno) q = q.neq("status", "storniert");
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const ids = new Set<string>();
    (rows ?? []).forEach((e: any) => { if (e.assigned_to) ids.add(e.assigned_to); });
    let profiles: Record<string, string> = {};
    if (ids.size > 0) {
      const { data: ps } = await supabase.from("profiles").select("id, display_name").in("id", Array.from(ids));
      profiles = Object.fromEntries((ps ?? []).map((p: any) => [p.id, p.display_name ?? ""]));
    }
    return { einsaetze: rows ?? [], profiles };
  });

export const getProviderSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ provider: providerEnum }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const domainId = await requireEffectiveDomainId(supabase, userId);
    const { data: row, error } = await supabase
      .from("hausnotruf_provider_settings").select("*")
      .eq("domain_id", domainId).eq("provider_key", data.provider).maybeSingle();
    if (error) throw new Error(error.message);
    return { settings: row ?? null };
  });

export const upsertProviderSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      provider: providerEnum,
      recipient_email: z.string().email().max(200).nullable(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const domainId = await requireEffectiveDomainId(supabase, userId);
    const { error } = await supabase
      .from("hausnotruf_provider_settings")
      .upsert({
        domain_id: domainId,
        provider_key: data.provider,
        recipient_email: data.recipient_email,
        updated_at: new Date().toISOString(),
        updated_by: userId,
      }, { onConflict: "domain_id,provider_key" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const sendAbrechnungEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      provider: providerEnum,
      month: z.string().regex(/^\d{4}-\d{2}$/),
      recipient_email: z.string().email().max(200),
      pdf_base64: z.string().min(100).max(15_000_000),
      filename: z.string().min(1).max(200).regex(/^[A-Za-z0-9_\-\.]+$/),
      einsatz_count: z.number().int().min(0).max(10000),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const domainId = await requireEffectiveDomainId(supabase, userId);
    const { firstOfMonth } = monthRange(data.month);

    const { data: roles } = await supabaseAdmin
      .from("user_roles").select("role").eq("user_id", userId);
    const canSend = (roles ?? []).some((r: any) => r.role === "admin" || r.role === "dispatcher" || r.role === "superadmin");
    if (!canSend) throw new Error("Nur Admin / Disponent dürfen Abrechnungen versenden");

    const providerLabel =
      data.provider === "malteser" ? "Malteser"
      : data.provider === "johanniter" ? "Johanniter"
      : "LüWa";

    const path = `abrechnungen/${domainId}/${data.provider}/${data.month}/${Date.now()}_${data.filename}`;
    const pdfBuf = Buffer.from(data.pdf_base64, "base64");
    const upload = await supabaseAdmin.storage.from("dateien").upload(path, pdfBuf, {
      contentType: "application/pdf",
      upsert: true,
    });
    if (upload.error) throw new Error("Upload fehlgeschlagen: " + upload.error.message);
    const signed = await supabaseAdmin.storage.from("dateien").createSignedUrl(path, 60 * 60 * 24 * 30);
    if (signed.error || !signed.data?.signedUrl) throw new Error("Signed URL fehlgeschlagen");
    const downloadUrl = rewriteStorageUrl(signed.data.signedUrl);

    const subject = `Einsatzberichte ${providerLabel} – ${data.month}`;
    const branding = await loadDomainBranding(domainId);
    const html = renderBrandedEmail({
      branding,
      brandName: brandName(branding),
      statusPill: "Monatsabrechnung",
      heading: `Monatsbericht ${providerLabel}`,
      greetingName: null,
      intro: `anbei der Monatsbericht für ${data.month} mit ${data.einsatz_count} Einsätzen als PDF.`,
      metaTitle: `${providerLabel} · ${data.month}`,
      metaSubtitle: `${data.einsatz_count} Einsätze · PDF · 30 Tage gültig`,
      ctaLabel: "Bericht herunterladen",
      ctaUrl: downloadUrl,
      previewText: `Monatsbericht ${providerLabel} ${data.month}`,
    });

    let status: "sent" | "failed" = "sent";
    let errorMessage: string | null = null;
    try {
      await sendEmailForDomain(domainId, {
        to: data.recipient_email,
        subject,
        html,
        label: "abrechnung",
      });
    } catch (e: any) {
      status = "failed";
      errorMessage = String(e?.message ?? e).slice(0, 500);
    }

    await supabaseAdmin.from("hausnotruf_abrechnung_log").insert({
      domain_id: domainId,
      provider_key: data.provider,
      period_month: firstOfMonth,
      recipient_email: data.recipient_email,
      einsatz_count: data.einsatz_count,
      status,
      error_message: errorMessage,
      sent_by: userId,
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
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireEffectiveDomainId } from "@/lib/tenant.server";
import {
  maskKey, resolveEmailConfigForDomain, sendEmailViaProvider,
  type EmailProvider,
} from "@/lib/email-send.server";
import { loadDomainBranding, brandName as brandNameFor } from "@/lib/email-brand.server";
import { renderBrandedEmail, normalizeBranding } from "@/lib/email-brand";

const providerEnum = z.enum(["resend", "mailgun", "sendgrid", "smtp"]);
const regionEnum = z.enum(["us", "eu"]);
const smtpSecureEnum = z.enum(["ssl", "starttls", "none"]);

async function assertSuperadmin(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles").select("role").eq("user_id", userId).eq("role", "superadmin").maybeSingle();
  if (!data) throw new Error("Nur Superadmins");
}
async function assertDomainAdmin(userId: string, domainId: string) {
  const { data: su } = await supabaseAdmin
    .from("user_roles").select("role").eq("user_id", userId).eq("role", "superadmin").maybeSingle();
  if (su) return;
  const { data } = await supabaseAdmin
    .from("user_roles").select("role")
    .eq("user_id", userId).eq("role", "admin").eq("domain_id", domainId).maybeSingle();
  if (!data) throw new Error("Nur Domain-Admins");
}

function maskRow(r: any) {
  if (!r) return null;
  return {
    ...r,
    api_key: r.api_key ? maskKey(r.api_key) : null,
    has_api_key: !!r.api_key,
    smtp_password: r.smtp_password ? "••••••••" : null,
    has_smtp_password: !!r.smtp_password,
  };
}

// ---------- Platform (Superadmin) ----------

export const getPlatformEmailSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperadmin(context.userId);
    const { data, error } = await supabaseAdmin
      .from("platform_email_settings").select("*").eq("id", true).maybeSingle();
    if (error) throw new Error(error.message);
    return { settings: maskRow(data) };
  });

export const upsertPlatformEmailSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    provider: providerEnum,
    api_key: z.string().min(0).max(500).optional(), // empty = keep existing
    from_email: z.string().email().max(200),
    from_name: z.string().max(200).nullable().optional(),
    mailgun_domain: z.string().max(200).nullable().optional(),
    mailgun_region: regionEnum.optional(),
    smtp_host: z.string().max(255).nullable().optional(),
    smtp_port: z.number().int().min(1).max(65535).nullable().optional(),
    smtp_username: z.string().max(255).nullable().optional(),
    smtp_password: z.string().min(0).max(500).optional(), // empty = keep
    smtp_secure: smtpSecureEnum.optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    await assertSuperadmin(context.userId);
    const { data: existing } = await supabaseAdmin
      .from("platform_email_settings").select("api_key, smtp_password").eq("id", true).maybeSingle() as any;
    const finalKey = data.api_key && data.api_key.length > 0 ? data.api_key : existing?.api_key ?? null;
    const finalSmtpPw = data.smtp_password && data.smtp_password.length > 0 ? data.smtp_password : existing?.smtp_password ?? null;
    const { error } = await supabaseAdmin.from("platform_email_settings").upsert({
      id: true,
      provider: data.provider,
      api_key: data.provider === "smtp" ? null : finalKey,
      from_email: data.from_email,
      from_name: data.from_name ?? null,
      mailgun_domain: data.mailgun_domain ?? null,
      mailgun_region: data.mailgun_region ?? "us",
      smtp_host: data.provider === "smtp" ? (data.smtp_host ?? null) : null,
      smtp_port: data.provider === "smtp" ? (data.smtp_port ?? null) : null,
      smtp_username: data.provider === "smtp" ? (data.smtp_username ?? null) : null,
      smtp_password: data.provider === "smtp" ? finalSmtpPw : null,
      smtp_secure: data.provider === "smtp" ? (data.smtp_secure ?? "starttls") : null,
      updated_at: new Date().toISOString(),
      updated_by: context.userId,
    } as any);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const sendPlatformTestEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ to: z.string().email().max(200) }).parse(i))
  .handler(async ({ data, context }) => {
    await assertSuperadmin(context.userId);
    const { data: ps } = await supabaseAdmin
      .from("platform_email_settings").select("*").eq("id", true).maybeSingle() as any;
    if (!ps?.from_email || !ps?.provider) throw new Error("Plattform-E-Mail noch nicht konfiguriert.");
    const cfg = buildResolved("platform", ps);
    const branding = normalizeBranding({ from_name: ps.from_name ?? null });
    const html = renderBrandedEmail({
      branding,
      brandName: branding.from_name ?? "AlarmDesk",
      statusPill: "Testmail · Plattform",
      heading: "Plattform-Testmail",
      intro: `Dies ist eine Testmail vom Plattform-Versand über ${cfg.provider.toUpperCase()}. Wenn Sie diese E-Mail sehen, funktioniert der Versand.`,
      previewText: "Testmail vom Plattform-Versand",
    });
    await sendEmailViaProvider(cfg, {
      to: data.to,
      subject: "AlarmDesk – Testmail (Plattform)",
      html,
      text: `Testmail vom Plattform-Versand (${cfg.provider}).`,
    });
    return { ok: true };
  });

function buildResolved(source: "platform" | "domain", row: any) {
  return {
    source,
    provider: row.provider as EmailProvider,
    api_key: row.api_key ?? null,
    from_email: row.from_email,
    from_name: row.from_name ?? null,
    mailgun_domain: row.mailgun_domain ?? null,
    mailgun_region: (row.mailgun_region as "us" | "eu") ?? "us",
    smtp_host: row.smtp_host ?? null,
    smtp_port: row.smtp_port ?? null,
    smtp_username: row.smtp_username ?? null,
    smtp_password: row.smtp_password ?? null,
    smtp_secure: (row.smtp_secure as any) ?? "starttls",
  };
}

// ---------- Domain ----------

export const getDomainEmailSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const domainId = await requireEffectiveDomainId(context.supabase, context.userId);
    await assertDomainAdmin(context.userId, domainId);
    const { data, error } = await supabaseAdmin
      .from("domain_email_settings").select("*").eq("domain_id", domainId).maybeSingle();
    if (error) throw new Error(error.message);
    // Also tell client if platform fallback is available
    const { data: ps } = await supabaseAdmin
      .from("platform_email_settings").select("provider, from_email, api_key, smtp_host, smtp_password").eq("id", true).maybeSingle() as any;
    const psAvail = !!(ps?.from_email && ps?.provider && (
      ps.provider === "smtp" ? (ps.smtp_host && ps.smtp_password) : ps.api_key
    ));
    return {
      domain_id: domainId,
      settings: maskRow(data),
      platform_available: psAvail,
      platform_from: ps?.from_email ?? null,
    };
  });

export const upsertDomainEmailSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    mode: z.enum(["platform", "own"]),
    provider: providerEnum.nullable().optional(),
    api_key: z.string().min(0).max(500).optional(), // empty = keep existing
    from_email: z.union([z.string().email().max(200), z.literal("")]).nullable().optional(),
    from_name: z.string().max(200).nullable().optional(),
    mailgun_domain: z.string().max(200).nullable().optional(),
    mailgun_region: regionEnum.nullable().optional(),
    smtp_host: z.string().max(255).nullable().optional(),
    smtp_port: z.number().int().min(1).max(65535).nullable().optional(),
    smtp_username: z.string().max(255).nullable().optional(),
    smtp_password: z.string().min(0).max(500).optional(),
    smtp_secure: smtpSecureEnum.nullable().optional(),
    bcc_email: z.union([z.string().email().max(200), z.literal("")]).nullable().optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const domainId = await requireEffectiveDomainId(context.supabase, context.userId);
    await assertDomainAdmin(context.userId, domainId);

    const { data: existing } = await supabaseAdmin
      .from("domain_email_settings").select("api_key, smtp_password").eq("domain_id", domainId).maybeSingle() as any;
    const finalKey = data.api_key && data.api_key.length > 0 ? data.api_key : existing?.api_key ?? null;
    const finalSmtpPw = data.smtp_password && data.smtp_password.length > 0 ? data.smtp_password : existing?.smtp_password ?? null;

    if (data.mode === "own") {
      if (!data.provider) throw new Error("Provider ist Pflicht bei eigenem Versand.");
      if (!data.from_email) throw new Error("Absender-Adresse ist Pflicht.");
      if (data.provider === "smtp") {
        if (!data.smtp_host || !data.smtp_port || !data.smtp_username || !finalSmtpPw) {
          throw new Error("SMTP-Host, Port, Benutzer und Passwort sind Pflicht.");
        }
      } else {
        if (data.provider !== "resend" && !finalKey) throw new Error("API-Key ist Pflicht.");
        if (data.provider === "mailgun" && !data.mailgun_domain) throw new Error("Mailgun-Domain ist Pflicht.");
      }
    }

    const ownSmtp = data.mode === "own" && data.provider === "smtp";
    const ownApi = data.mode === "own" && data.provider !== "smtp";
    const { error } = await supabaseAdmin.from("domain_email_settings").upsert({
      domain_id: domainId,
      mode: data.mode,
      provider: data.provider ?? null,
      api_key: ownApi ? finalKey : null,
      from_email: data.from_email ?? null,
      from_name: data.from_name ?? null,
      mailgun_domain: data.mailgun_domain ?? null,
      mailgun_region: data.mailgun_region ?? "us",
      smtp_host: ownSmtp ? (data.smtp_host ?? null) : null,
      smtp_port: ownSmtp ? (data.smtp_port ?? null) : null,
      smtp_username: ownSmtp ? (data.smtp_username ?? null) : null,
      smtp_password: ownSmtp ? finalSmtpPw : null,
      smtp_secure: ownSmtp ? (data.smtp_secure ?? "starttls") : null,
      bcc_email: data.bcc_email ? data.bcc_email : null,
      updated_at: new Date().toISOString(),
      updated_by: context.userId,
    } as any);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const sendDomainTestEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ to: z.string().email().max(200) }).parse(i))
  .handler(async ({ data, context }) => {
    const domainId = await requireEffectiveDomainId(context.supabase, context.userId);
    await assertDomainAdmin(context.userId, domainId);
    const cfg = await resolveEmailConfigForDomain(domainId);
    const branding = await loadDomainBranding(domainId);
    const html = renderBrandedEmail({
      branding,
      brandName: brandNameFor(branding),
      statusPill: "Testmail",
      heading: "Test-E-Mail Ihres Brandings",
      greetingName: null,
      intro: `Dies ist eine Vorschau des aktuell hinterlegten E-Mail-Designs Ihrer Domäne. Versand über ${cfg.source === "domain" ? "eigenen" : "Plattform-"}Provider ${cfg.provider.toUpperCase()}.`,
      metaTitle: "Beispiel-Info-Panel",
      metaSubtitle: "So sehen Anhänge / Downloads in E-Mails aus",
      ctaLabel: "Beispiel-Button",
      ctaUrl: "https://example.com",
      closingNote: "Über den Bereich „E-Mail-Design & Branding“ passen Sie Logo, Farbe, Begrüßung, Signatur und Fußtext an.",
      previewText: "AlarmDesk Test-Mail",
    });
    await sendEmailViaProvider(cfg, {
      to: data.to,
      subject: "AlarmDesk – Testmail",
      html,
      text: `Testmail – Quelle: ${cfg.source}, Provider: ${cfg.provider}.`,
    });
    return { ok: true, source: cfg.source, provider: cfg.provider };
  });

// ---------- Domain Branding ----------

const brandingSchema = z.object({
  brand_logo_url: z.string().max(1000).nullable().optional(),
  brand_primary_color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Farbe muss als #RRGGBB angegeben werden").nullable().optional(),
  brand_header_label: z.string().max(80).nullable().optional(),
  brand_greeting: z.string().max(300).nullable().optional(),
  brand_signature: z.string().max(500).nullable().optional(),
  brand_footer_html: z.string().max(2000).nullable().optional(),
  brand_layout: z.enum(["card", "banner", "minimal", "sidebar"]).nullable().optional(),
});

export const getDomainEmailBranding = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const domainId = await requireEffectiveDomainId(context.supabase, context.userId);
    await assertDomainAdmin(context.userId, domainId);
    const { data, error } = await supabaseAdmin
      .from("domain_email_settings")
      .select("brand_logo_url, brand_primary_color, brand_header_label, brand_greeting, brand_signature, brand_footer_html, brand_layout, from_name")
      .eq("domain_id", domainId).maybeSingle() as any;
    if (error) throw new Error(error.message);
    return {
      domain_id: domainId,
      branding: {
        brand_logo_url: data?.brand_logo_url ?? null,
        brand_primary_color: data?.brand_primary_color ?? null,
        brand_header_label: data?.brand_header_label ?? null,
        brand_greeting: data?.brand_greeting ?? null,
        brand_signature: data?.brand_signature ?? null,
        brand_footer_html: data?.brand_footer_html ?? null,
        brand_layout: data?.brand_layout ?? null,
        from_name: data?.from_name ?? null,
      },
    };
  });

export const upsertDomainEmailBranding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => brandingSchema.parse(i))
  .handler(async ({ data, context }) => {
    const domainId = await requireEffectiveDomainId(context.supabase, context.userId);
    await assertDomainAdmin(context.userId, domainId);
    const { error } = await supabaseAdmin.from("domain_email_settings").upsert({
      domain_id: domainId,
      brand_logo_url: data.brand_logo_url ?? null,
      brand_primary_color: data.brand_primary_color ?? null,
      brand_header_label: data.brand_header_label ?? null,
      brand_greeting: data.brand_greeting ?? null,
      brand_signature: data.brand_signature ?? null,
      brand_footer_html: data.brand_footer_html ?? null,
      brand_layout: data.brand_layout ?? "card",
      updated_at: new Date().toISOString(),
      updated_by: context.userId,
    } as any);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
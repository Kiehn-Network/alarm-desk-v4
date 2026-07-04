import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireEffectiveDomainId } from "@/lib/tenant.server";
import {
  maskKey, resolveEmailConfigForDomain, sendEmailViaProvider,
  type EmailProvider,
} from "@/lib/email-send.server";

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
    await sendEmailViaProvider(cfg, {
      to: data.to,
      subject: "AlarmDesk – Testmail (Plattform)",
      html: `<p>Dies ist eine Testmail vom Plattform-Versand (${cfg.provider}).</p>`,
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
    await sendEmailViaProvider(cfg, {
      to: data.to,
      subject: "AlarmDesk – Testmail",
      html: `<p>Dies ist eine Testmail vom AlarmDesk-Versand (Quelle: ${cfg.source}, Provider: ${cfg.provider}).</p>`,
      text: `Testmail – Quelle: ${cfg.source}, Provider: ${cfg.provider}.`,
    });
    return { ok: true, source: cfg.source, provider: cfg.provider };
  });
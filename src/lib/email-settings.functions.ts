import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireEffectiveDomainId } from "@/lib/tenant.server";
import {
  maskKey, resolveEmailConfigForDomain, sendEmailViaProvider,
  type EmailProvider,
} from "@/lib/email-send.server";

const providerEnum = z.enum(["resend", "mailgun", "sendgrid"]);
const regionEnum = z.enum(["us", "eu"]);

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
  return { ...r, api_key: r.api_key ? maskKey(r.api_key) : null, has_api_key: !!r.api_key };
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
  }).parse(i))
  .handler(async ({ data, context }) => {
    await assertSuperadmin(context.userId);
    const { data: existing } = await supabaseAdmin
      .from("platform_email_settings").select("api_key").eq("id", true).maybeSingle();
    const finalKey = data.api_key && data.api_key.length > 0 ? data.api_key : existing?.api_key ?? null;
    const { error } = await supabaseAdmin.from("platform_email_settings").upsert({
      id: true,
      provider: data.provider,
      api_key: finalKey,
      from_email: data.from_email,
      from_name: data.from_name ?? null,
      mailgun_domain: data.mailgun_domain ?? null,
      mailgun_region: data.mailgun_region ?? "us",
      updated_at: new Date().toISOString(),
      updated_by: context.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const sendPlatformTestEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ to: z.string().email().max(200) }).parse(i))
  .handler(async ({ data, context }) => {
    await assertSuperadmin(context.userId);
    const { data: ps } = await supabaseAdmin
      .from("platform_email_settings").select("*").eq("id", true).maybeSingle();
    if (!ps?.api_key || !ps.from_email) throw new Error("Plattform-E-Mail noch nicht vollständig konfiguriert.");
    const cfg = {
      source: "platform" as const,
      provider: ps.provider as EmailProvider,
      api_key: ps.api_key,
      from_email: ps.from_email,
      from_name: ps.from_name ?? null,
      mailgun_domain: ps.mailgun_domain ?? null,
      mailgun_region: (ps.mailgun_region as "us" | "eu") ?? "us",
    };
    await sendEmailViaProvider(cfg, {
      to: data.to,
      subject: "AlarmDesk – Testmail (Plattform)",
      html: `<p>Dies ist eine Testmail vom Plattform-Versand (${cfg.provider}).</p>`,
      text: `Testmail vom Plattform-Versand (${cfg.provider}).`,
    });
    return { ok: true };
  });

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
      .from("platform_email_settings").select("provider, from_email, api_key").eq("id", true).maybeSingle();
    return {
      domain_id: domainId,
      settings: maskRow(data),
      platform_available: !!(ps?.api_key && ps?.from_email),
      platform_from: ps?.from_email ?? null,
    };
  });

export const upsertDomainEmailSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    mode: z.enum(["platform", "own"]),
    provider: providerEnum.nullable().optional(),
    api_key: z.string().min(0).max(500).optional(), // empty = keep existing
    from_email: z.string().email().max(200).nullable().optional(),
    from_name: z.string().max(200).nullable().optional(),
    mailgun_domain: z.string().max(200).nullable().optional(),
    mailgun_region: regionEnum.nullable().optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const domainId = await requireEffectiveDomainId(context.supabase, context.userId);
    await assertDomainAdmin(context.userId, domainId);

    const { data: existing } = await supabaseAdmin
      .from("domain_email_settings").select("api_key").eq("domain_id", domainId).maybeSingle();
    const finalKey = data.api_key && data.api_key.length > 0 ? data.api_key : existing?.api_key ?? null;

    if (data.mode === "own") {
      if (!data.provider) throw new Error("Provider ist Pflicht bei eigenem Versand.");
      if (!data.from_email) throw new Error("Absender-Adresse ist Pflicht.");
      if (!finalKey) throw new Error("API-Key ist Pflicht.");
      if (data.provider === "mailgun" && !data.mailgun_domain) throw new Error("Mailgun-Domain ist Pflicht.");
    }

    const { error } = await supabaseAdmin.from("domain_email_settings").upsert({
      domain_id: domainId,
      mode: data.mode,
      provider: data.provider ?? null,
      api_key: data.mode === "own" ? finalKey : null,
      from_email: data.from_email ?? null,
      from_name: data.from_name ?? null,
      mailgun_domain: data.mailgun_domain ?? null,
      mailgun_region: data.mailgun_region ?? "us",
      updated_at: new Date().toISOString(),
      updated_by: context.userId,
    });
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
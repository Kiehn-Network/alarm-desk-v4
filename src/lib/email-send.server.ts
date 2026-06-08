import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type EmailProvider = "resend" | "mailgun" | "sendgrid";

export interface ResolvedEmailConfig {
  source: "platform" | "domain";
  provider: EmailProvider;
  api_key: string;
  from_email: string;
  from_name: string | null;
  mailgun_domain: string | null;
  mailgun_region: "us" | "eu";
}

export interface SendInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
  label?: string;
}

/** Resolve effective email config for a domain. Throws clear error if unconfigured. */
export async function resolveEmailConfigForDomain(domainId: string): Promise<ResolvedEmailConfig> {
  const { data: ds, error: dErr } = await supabaseAdmin
    .from("domain_email_settings")
    .select("*")
    .eq("domain_id", domainId)
    .maybeSingle();
  if (dErr) throw new Error("E-Mail-Einstellungen nicht lesbar: " + dErr.message);

  const mode = (ds?.mode as string) ?? "platform";

  if (mode === "own") {
    if (!ds?.provider || !ds.api_key || !ds.from_email) {
      throw new Error(
        'Eigene SMTP-/E-Mail-Daten unvollständig. Bitte im Admin-Bereich unter "E-Mail-Versand" Provider, API-Key und Absender hinterlegen.',
      );
    }
    if (ds.provider === "mailgun" && !ds.mailgun_domain) {
      throw new Error("Mailgun-Domain fehlt in den E-Mail-Einstellungen.");
    }
    return {
      source: "domain",
      provider: ds.provider as EmailProvider,
      api_key: ds.api_key,
      from_email: ds.from_email,
      from_name: ds.from_name ?? null,
      mailgun_domain: ds.mailgun_domain ?? null,
      mailgun_region: (ds.mailgun_region as "us" | "eu") ?? "us",
    };
  }

  // platform
  const { data: ps, error: pErr } = await supabaseAdmin
    .from("platform_email_settings")
    .select("*")
    .eq("id", true)
    .maybeSingle();
  if (pErr) throw new Error("Plattform-E-Mail-Einstellungen nicht lesbar: " + pErr.message);
  if (!ps?.provider || !ps.api_key || !ps.from_email) {
    throw new Error(
      "AlarmDesk-Versand ist noch nicht konfiguriert. Der Superadmin muss Plattform-E-Mail-Daten hinterlegen, oder hinterlege eigene SMTP-Daten für deine Domäne.",
    );
  }
  if (ps.provider === "mailgun" && !ps.mailgun_domain) {
    throw new Error("Mailgun-Domain in Plattform-Einstellungen fehlt.");
  }
  return {
    source: "platform",
    provider: ps.provider as EmailProvider,
    api_key: ps.api_key,
    from_email: ps.from_email,
    from_name: ps.from_name ?? null,
    mailgun_domain: ps.mailgun_domain ?? null,
    mailgun_region: (ps.mailgun_region as "us" | "eu") ?? "us",
  };
}

function formatFrom(cfg: ResolvedEmailConfig): string {
  return cfg.from_name ? `${cfg.from_name} <${cfg.from_email}>` : cfg.from_email;
}

/** Send a single email using the resolved config. Returns provider message id on success, throws on failure. */
export async function sendEmailViaProvider(cfg: ResolvedEmailConfig, input: SendInput): Promise<{ id: string | null }> {
  if (cfg.provider === "resend") {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.api_key}`,
      },
      body: JSON.stringify({
        from: formatFrom(cfg),
        to: [input.to],
        subject: input.subject,
        html: input.html,
        text: input.text,
      }),
    });
    const body = await res.text();
    if (!res.ok) throw new Error(`Resend-Fehler ${res.status}: ${body.slice(0, 400)}`);
    try { return { id: (JSON.parse(body)?.id as string) ?? null }; } catch { return { id: null }; }
  }

  if (cfg.provider === "mailgun") {
    const host = cfg.mailgun_region === "eu" ? "api.eu.mailgun.net" : "api.mailgun.net";
    const form = new URLSearchParams();
    form.set("from", formatFrom(cfg));
    form.set("to", input.to);
    form.set("subject", input.subject);
    form.set("html", input.html);
    if (input.text) form.set("text", input.text);
    const res = await fetch(`https://${host}/v3/${encodeURIComponent(cfg.mailgun_domain!)}/messages`, {
      method: "POST",
      headers: {
        Authorization: "Basic " + Buffer.from(`api:${cfg.api_key}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    });
    const body = await res.text();
    if (!res.ok) throw new Error(`Mailgun-Fehler ${res.status}: ${body.slice(0, 400)}`);
    try { return { id: (JSON.parse(body)?.id as string) ?? null }; } catch { return { id: null }; }
  }

  if (cfg.provider === "sendgrid") {
    const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.api_key}`,
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: input.to }] }],
        from: { email: cfg.from_email, name: cfg.from_name ?? undefined },
        subject: input.subject,
        content: [
          ...(input.text ? [{ type: "text/plain", value: input.text }] : []),
          { type: "text/html", value: input.html },
        ],
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`SendGrid-Fehler ${res.status}: ${body.slice(0, 400)}`);
    }
    return { id: res.headers.get("x-message-id") };
  }

  throw new Error(`Unbekannter Provider: ${cfg.provider}`);
}

/** Convenience: resolve config and send for a given domain. */
export async function sendEmailForDomain(domainId: string, input: SendInput): Promise<{ id: string | null; source: string; provider: EmailProvider }> {
  const cfg = await resolveEmailConfigForDomain(domainId);
  const r = await sendEmailViaProvider(cfg, input);
  return { id: r.id, source: cfg.source, provider: cfg.provider };
}

export function maskKey(k: string | null | undefined): string {
  if (!k) return "";
  if (k.length <= 8) return "•".repeat(k.length);
  return k.slice(0, 4) + "•".repeat(Math.max(4, k.length - 8)) + k.slice(-4);
}
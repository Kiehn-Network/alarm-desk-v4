import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type EmailProvider = "resend" | "mailgun" | "sendgrid" | "smtp";

export interface ResolvedEmailConfig {
  source: "platform" | "domain";
  provider: EmailProvider;
  api_key: string | null;
  from_email: string;
  from_name: string | null;
  mailgun_domain: string | null;
  mailgun_region: "us" | "eu";
  smtp_host?: string | null;
  smtp_port?: number | null;
  smtp_username?: string | null;
  smtp_password?: string | null;
  smtp_secure?: "ssl" | "starttls" | "none" | null;
}

export interface SendInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
  label?: string;
  bcc?: string | null;
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
    return buildConfig("domain", ds);
  }

  // platform
  const { data: ps, error: pErr } = await supabaseAdmin
    .from("platform_email_settings")
    .select("*")
    .eq("id", true)
    .maybeSingle();
  if (pErr) throw new Error("Plattform-E-Mail-Einstellungen nicht lesbar: " + pErr.message);
  if (!ps) {
    throw new Error("AlarmDesk-Versand ist noch nicht konfiguriert. Der Superadmin muss Plattform-E-Mail-Daten hinterlegen, oder hinterlege eigene SMTP-Daten für deine Domäne.");
  }
  return buildConfig("platform", ps);
}

function buildConfig(source: "platform" | "domain", row: any): ResolvedEmailConfig {
  if (!row?.provider || !row?.from_email) {
    throw new Error("E-Mail-Versand unvollständig konfiguriert (Provider und Absender erforderlich).");
  }
  const provider = row.provider as EmailProvider;
  if (provider === "smtp") {
    if (!row.smtp_host || !row.smtp_port || !row.smtp_username || !row.smtp_password) {
      throw new Error("SMTP-Daten unvollständig (Host, Port, Benutzer, Passwort erforderlich).");
    }
  } else {
    if (!row.api_key) throw new Error("API-Key fehlt in den E-Mail-Einstellungen.");
    if (provider === "mailgun" && !row.mailgun_domain) throw new Error("Mailgun-Domain fehlt.");
  }
  return {
    source,
    provider,
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
        bcc: input.bcc ? [input.bcc] : undefined,
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
    if (input.bcc) form.set("bcc", input.bcc);
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
        personalizations: [{
          to: [{ email: input.to }],
          ...(input.bcc ? { bcc: [{ email: input.bcc }] } : {}),
        }],
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

  if (cfg.provider === "smtp") {
    let WorkerMailer: any;
    try {
      ({ WorkerMailer } = await import("worker-mailer"));
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      if (msg.includes("cloudflare:sockets")) {
        throw new Error(
          "SMTP-Versand ist im lokalen Dev-Server nicht verfügbar (benötigt Cloudflare Worker). Bitte im veröffentlichten/Preview-Deployment testen oder einen HTTP-API-Provider (Resend/Mailgun/SendGrid) verwenden."
        );
      }
      throw e;
    }
    const secure = (cfg.smtp_secure as string) ?? "starttls";
    const mailer = await WorkerMailer.connect({
      credentials: { username: cfg.smtp_username!, password: cfg.smtp_password! },
      authType: ["plain", "login"],
      host: cfg.smtp_host!,
      port: cfg.smtp_port!,
      secure: secure === "ssl",
      startTls: secure === "starttls",
    });
    try {
      await mailer.send({
        from: cfg.from_name ? { name: cfg.from_name, email: cfg.from_email } : cfg.from_email,
        to: input.to,
        bcc: input.bcc ?? undefined,
        subject: input.subject,
        html: input.html,
        text: input.text,
      });
    } finally {
      try { await mailer.close(); } catch { /* ignore */ }
    }
    return { id: null };
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
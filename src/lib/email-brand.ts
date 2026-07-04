// Pure, browser-safe email HTML renderer + defaults.
// Used by server functions AND by the admin UI for a live preview.

export type EmailLayout = "card" | "banner" | "minimal" | "sidebar";

export const EMAIL_LAYOUTS: { id: EmailLayout; name: string; description: string }[] = [
  { id: "card",     name: "Card",     description: "Klassisch mit weißer Karte auf grauem Hintergrund." },
  { id: "banner",   name: "Banner",   description: "Großer farbiger Header-Banner mit Titel." },
  { id: "minimal",  name: "Minimal",  description: "Reduziert, ohne Rahmen — nur Text und CTA." },
  { id: "sidebar",  name: "Sidebar",  description: "Farbiger linker Seitenstreifen als Akzent." },
];

export type EmailBranding = {
  logo_url: string | null;
  primary_color: string;
  header_label: string;
  greeting: string;   // may contain {{kunde}}
  signature: string;
  footer_html: string; // plain text with \n allowed; escaped on render
  from_name: string | null;
  layout: EmailLayout;
};

export const DEFAULT_BRANDING: EmailBranding = {
  logo_url: null,
  primary_color: "#2563eb",
  header_label: "EINSATZVERWALTUNG",
  greeting: "Guten Tag {{kunde}},",
  signature: "Mit freundlichen Grüßen",
  footer_html: "Diese E-Mail wurde automatisch versendet. Bitte nicht antworten.",
  from_name: null,
  layout: "card",
};

export function normalizeBranding(input: Partial<EmailBranding> | null | undefined): EmailBranding {
  const b = input ?? {};
  const layoutIn = (b.layout ?? "").toString();
  const layout: EmailLayout = (["card","banner","minimal","sidebar"].includes(layoutIn) ? layoutIn : DEFAULT_BRANDING.layout) as EmailLayout;
  return {
    logo_url: (b.logo_url ?? null) || null,
    primary_color: (b.primary_color ?? "").trim() || DEFAULT_BRANDING.primary_color,
    header_label: (b.header_label ?? "").trim(), // explicitly allowed to be empty
    greeting: (b.greeting ?? "").trim() || DEFAULT_BRANDING.greeting,
    signature: (b.signature ?? "").trim() || DEFAULT_BRANDING.signature,
    footer_html: (b.footer_html ?? "").trim() || DEFAULT_BRANDING.footer_html,
    from_name: (b.from_name ?? null) || null,
    layout,
  };
}

export function escapeHtml(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" } as Record<string, string>)[c],
  );
}

function nl2br(s: string): string {
  return escapeHtml(s).replace(/\r?\n/g, "<br />");
}

// Lighten a hex color toward white by mixing.
function mix(hex: string, ratio: number): string {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex ?? "");
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 0xff, g = (n >> 8) & 0xff, b = n & 0xff;
  const mixOne = (c: number) => Math.round(c + (255 - c) * ratio);
  const to = (v: number) => v.toString(16).padStart(2, "0");
  return `#${to(mixOne(r))}${to(mixOne(g))}${to(mixOne(b))}`;
}

function fillGreeting(template: string, kundeName: string | null): string {
  const hasKunde = template.includes("{{kunde}}");
  if (!hasKunde) return template;
  if (kundeName && kundeName.trim()) {
    return template.replace(/\{\{kunde\}\}/g, kundeName.trim());
  }
  // remove the leading space before {{kunde}} if any: "Guten Tag {{kunde}}," → "Guten Tag,"
  return template.replace(/\s*\{\{kunde\}\}/g, "");
}

export type RenderBrandedInput = {
  branding: EmailBranding;
  brandName: string;          // shown next to logo — usually from_name or "AlarmDesk"
  statusPill?: string;        // e.g. "Einsatzbericht"
  heading: string;            // large card title
  greetingName?: string | null; // customer name (for {{kunde}})
  intro: string;              // paragraph after greeting (plain text)
  metaTitle?: string;         // small info-panel title (e.g. einsatzgrund)
  metaSubtitle?: string;      // small info-panel subtitle (e.g. "PDF · 30 Tage gültig")
  ctaLabel?: string;
  ctaUrl?: string;
  ctaHint?: string;           // small text under CTA
  closingNote?: string;       // paragraph before signature
  previewText?: string;       // inbox preview snippet
};

export function renderBrandedEmail(input: RenderBrandedInput): string {
  const b = input.branding;
  const primary = b.primary_color;
  const primaryLight = mix(primary, 0.35);
  const year = new Date().getFullYear();
  const greeting = fillGreeting(b.greeting, input.greetingName ?? null);

  const logoBlock = b.logo_url
    ? `<img src="${escapeHtml(b.logo_url)}" alt="${escapeHtml(input.brandName)}" width="40" height="40" style="display:block;width:40px;height:40px;border-radius:10px;object-fit:cover;border:0;" />`
    : `<div style="width:40px;height:40px;background:linear-gradient(135deg,${primary},${primaryLight});border-radius:10px;text-align:center;line-height:40px;">
         <span style="color:#ffffff;font-size:20px;font-weight:800;line-height:40px;">${escapeHtml(input.brandName.charAt(0).toUpperCase() || "A")}</span>
       </div>`;

  const statusPill = input.statusPill
    ? `<span style="display:inline-block;font-size:11px;font-weight:600;color:#10b981;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:999px;padding:4px 10px;letter-spacing:0.05em;">● ${escapeHtml(input.statusPill)}</span>`
    : "";

  const infoPanel = input.metaTitle
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 24px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;">
         <tr><td style="padding:14px 16px;">
           <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
             <td style="width:36px;vertical-align:middle;">
               <div style="width:32px;height:32px;background:${mix(primary, 0.85)};border:1px solid ${mix(primary, 0.6)};border-radius:8px;text-align:center;line-height:30px;color:${primary};font-size:16px;font-weight:700;">📄</div>
             </td>
             <td style="padding-left:12px;vertical-align:middle;">
               <div style="color:#0f172a;font-size:13px;font-weight:600;line-height:18px;">${escapeHtml(input.metaTitle)}</div>
               ${input.metaSubtitle ? `<div style="color:#64748b;font-size:12px;line-height:16px;margin-top:2px;">${escapeHtml(input.metaSubtitle)}</div>` : ""}
             </td>
           </tr></table>
         </td></tr>
       </table>`
    : "";

  const ctaBlock = (input.ctaUrl && input.ctaLabel)
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
         <tr><td align="center" style="padding:8px 0;">
           <a href="${escapeHtml(input.ctaUrl)}" style="display:inline-block;background:linear-gradient(135deg,${primary},${primaryLight});background-color:${primary};color:#ffffff;font-size:15px;font-weight:700;border-radius:12px;padding:14px 28px;text-decoration:none;">${escapeHtml(input.ctaLabel)} →</a>
         </td></tr>
       </table>
       <p style="color:#94a3b8;font-size:12px;margin:20px 0 6px;text-align:center;">Falls der Button nicht funktioniert, kopieren Sie diesen Link in Ihren Browser:</p>
       <p style="margin:0;text-align:center;word-break:break-all;"><a href="${escapeHtml(input.ctaUrl)}" style="color:${primary};font-size:12px;text-decoration:underline;">${escapeHtml(input.ctaUrl)}</a></p>`
    : "";

  const ctaHintBlock = input.ctaHint
    ? `<p style="color:#64748b;font-size:12px;margin:12px 0 0;text-align:center;">${escapeHtml(input.ctaHint)}</p>`
    : "";

  const closingBlock = input.closingNote
    ? `<p style="color:#64748b;font-size:13px;line-height:1.6;margin:0;">${escapeHtml(input.closingNote)}</p>`
    : "";

  const greetP = `<p style="color:#334155;font-size:15px;line-height:1.6;margin:0 0 8px;">${escapeHtml(greeting)}</p>`;
  const introP = `<p style="color:#334155;font-size:15px;line-height:1.6;margin:0 0 20px;">${escapeHtml(input.intro)}</p>`;
  const headingH = `<div style="color:#0f172a;font-size:24px;font-weight:700;margin:0 0 12px;letter-spacing:-0.01em;">${escapeHtml(input.heading)}</div>`;
  const signatureP = `<p style="color:#0f172a;font-size:14px;font-weight:600;margin:16px 0 0;">${nl2br(b.signature)}</p>`;
  const divider = `<div style="border-top:1px solid #f1f5f9;margin:24px 0 16px;"></div>`;

  const headerRow = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="vertical-align:middle;">
        <table role="presentation" cellpadding="0" cellspacing="0"><tr>
          <td style="vertical-align:middle;">${logoBlock}</td>
          <td style="padding-left:12px;vertical-align:middle;">
            <div style="color:#0f172a;font-size:16px;font-weight:700;line-height:20px;">${escapeHtml(input.brandName)}</div>
            ${b.header_label ? `<div style="color:#64748b;font-size:10px;font-weight:700;letter-spacing:0.18em;line-height:12px;margin-top:2px;">${escapeHtml(b.header_label)}</div>` : ""}
          </td>
        </tr></table>
      </td>
      <td style="text-align:right;vertical-align:middle;">${statusPill}</td>
    </tr></table>`;

  const footerBlock = `
  <tr><td style="padding:20px 4px 0;text-align:center;">
    <div style="border-top:1px solid #f1f5f9;margin:0 0 16px;"></div>
    <p style="color:#64748b;font-size:12px;line-height:1.6;margin:0 0 8px;">${nl2br(b.footer_html)}</p>
    <p style="color:#94a3b8;font-size:11px;margin:4px 0 0;">© ${year} ${escapeHtml(input.brandName)}</p>
  </td></tr>`;

  const bodyInner = `
    ${headingH}
    ${greetP}
    ${introP}
    ${infoPanel}
    ${ctaBlock}
    ${ctaHintBlock}
    ${divider}
    ${closingBlock}
    ${signatureP}`;

  let contentRows = "";
  switch (b.layout) {
    case "banner": {
      const bannerStatus = input.statusPill
        ? `<div style="margin-top:14px;"><span style="display:inline-block;font-size:11px;font-weight:600;color:#ffffff;background:rgba(255,255,255,0.18);border:1px solid rgba(255,255,255,0.35);border-radius:999px;padding:4px 10px;letter-spacing:0.05em;">● ${escapeHtml(input.statusPill)}</span></div>`
        : "";
      contentRows = `
  <tr><td style="background:linear-gradient(135deg,${primary},${primaryLight});border-radius:16px 16px 0 0;padding:28px 28px 32px;color:#ffffff;">
    <table role="presentation" cellpadding="0" cellspacing="0"><tr>
      <td style="vertical-align:middle;">${logoBlock}</td>
      <td style="padding-left:12px;vertical-align:middle;">
        <div style="color:#ffffff;font-size:16px;font-weight:700;line-height:20px;">${escapeHtml(input.brandName)}</div>
        ${b.header_label ? `<div style="color:rgba(255,255,255,0.85);font-size:10px;font-weight:700;letter-spacing:0.18em;line-height:12px;margin-top:2px;">${escapeHtml(b.header_label)}</div>` : ""}
      </td>
    </tr></table>
    <div style="color:#ffffff;font-size:26px;font-weight:800;margin:20px 0 0;letter-spacing:-0.01em;">${escapeHtml(input.heading)}</div>
    ${bannerStatus}
  </td></tr>
  <tr><td style="background:#ffffff;border:1px solid #e2e8f0;border-top:0;border-radius:0 0 16px 16px;padding:28px;">
    ${greetP}
    ${introP}
    ${infoPanel}
    ${ctaBlock}
    ${ctaHintBlock}
    ${divider}
    ${closingBlock}
    ${signatureP}
  </td></tr>
  ${footerBlock}`;
      break;
    }
    case "minimal": {
      contentRows = `
  <tr><td style="padding:8px 4px 24px;">${headerRow}</td></tr>
  <tr><td style="padding:0 4px;">
    <div style="height:3px;width:48px;background:${primary};border-radius:2px;margin:0 0 20px;"></div>
    ${headingH}
    ${greetP}
    ${introP}
    ${infoPanel}
    ${ctaBlock}
    ${ctaHintBlock}
    ${divider}
    ${closingBlock}
    ${signatureP}
  </td></tr>
  ${footerBlock}`;
      break;
    }
    case "sidebar": {
      contentRows = `
  <tr><td style="padding:8px 4px 20px;">${headerRow}</td></tr>
  <tr><td style="background:#ffffff;border:1px solid #e2e8f0;border-left:6px solid ${primary};border-radius:12px;padding:28px 28px 28px 24px;box-shadow:0 1px 2px rgba(15,23,42,0.04);">
    ${bodyInner}
  </td></tr>
  ${footerBlock}`;
      break;
    }
    case "card":
    default: {
      contentRows = `
  <tr><td style="padding:8px 4px 20px;">${headerRow}</td></tr>
  <tr><td style="background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;padding:32px 28px;box-shadow:0 1px 2px rgba(15,23,42,0.04);">
    ${bodyInner}
  </td></tr>
  ${footerBlock}`;
    }
  }

  return `<!DOCTYPE html>
<html lang="de"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /><meta name="color-scheme" content="light" /><title>${escapeHtml(input.heading)}</title></head>
<body style="margin:0;padding:24px 12px;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
${input.previewText ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(input.previewText)}</div>` : ""}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;">
<tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
${contentRows}
</table>
</td></tr></table>
</body></html>`;
}
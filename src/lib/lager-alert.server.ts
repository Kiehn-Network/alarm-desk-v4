import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendEmailForDomain } from "@/lib/email-send.server";
import { loadDomainBranding, brandName } from "@/lib/email-brand.server";

/**
 * Prüft nach einer Buchung, ob der Mindestbestand unterschritten ist,
 * und verschickt in dem Fall eine Warn-E-Mail an die hinterlegte Adresse.
 * Fehler beim Versand dürfen die Buchung niemals scheitern lassen.
 */
export async function maybeSendBestandsAlarm(artikelId: string): Promise<void> {
  try {
    const { data: art } = await supabaseAdmin
      .from("lager_artikel")
      .select("id, domain_id, bezeichnung, barcode, einheit, bestand, mindestbestand, alarm_email, last_alert_at")
      .eq("id", artikelId)
      .maybeSingle();
    if (!art) return;
    if ((art.mindestbestand ?? 0) <= 0) return;
    if ((art.bestand ?? 0) > (art.mindestbestand ?? 0)) {
      // Bestand wieder ausreichend → Alarm zurücksetzen
      if (art.last_alert_at) {
        await supabaseAdmin.from("lager_artikel").update({ last_alert_at: null }).eq("id", art.id);
      }
      return;
    }
    if (art.last_alert_at) return; // bereits gemeldet

    const { data: settings } = await supabaseAdmin
      .from("lager_settings")
      .select("alarm_email, alarm_aktiv")
      .eq("domain_id", art.domain_id)
      .maybeSingle();

    if (settings && settings.alarm_aktiv === false) return;
    const to = (art.alarm_email || settings?.alarm_email || "").trim();
    if (!to) return;

    const branding = await loadDomainBranding(art.domain_id);
    const name = brandName(branding);
    const color = branding.primary_color || "#4f46e5";

    const html = `
      <div style="font-family:Segoe UI,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px">
        <div style="border-left:4px solid ${color};padding-left:14px">
          <h2 style="margin:0 0 4px;font-size:18px">Meldebestand unterschritten</h2>
          <p style="margin:0;color:#555;font-size:14px">${name} · Lager</p>
        </div>
        <table style="width:100%;border-collapse:collapse;margin-top:18px;font-size:14px">
          <tr><td style="padding:6px 0;color:#666">Artikel</td><td style="padding:6px 0;font-weight:600">${escapeHtml(art.bezeichnung)}</td></tr>
          <tr><td style="padding:6px 0;color:#666">Barcode</td><td style="padding:6px 0;font-family:monospace">${escapeHtml(art.barcode)}</td></tr>
          <tr><td style="padding:6px 0;color:#666">Aktueller Bestand</td><td style="padding:6px 0;font-weight:600">${art.bestand} ${escapeHtml(art.einheit ?? "")}</td></tr>
          <tr><td style="padding:6px 0;color:#666">Mindestbestand</td><td style="padding:6px 0">${art.mindestbestand} ${escapeHtml(art.einheit ?? "")}</td></tr>
        </table>
        <p style="margin-top:18px;font-size:14px;color:#333">Bitte Nachschub bestellen.</p>
      </div>`;

    await sendEmailForDomain(art.domain_id, {
      to,
      subject: `Lager: Meldebestand unterschritten – ${art.bezeichnung}`,
      html,
      text: `Artikel ${art.bezeichnung} (${art.barcode}): Bestand ${art.bestand}, Mindestbestand ${art.mindestbestand}.`,
      label: "lager-meldebestand",
    });

    await supabaseAdmin
      .from("lager_artikel")
      .update({ last_alert_at: new Date().toISOString() })
      .eq("id", art.id);
  } catch {
    /* Versandfehler dürfen die Buchung nicht blockieren */
  }
}

function escapeHtml(s: string) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string),
  );
}

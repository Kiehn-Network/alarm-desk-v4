import { buildPushHTTPRequest } from "@pushforge/builder";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

function b64urlToBytes(s: string) {
  const b = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
}
function bytesToB64url(u: Uint8Array) {
  let s = "";
  u.forEach((c) => (s += String.fromCharCode(c)));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function getVapidJwk(): JsonWebKey | null {
  const raw = process.env["VAPID_PRIVATE_JWK"];
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export function getVapidPublicKey(): string | null {
  const jwk = getVapidJwk();
  if (!jwk?.x || !jwk?.y) return null;
  const x = b64urlToBytes(jwk.x), y = b64urlToBytes(jwk.y);
  const out = new Uint8Array(65);
  out[0] = 4; out.set(x, 1); out.set(y, 33);
  return bytesToB64url(out);
}

export type PushPayload = { title: string; body: string; url?: string; tag?: string };

/** Sendet an alle Geräte der angegebenen Benutzer (die Push für Einsätze aktiviert haben). */
export async function sendPushToUsers(userIds: string[], payload: PushPayload) {
  const jwk = getVapidJwk();
  const ids = [...new Set(userIds.filter(Boolean))];
  if (!jwk || ids.length === 0) return;
  const { data: prefs } = await supabaseAdmin
    .from("profiles").select("id,push_einsaetze").in("id", ids);
  const allowed = (prefs ?? []).filter((p: any) => p.push_einsaetze !== false).map((p: any) => p.id);
  if (allowed.length === 0) return;
  const { data: subs } = await supabaseAdmin
    .from("push_subscriptions").select("id,endpoint,p256dh,auth").in("user_id", allowed);
  await Promise.all((subs ?? []).map(async (s: any) => {
    try {
      const req = await buildPushHTTPRequest({
        privateJWK: jwk,
        subscription: { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        message: {
          payload,
          adminContact: "mailto:support@alarmdesk-software.de",
          options: { ttl: 3600, urgency: "high" },
        },
      });
      const res = await fetch(req.endpoint, { method: "POST", headers: req.headers, body: req.body });
      if (res.status === 404 || res.status === 410) {
        await supabaseAdmin.from("push_subscriptions").delete().eq("id", s.id);
      }
    } catch (e) {
      console.error("push send failed", e);
    }
  }));
}

/** Benachrichtigt Fahrer + Zentrale (Admins/Disponenten der Domain) über einen neuen Einsatz. */
export async function notifyNeuerEinsatz(e: {
  id: string; domain_id: string; assigned_to?: string | null; einsatzgrund?: string | null;
  kunden_name?: string | null; address?: string | null; created_by?: string | null;
}) {
  try {
    const { data: roles } = await supabaseAdmin
      .from("user_roles").select("user_id,role").eq("domain_id", e.domain_id).in("role", ["admin", "dispatcher"]);
    const zentrale = (roles ?? []).map((r: any) => r.user_id).filter((id: string) => id !== e.created_by);
    const text = [e.einsatzgrund, e.kunden_name, e.address].filter(Boolean).join(" · ");
    const jobs: Promise<void>[] = [];
    if (e.assigned_to) {
      jobs.push(sendPushToUsers([e.assigned_to], {
        title: "Neuer Einsatz für dich", body: text || "Ein Einsatz wurde dir zugewiesen.",
        url: "/meine-einsaetze", tag: `einsatz-${e.id}`,
      }));
    }
    const rest = zentrale.filter((id: string) => id !== e.assigned_to);
    if (rest.length) {
      jobs.push(sendPushToUsers(rest, {
        title: "Neuer Einsatz", body: text || "Ein neuer Einsatz wurde angelegt.",
        url: "/alarmierung", tag: `einsatz-${e.id}`,
      }));
    }
    await Promise.all(jobs);
  } catch (err) {
    console.error("notifyNeuerEinsatz", err);
  }
}

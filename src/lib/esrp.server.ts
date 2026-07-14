import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { einsatzPdfBase64 } from "./einsatz-pdf";

export type ErpSettings = {
  domain_id: string;
  api_base: string;
  api_user: string;
  api_token: string;
  endpoint_path: string;
  use_api_prefix: boolean;
  aktiv: boolean;
  auto_on_abschluss: boolean;
  aender_personal_nr?: number | null;
};

function toIsoOrNull(v: any): string | null {
  if (!v) return null;
  const d = new Date(v);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

function ynBool(v: any): boolean | null {
  if (v === true || v === "ja" || v === 1 || v === "1") return true;
  if (v === false || v === "nein" || v === 0 || v === "0") return false;
  return null;
}

export async function buildErpPayload(einsatz: any) {
  // AnlagenNr ist im ERP Pflicht (> 0). Falls am Einsatz nicht gepflegt, mit 0 senden -
  // dann liefert das ERP einen klaren Validierungsfehler statt 500.
  const anlagenNrRaw = einsatz.anlagen_nr;
  const anlagenNr =
    typeof anlagenNrRaw === "number"
      ? anlagenNrRaw
      : anlagenNrRaw != null && anlagenNrRaw !== ""
        ? Number(anlagenNrRaw)
        : 0;

  // EinsatzDatum ist Pflicht. Bevorzugt: tatsächliche Einsatzzeit, sonst Plan/Anlage/Erstellung.
  const einsatzDatum =
    toIsoOrNull(einsatz.vor_ort_am) ||
    toIsoOrNull(einsatz.assigned_at) ||
    toIsoOrNull(einsatz.geplant_am) ||
    toIsoOrNull(einsatz.abgeschlossen_am) ||
    toIsoOrNull(einsatz.created_at) ||
    new Date().toISOString();

  // Fahrername + personalEmail aus Profil/Auth auflösen
  let fahrerName: string | null = null;
  let personalEmail = "";
  if (einsatz.assigned_to) {
    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("display_name")
      .eq("id", einsatz.assigned_to)
      .maybeSingle();
    fahrerName = prof?.display_name ?? null;
    try {
      const { data: u } = await supabaseAdmin.auth.admin.getUserById(einsatz.assigned_to);
      personalEmail = u?.user?.email ?? "";
    } catch { /* ignore */ }
  }

  // Ersteller-/Änderer-Personalnummer aus ERP-Einstellungen
  let aenderPersonalNr = 0;
  if (einsatz.domain_id) {
    const { data: s } = await supabaseAdmin
      .from("erp_settings")
      .select("aender_personal_nr")
      .eq("domain_id", einsatz.domain_id)
      .maybeSingle();
    const raw = (s as any)?.aender_personal_nr;
    if (typeof raw === "number") aenderPersonalNr = raw;
    else if (raw != null && raw !== "") aenderPersonalNr = Number(raw);
  }

  // Arbeitszeit — vier verpflichtende Zeitpunkte mit monoton wachsender Reihenfolge.
  const rawBB = toIsoOrNull(einsatz.assigned_at) || toIsoOrNull(einsatz.vor_ort_am) || toIsoOrNull(einsatz.created_at) || einsatzDatum;
  const rawBN = toIsoOrNull(einsatz.vor_ort_am) || rawBB;
  const rawEN = toIsoOrNull(einsatz.abfahrt_am) || toIsoOrNull(einsatz.einsatz_ende_am) || rawBN;
  const rawEB = toIsoOrNull(einsatz.einsatz_ende_am) || toIsoOrNull(einsatz.abgeschlossen_am) || rawEN;
  const ts = [rawBB, rawBN, rawEN, rawEB].map((v) => new Date(v).getTime());
  for (let i = 1; i < ts.length; i++) if (ts[i] < ts[i - 1]) ts[i] = ts[i - 1];
  const [bB, bN, eN, eB] = ts.map((t) => new Date(t).toISOString());
  const arbeitszeit = {
    beginnBrutto: bB,
    beginnNetto: bN,
    endeNetto: eN,
    endeBrutto: eB,
    pauseMinuten: 0,
  };

  // Scharfmeldung — nur wenn Scharfschaltung durchgeführt UND Errichter + Zeit vorhanden.
  const bd: any = einsatz.bericht_data && typeof einsatz.bericht_data === "object" ? einsatz.bericht_data : {};
  const errichter = bd.errichter === "mit" ? "mit Errichter" : bd.errichter === "ohne" ? "ohne Errichter" : null;
  const schZeit = toIsoOrNull(einsatz.einsatz_ende_am) || toIsoOrNull(einsatz.abgeschlossen_am);
  const scharfmeldung =
    ynBool(bd.scharfschaltung) === true && schZeit && errichter
      ? { zeit: schZeit, bei: errichter }
      : null;

  // Bevorzugt die ursprüngliche numerische Einsatz-ID aus dem Legacy-Import,
  // sonst Fallback auf unsere UUID. Format bleibt "AD-<id>".
  const legacyId =
    einsatz.legacy_data && typeof einsatz.legacy_data === "object"
      ? (einsatz.legacy_data as any).id
      : null;
  const idPart =
    legacyId != null && String(legacyId).trim() !== "" ? String(legacyId) : String(einsatz.id);

  // customFields — nur bekannte Ziel-Felder aus CUST_ArbBeri befüllen.
  const customFields: Record<string, unknown> = {};
  const setBool = (k: string, v: any) => {
    const b = ynBool(v);
    if (b !== null) customFields[k] = b;
  };
  if (fahrerName) customFields.Fahrer = fahrerName;
  if (bd.linie_nr) customFields.LinieNr = String(bd.linie_nr).slice(0, 255);
  if (bd.errichter) customFields.Errichter = String(bd.errichter).slice(0, 80);
  setBool("AlarmLinie", bd.alarm_linie);
  if (einsatz.status) customFields.StatusLocal = String(einsatz.status).slice(0, 50);
  customFields.PermissionId = String(einsatz.id);
  setBool("Rueckstellung", bd.rueckstellung);
  setBool("Innenkontrolle", bd.innenkontrolle);
  const fremd = bd.fremdeinwirkung;
  if (fremd === true || fremd === "ja") customFields.Fremdeinwirkung = true;
  else if (fremd === false || fremd === "nein") customFields.Fremdeinwirkung = false;
  else if (typeof fremd === "string" && fremd) customFields.Fremdeinwirkung = true;
  setBool("Scharfschaltung", bd.scharfschaltung);
  setBool("MeldungZentrale", bd.meldung_zentrale);
  if (bd.weitere_massnahmen) customFields.WeitereMassnahmen = String(bd.weitere_massnahmen).slice(0, 2000);
  setBool("AussenkontrolleNegativ", bd.aussenkontrolle_negativ);

  // Optionales PDF-Dokument (Arbeitsbericht) als Base64.
  let pdf: { titel: string; dateiname: string; base64: string } | null = null;
  try {
    const base64 = einsatzPdfBase64(einsatz, fahrerName);
    if (base64 && base64.length > 0) {
      const idSafe = idPart.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40) || "einsatz";
      pdf = {
        titel: `Arbeitsbericht AD-${idPart}`.slice(0, 80),
        dateiname: `arbeitsbericht-ad-${idSafe}.pdf`,
        base64,
      };
    }
  } catch { /* PDF optional – niemals blockieren */ }

  const payload: Record<string, unknown> = {
    einsatzId: `AD-${idPart}`,
    anlagenNr,
    einsatzDatum,
    personalEmail,
    aenderPersonalNr,
    arbeitszeit,
    customFields,
  };
  if (scharfmeldung) payload.scharfmeldung = scharfmeldung;
  if (pdf) payload.pdf = pdf;
  return payload;
}

async function getJwt(s: ErpSettings): Promise<string> {
  const res = await fetch(`${s.api_base.replace(/\/$/, "")}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: s.api_user, token: s.api_token }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Login fehlgeschlagen (${res.status}): ${text}`);
  let json: any;
  try { json = JSON.parse(text); } catch { throw new Error("Login: kein JSON"); }
  if (!json?.token) throw new Error("Login: JWT fehlt in Antwort");
  return json.token as string;
}

export async function processErpOutboxItem(outboxId: string): Promise<{ ok: boolean; error?: string }> {
  const { data: job, error: jErr } = await supabaseAdmin
    .from("erp_outbox").select("*").eq("id", outboxId).single();
  if (jErr || !job) return { ok: false, error: "Outbox-Job nicht gefunden" };
  if (job.status === "sent") return { ok: true };

  // Atomar beanspruchen ohne neuen Statuswert: Die bestehende DB-Enum erlaubt
  // nur pending/sent/failed. Deshalb nutzen wir tries + next_retry_at als Claim,
  // damit parallele Worker denselben Job nicht doppelt senden.
  const attemptTries = (job.tries ?? 0) + 1;
  const claimUntil = new Date(Date.now() + 10 * 60_000).toISOString();
  const nowIso = new Date().toISOString();
  const { data: claimed, error: claimErr } = await supabaseAdmin
    .from("erp_outbox")
    .update({ tries: attemptTries, next_retry_at: claimUntil, last_error: null })
    .eq("id", outboxId)
    .in("status", ["pending", "failed"])
    .eq("tries", job.tries ?? 0)
    .or(`next_retry_at.is.null,next_retry_at.lte.${nowIso}`)
    .select("id")
    .maybeSingle();
  if (claimErr) return { ok: false, error: `Job konnte nicht beansprucht werden: ${claimErr.message}` };
  if (!claimed) return { ok: true, error: "bereits beansprucht oder noch nicht fällig" };

  const { data: s, error: sErr } = await supabaseAdmin
    .from("erp_settings").select("*").eq("domain_id", job.domain_id).maybeSingle();
  if (sErr || !s) {
    await markFailed(outboxId, attemptTries, "ERP-Konfiguration fehlt");
    return { ok: false, error: "ERP-Konfiguration fehlt" };
  }
  if (!s.aktiv) {
    await markFailed(outboxId, attemptTries, "ERP nicht aktiv");
    return { ok: false, error: "ERP nicht aktiv" };
  }

  try {
    const jwt = await getJwt(s as ErpSettings);
    const ep = s.use_api_prefix
      ? `/api${s.endpoint_path.startsWith("/") ? "" : "/"}${s.endpoint_path}`
      : s.endpoint_path.startsWith("/") ? s.endpoint_path : `/${s.endpoint_path}`;
    const url = `${s.api_base.replace(/\/$/, "")}${ep}`;
    const payload = await resolveOutboundPayload(job);
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${jwt}`,
      },
      body: JSON.stringify(payload),
    });
    const body = await res.text();
    if (res.status === 200 || res.status === 201 || res.status === 409) {
      await supabaseAdmin.from("erp_outbox").update({
        status: "sent",
        sent_at: new Date().toISOString(),
        last_error: null,
        next_retry_at: null,
        tries: attemptTries,
      }).eq("id", outboxId);
      return { ok: true };
    }
    const msg = formatErpError(res.status, body, payload);
    await markFailed(outboxId, attemptTries, msg);
    return { ok: false, error: msg };
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    await markFailed(outboxId, attemptTries, msg);
    return { ok: false, error: msg };
  }
}

async function resolveOutboundPayload(job: any) {
  const payload = job.payload;
  const currentId = payload && typeof payload === "object"
    ? (payload.einsatzId ?? payload.EinsatzId)
    : null;
  const hasEinsatzId = typeof currentId === "string" && currentId.trim() !== "";
  const hasNewShape = payload && typeof payload === "object" && "einsatzId" in payload && "anlagenNr" in payload;
  const hasPascalDup = payload && typeof payload === "object" && "EinsatzId" in payload;
  if (hasEinsatzId && hasNewShape && hasPascalDup) return payload;
  if (!job.einsatz_id) return payload;

  const { data: einsatz } = await supabaseAdmin
    .from("einsaetze")
    .select("*")
    .eq("id", job.einsatz_id)
    .maybeSingle();

  if (!einsatz) return payload;

  const rebuiltPayload = await buildErpPayload(einsatz);
  await supabaseAdmin
    .from("erp_outbox")
    .update({ payload: rebuiltPayload as any, external_id: rebuiltPayload.einsatzId })
    .eq("id", job.id);

  return rebuiltPayload;
}

/**
 * Baut eine ausführliche Fehlermeldung für die Outbox:
 * - Status + Titel
 * - "detail" / "message" aus Problem+JSON
 * - Extrahierte Feldnamen aus errors{}, validationErrors[], oder Texten wie "X darf nicht leer sein"
 * - Vergleich mit Payload: welche dieser Felder sind null/leer
 * - gekürzter Raw-Body (max 800 Zeichen)
 */
function formatErpError(status: number, rawBody: string, payload: any): string {
  const lines: string[] = [`ERP HTTP ${status}`];
  let parsed: any = null;
  try { parsed = JSON.parse(rawBody); } catch { /* kein JSON */ }

  if (parsed && typeof parsed === "object") {
    if (parsed.title) lines.push(`Titel: ${parsed.title}`);
    if (parsed.detail) lines.push(`Detail: ${parsed.detail}`);
    else if (parsed.message) lines.push(`Detail: ${parsed.message}`);
  }

  const fields = extractFieldNames(parsed, rawBody);
  if (fields.length > 0) {
    lines.push(`Betroffene Felder: ${fields.join(", ")}`);
    if (payload && typeof payload === "object") {
      const empty = fields.filter((f) => {
        const v = (payload as any)[f];
        return v === null || v === undefined || v === "";
      });
      if (empty.length > 0) {
        lines.push(`⚠ Im Payload leer/null: ${empty.join(", ")}`);
      }
    }
  }

  lines.push(`Body: ${rawBody.slice(0, 800)}`);
  return lines.join(" | ");
}

function extractFieldNames(parsed: any, rawBody: string): string[] {
  const set = new Set<string>();

  // ASP.NET / RFC 7807: errors: { "FieldName": ["msg"] }
  if (parsed?.errors && typeof parsed.errors === "object" && !Array.isArray(parsed.errors)) {
    for (const k of Object.keys(parsed.errors)) set.add(k);
  }
  // validationErrors: [{ field: "X" }]
  if (Array.isArray(parsed?.validationErrors)) {
    for (const e of parsed.validationErrors) {
      if (e?.field) set.add(String(e.field));
      if (e?.propertyName) set.add(String(e.propertyName));
    }
  }

  // Text-Heuristik: "FeldName darf nicht leer sein" / "is required" / "must not be empty"
  const patterns = [
    /([A-Z][A-Za-z0-9_]+)\s+darf\s+nicht\s+leer\s+sein/g,
    /([A-Z][A-Za-z0-9_]+)\s+(?:is\s+required|must\s+not\s+be\s+empty|is\s+missing)/gi,
    /["']([A-Z][A-Za-z0-9_]+)["']\s*:\s*\[/g,
  ];
  for (const re of patterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(rawBody)) !== null) set.add(m[1]);
  }
  return Array.from(set);
}

async function markFailed(id: string, tries: number, message: string) {
  await supabaseAdmin.from("erp_outbox").update({
    status: "failed",
    tries,
    last_error: message,
    next_retry_at: new Date(Date.now() + 60_000).toISOString(),
  }).eq("id", id);
}

export async function processDueErpJobs(limit = 20) {
  const nowIso = new Date().toISOString();
  const { data: jobs } = await supabaseAdmin
    .from("erp_outbox")
    .select("id")
    .in("status", ["pending", "failed"])
    .or(`next_retry_at.is.null,next_retry_at.lte.${nowIso}`)
    .order("created_at", { ascending: true })
    .limit(limit);
  const results: { id: string; ok: boolean; error?: string }[] = [];
  for (const j of jobs ?? []) {
    const r = await processErpOutboxItem(j.id);
    results.push({ id: j.id, ...r });
  }
  return results;
}

export async function enqueueErpForEinsatz(opts: {
  einsatz_id: string;
  domain_id: string;
  created_by?: string | null;
}): Promise<{ outbox_id: string } | { skipped: string }> {
  const { data: s } = await supabaseAdmin
    .from("erp_settings").select("*").eq("domain_id", opts.domain_id).maybeSingle();
  if (!s || !s.aktiv) return { skipped: "ERP nicht aktiv" };

  const { data: einsatz, error: eErr } = await supabaseAdmin
    .from("einsaetze").select("*").eq("id", opts.einsatz_id).single();
  if (eErr || !einsatz) throw new Error("Einsatz nicht gefunden");

  const payload = await buildErpPayload(einsatz);
  const { data: row, error } = await supabaseAdmin
    .from("erp_outbox")
    .insert({
      domain_id: opts.domain_id,
      einsatz_id: opts.einsatz_id,
      external_id: payload.einsatzId,
      payload: payload as any,
      status: "pending",
      created_by: opts.created_by ?? null,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  // Best-effort: sofort versuchen
  processErpOutboxItem(row.id).catch(() => null);
  return { outbox_id: row.id };
}
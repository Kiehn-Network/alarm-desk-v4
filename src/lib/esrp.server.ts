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
  return toBerlinIso(d);
}

// Formatiert ein Datum als ISO-8601 in Europa/Berlin-Ortszeit mit korrektem Offset
// (+01:00 im Winter, +02:00 im Sommer). Das ERP interpretiert "Z" als UTC –
// für deutsche Ortszeit muss der Offset explizit gesetzt sein.
function toBerlinIso(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Berlin",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false, timeZoneName: "longOffset",
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const hour = get("hour") === "24" ? "00" : get("hour");
  const tz = get("timeZoneName"); // e.g. "GMT+02:00" or "GMT"
  const m = tz.match(/GMT([+-]\d{2}:?\d{2})?/);
  let offset = "+00:00";
  if (m && m[1]) offset = m[1].includes(":") ? m[1] : `${m[1].slice(0, 3)}:${m[1].slice(3)}`;
  return `${get("year")}-${get("month")}-${get("day")}T${hour}:${get("minute")}:${get("second")}${offset}`;
}

function ynBool(v: any): boolean | null {
  if (v === true || v === "ja" || v === 1 || v === "1") return true;
  if (v === false || v === "nein" || v === 0 || v === "0") return false;
  return null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
// Anlagennummern des ERP beginnen bei 500001 – kleinere Werte lehnt die API ab.
const MIN_ANLAGEN_NR = 500001;

export function isValidEmail(v: any): boolean {
  return typeof v === "string" && EMAIL_RE.test(v.trim());
}

async function lookupUserEmail(userId: string): Promise<string | null> {
  try {
    const { data } = await supabaseAdmin.auth.admin.getUserById(userId);
    const mail = data?.user?.email ?? null;
    return isValidEmail(mail) ? String(mail).trim() : null;
  } catch {
    return null;
  }
}

/**
 * Prüft den Payload vor dem Versand auf bekannte Datenfehler, die das ERP
 * mit HTTP 400 ablehnt. Solche Jobs dürfen NICHT endlos wiederholt werden.
 */
export function validateErpPayload(payload: any): string[] {
  const problems: string[] = [];
  if (!isValidEmail(payload?.personalEmail)) {
    problems.push("personalEmail fehlt oder ist keine gültige E-Mail-Adresse (Fahrer/Ersteller ohne E-Mail hinterlegt)");
  }
  const anr = Number(payload?.anlagenNr);
  if (!Number.isFinite(anr) || anr < MIN_ANLAGEN_NR) {
    problems.push(`anlagenNr ungültig (${payload?.anlagenNr ?? "leer"}) – gültige ERP-Anlagennummern beginnen bei ${MIN_ANLAGEN_NR}`);
  }
  const apn = Number(payload?.aenderPersonalNr);
  if (!Number.isFinite(apn) || apn <= 0) {
    problems.push("aenderPersonalNr muss größer als 0 sein");
  }
  if (!payload?.einsatzDatum) problems.push("einsatzDatum fehlt");
  return problems;
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

  // Arbeitszeit-Zeitpunkte werden weiter unten aus den ERFASSTEN Zeiten gebaut.
  // WICHTIG: niemals "jetzt" verwenden – sonst bekommt ein zeitversetzt
  // gesendeter Einsatz den Sendezeitpunkt statt der echten Einsatzzeiten.


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
    personalEmail = (await lookupUserEmail(einsatz.assigned_to)) ?? "";
  }
  // Fallback-Kette: zugewiesener Fahrer -> Ersteller des Einsatzes.
  if (!isValidEmail(personalEmail) && einsatz.created_by) {
    personalEmail = (await lookupUserEmail(einsatz.created_by)) ?? "";
  }
  if (!isValidEmail(personalEmail)) personalEmail = "";

  // Ersteller-/Änderer-Personalnummer aus ERP-Einstellungen.
  // Das ERP verlangt eine positive Nummer – 0 ist unzulässig.
  // Fallback bis zur finalen Abstimmung: 999.
  let aenderPersonalNr = 999;
  if (einsatz.domain_id) {
    const { data: s } = await supabaseAdmin
      .from("erp_settings")
      .select("aender_personal_nr")
      .eq("domain_id", einsatz.domain_id)
      .maybeSingle();
    const raw = (s as any)?.aender_personal_nr;
    const num = typeof raw === "number" ? raw : raw != null && raw !== "" ? Number(raw) : NaN;
    if (Number.isFinite(num) && num > 0) aenderPersonalNr = num;
  }

  // Arbeitszeit — vier Zeitpunkte, ausschliesslich aus ERFASSTEN Zeiten.
  // Kein Fallback auf "jetzt": ein zeitversetzt gesendeter Einsatz darf niemals
  // den Sendezeitpunkt als Arbeitszeit bekommen.
  const tMs = (v: any): number | null => {
    const iso = toIsoOrNull(v);
    if (!iso) return null;
    const t = new Date(iso).getTime();
    return Number.isFinite(t) ? t : null;
  };
  const tCreated = tMs(einsatz.created_at);
  const tAssigned = tMs(einsatz.assigned_at);
  const tAbfahrtZ = tMs(einsatz.abfahrt_zentrale_am);
  const tVorOrt = tMs(einsatz.vor_ort_am);
  const tAbfahrt = tMs(einsatz.abfahrt_am);
  const tEnde = tMs(einsatz.einsatz_ende_am);
  const tAbgeschlossen = tMs(einsatz.abgeschlossen_am);
  const tGeplant = tMs(einsatz.geplant_am);

  // Ankunft vor Ort ist der stabilste Anker.
  let beginnNettoMs = tVorOrt ?? tAbfahrtZ ?? tAssigned ?? tCreated ?? tGeplant ?? tEnde ?? Date.now();

  // Beginn (Abfahrt Zentrale). assigned_at kann deutlich NACH dem Einsatz liegen
  // (nachträgliche Zuweisung) – dann ist es als Beginn unbrauchbar.
  const beginnKandidaten = [tAbfahrtZ, tAssigned, tCreated, tGeplant].filter(
    (t): t is number => t !== null && t <= beginnNettoMs,
  );
  const beginnBruttoMs = beginnKandidaten.length > 0 ? Math.min(...beginnKandidaten) : beginnNettoMs;
  if (beginnNettoMs < beginnBruttoMs) beginnNettoMs = beginnBruttoMs;

  // Ende vor Ort / Ende gesamt.
  let endeNettoMs = tAbfahrt ?? tEnde ?? tAbgeschlossen ?? beginnNettoMs;
  if (endeNettoMs < beginnNettoMs) endeNettoMs = beginnNettoMs;
  let endeBruttoMs = tEnde ?? tAbgeschlossen ?? endeNettoMs;
  if (endeBruttoMs < endeNettoMs) endeBruttoMs = endeNettoMs;

  const [bB, bN, eN, eB] = [beginnBruttoMs, beginnNettoMs, endeNettoMs, endeBruttoMs].map((t) =>
    toBerlinIso(new Date(t)),
  );
  const arbeitszeit = {
    beginnBrutto: bB,
    beginnNetto: bN,
    endeNetto: eN,
    endeBrutto: eB,
    pauseMinuten: 0,
  };

  // EinsatzDatum = Beginn des Einsatzes (konsistent zu beginnBrutto, gleiche Zeitzone).
  const einsatzDatum = bB;


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
    let pdfZeiten: any = null;
    if (einsatz.domain_id) {
      const { data: as } = await supabaseAdmin
        .from("app_settings")
        .select("pdf_zeiten_config")
        .eq("domain_id", einsatz.domain_id)
        .maybeSingle();
      pdfZeiten = (as as any)?.pdf_zeiten_config ?? null;
    }
    const base64 = einsatzPdfBase64(einsatz, fahrerName, pdfZeiten);
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

    // Vorab-Validierung: Datenfehler gar nicht erst senden.
    const problems = validateErpPayload(payload);
    if (problems.length > 0) {
      const msg = `Datenfehler: ${problems.join(" | ")}`;
      await markPermanent(outboxId, attemptTries, msg);
      return { ok: false, error: msg };
    }

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
    // 4xx = Datenfehler (außer 408/425/429) -> erneutes Senden mit denselben Daten
    // ist zwecklos. Job dauerhaft stoppen, bis die Daten korrigiert und der Job
    // manuell erneut gesendet wird.
    if (res.status >= 400 && res.status < 500 && ![408, 425, 429].includes(res.status)) {
      await markPermanent(outboxId, attemptTries, msg);
      return { ok: false, error: msg };
    }
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
  // Payload IMMER neu bauen, solange der Einsatz existiert – so werden korrigierte
  // Stammdaten (E-Mail, AnlagenNr, PersonalNr) beim erneuten Senden übernommen.
  if (!job.einsatz_id) return payload;
  void hasEinsatzId;

  const { data: einsatz } = await supabaseAdmin
    .from("einsaetze")
    .select("*")
    .eq("id", job.einsatz_id)
    .maybeSingle();

  if (!einsatz) return payload;

  const rebuiltPayload = await buildErpPayload(einsatz);
  await supabaseAdmin
    .from("erp_outbox")
    .update({ payload: rebuiltPayload as any, external_id: String(rebuiltPayload.einsatzId) })
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

export const ERP_PERMANENT_PREFIX = "ENDGÜLTIG (kein Auto-Retry): ";
const MAX_ERP_TRIES = 10;

async function markFailed(id: string, tries: number, message: string) {
  if (tries >= MAX_ERP_TRIES) {
    await markPermanent(id, tries, `Maximale Versuche (${MAX_ERP_TRIES}) erreicht. ${message}`);
    return;
  }
  // Exponentielles Backoff: 1min, 2, 4, 8 ... max 6h
  const delay = Math.min(60_000 * 2 ** Math.max(0, tries - 1), 6 * 60 * 60_000);
  await supabaseAdmin.from("erp_outbox").update({
    status: "failed",
    tries,
    last_error: message,
    next_retry_at: new Date(Date.now() + delay).toISOString(),
  }).eq("id", id);
}

/**
 * Endgültiger Fehler: Job bleibt "failed", wird aber vom Worker nicht mehr
 * abgeholt (next_retry_at = null). Nur manuelles "Erneut senden" reaktiviert ihn.
 */
async function markPermanent(id: string, tries: number, message: string) {
  await supabaseAdmin.from("erp_outbox").update({
    status: "failed",
    tries,
    last_error: ERP_PERMANENT_PREFIX + message,
    next_retry_at: null,
  }).eq("id", id);
}

export async function processDueErpJobs(limit = 20) {
  const nowIso = new Date().toISOString();
  const { data: pendingJobs } = await supabaseAdmin
    .from("erp_outbox")
    .select("id")
    .eq("status", "pending")
    .or(`next_retry_at.is.null,next_retry_at.lte.${nowIso}`)
    .order("created_at", { ascending: true })
    .limit(limit);
  // Fehlgeschlagene Jobs nur, wenn ein Retry-Zeitpunkt gesetzt und fällig ist.
  // next_retry_at = null bedeutet "endgültiger Datenfehler" – kein Auto-Retry.
  const { data: failedJobs } = await supabaseAdmin
    .from("erp_outbox")
    .select("id")
    .eq("status", "failed")
    .not("next_retry_at", "is", null)
    .lte("next_retry_at", nowIso)
    .order("created_at", { ascending: true })
    .limit(limit);
  const jobs = [...(pendingJobs ?? []), ...(failedJobs ?? [])].slice(0, limit);
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
      external_id: String(payload.einsatzId),
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
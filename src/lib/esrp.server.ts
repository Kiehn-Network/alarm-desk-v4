import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type ErpSettings = {
  domain_id: string;
  api_base: string;
  api_user: string;
  api_token: string;
  endpoint_path: string;
  use_api_prefix: boolean;
  aktiv: boolean;
  auto_on_abschluss: boolean;
};

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
    einsatz.vor_ort_am ||
    einsatz.assigned_at ||
    einsatz.geplant_am ||
    einsatz.abgeschlossen_am ||
    einsatz.created_at ||
    new Date().toISOString();

  // Fahrername aus Profil auflösen (Legacy-Format erwartet "fahrer" als Klartext).
  let fahrer: string | null = null;
  let identNr: string | null = null;
  if (einsatz.assigned_to) {
    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("display_name")
      .eq("id", einsatz.assigned_to)
      .maybeSingle();
    fahrer = prof?.display_name ?? null;
  }

  // Bericht-Daten flach in "daten" übernehmen (Legacy-Schema).
  const bericht: Record<string, unknown> = {};
  if (einsatz.bericht_data && typeof einsatz.bericht_data === "object") {
    for (const [k, v] of Object.entries(einsatz.bericht_data as Record<string, unknown>)) {
      bericht[k] = v;
    }
  }

  const daten: Record<string, unknown> = {
    ...bericht,
    permission_id: String(einsatz.id),
    fahrer,
    identNr,
    leitstelle_user: null,
    status_local: einsatz.status ?? null,
    vorort_time: einsatz.vor_ort_am ?? null,
    abfahrt_time: einsatz.abfahrt_am ?? null,
    sharfschaltungs_time: einsatz.einsatz_ende_am ?? null,
  };

  return {
    einsatzId: `AD-${einsatz.id}`,
    anlagenNr,
    einsatzDatum,
    daten,
  };
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
  if ((job.status as string) === "sending") return { ok: true, error: "bereits in Verarbeitung" };

  // Atomar beanspruchen: nur fortfahren, wenn wir den Job exklusiv von
  // pending/failed auf 'sending' setzen können. Verhindert Doppelversand
  // durch parallele Worker- und Inline-Aufrufe.
  const { data: claimed } = await supabaseAdmin
    .from("erp_outbox")
    .update({ status: "sending" as any })
    .eq("id", outboxId)
    .in("status", ["pending", "failed"])
    .select("id")
    .maybeSingle();
  if (!claimed) return { ok: true, error: "bereits beansprucht" };

  const { data: s, error: sErr } = await supabaseAdmin
    .from("erp_settings").select("*").eq("domain_id", job.domain_id).maybeSingle();
  if (sErr || !s) {
    await markFailed(outboxId, job.tries, "ERP-Konfiguration fehlt");
    return { ok: false, error: "ERP-Konfiguration fehlt" };
  }
  if (!s.aktiv) {
    await markFailed(outboxId, job.tries, "ERP nicht aktiv");
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
        tries: job.tries + 1,
      }).eq("id", outboxId);
      return { ok: true };
    }
    const msg = formatErpError(res.status, body, payload);
    await markFailed(outboxId, job.tries, msg);
    return { ok: false, error: msg };
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    await markFailed(outboxId, job.tries, msg);
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
  if (hasEinsatzId && hasNewShape) return payload;
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

async function markFailed(id: string, prevTries: number, message: string) {
  await supabaseAdmin.from("erp_outbox").update({
    status: "failed",
    tries: prevTries + 1,
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
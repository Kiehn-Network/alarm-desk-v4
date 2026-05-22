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

export function buildErpPayload(einsatz: any) {
  return {
    einsatz_id: `AD-${einsatz.id}`,
    kunden_name: einsatz.kunden_name ?? null,
    address: einsatz.address ?? null,
    key_number: einsatz.key_number ?? null,
    anlagen_nr: einsatz.anlagen_nr ?? null,
    teilnehmer_id: einsatz.teilnehmer_id ?? null,
    einsatzgrund: einsatz.einsatzgrund ?? null,
    einsatz_typ: einsatz.einsatz_typ ?? null,
    beschreibung: einsatz.beschreibung ?? null,
    prioritaet: einsatz.prioritaet ?? null,
    geplant_am: einsatz.geplant_am ?? null,
    assigned_at: einsatz.assigned_at ?? null,
    vor_ort_am: einsatz.vor_ort_am ?? null,
    abfahrt_am: einsatz.abfahrt_am ?? null,
    einsatz_ende_am: einsatz.einsatz_ende_am ?? null,
    abgeschlossen_am: einsatz.abgeschlossen_am ?? null,
    bericht_typ: einsatz.bericht_typ ?? null,
    bericht_data: einsatz.bericht_data ?? null,
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
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${jwt}`,
      },
      body: JSON.stringify(job.payload),
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
    const msg = `ERP HTTP ${res.status}: ${body.slice(0, 500)}`;
    await markFailed(outboxId, job.tries, msg);
    return { ok: false, error: msg };
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    await markFailed(outboxId, job.tries, msg);
    return { ok: false, error: msg };
  }
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

  const payload = buildErpPayload(einsatz);
  const { data: row, error } = await supabaseAdmin
    .from("erp_outbox")
    .insert({
      domain_id: opts.domain_id,
      einsatz_id: opts.einsatz_id,
      external_id: payload.einsatz_id,
      payload,
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
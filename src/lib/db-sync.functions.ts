import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const SYNC_TABLES: string[] = [
  "domains",
  "app_modules",
  "platform_settings",
  "app_settings",
  "app_versions",
  "domain_modules",
  "licenses",
  "hausnotruf_provider_settings",
  "erp_settings",
  "einsatz_gruende",
  "profiles",
  "user_roles",
  "user_tour_settings",
  "budeko_mitarbeiter",
  "rohrservice_mitarbeiter",
  "einsaetze",
  "schluessel_buch",
  "dateien",
  "datei_historie",
  "datei_verknuepfungen",
  "einsatz_historie",
  "einsatz_email_log",
  "hausnotruf_abrechnung_log",
  "driver_locations",
  "dienstplaene",
  "intrahub_posts",
  "chat_conversations",
  "chat_participants",
  "chat_messages",
  "owks_objekte",
  "owks_bestreifungsplaene",
  "owks_kontrollpunkte",
  "owks_rundgaenge",
  "owks_bestreifungen",
  "owks_durchgaenge",
  "owks_ereignisse",
  "owks_scans",
  "budeko_notdienst",
  "budeko_berichte",
  "budeko_notiz_dateien",
  "rohrservice_notdienst",
  "rohrservice_berichte",
  "rohrservice_notiz_dateien",
  "support_tickets",
  "support_ticket_messages",
  "erp_outbox",
  "email_send_log",
  "email_send_state",
  "email_unsubscribe_tokens",
  "suppressed_emails",
  "data_purge_requests",
  "superadmin_audit_log",
  "superadmin_impersonation",
];

const BATCH = 500;
const MAX_PASSES = 3;

type TableResult = {
  table: string;
  read: number;
  written: number;
  skipped?: number;
  error?: string;
  errorDetail?: string;
};

type LogLine = { t: string; level: "info" | "warn" | "error"; msg: string; extra?: unknown };

function logLine(level: LogLine["level"], msg: string, extra?: unknown): LogLine {
  return { t: new Date().toISOString(), level, msg, ...(extra !== undefined ? { extra } : {}) };
}

const NATURAL_CONFLICT_TARGETS: Record<string, string[]> = {
  domains: ["slug"],
  app_modules: ["key"],
  einsatz_gruende: ["name"],
  licenses: ["license_key"],
  email_unsubscribe_tokens: ["email"],
  suppressed_emails: ["email"],
  user_roles: ["user_id", "role"],
};

const PRIMARY_KEY_COLUMNS: Record<string, string[]> = {
  app_settings: ["domain_id"],
  chat_participants: ["conversation_id", "user_id"],
  domain_modules: ["domain_id", "module_key"],
  driver_locations: ["user_id"],
  erp_settings: ["domain_id"],
  hausnotruf_provider_settings: ["domain_id", "provider_key"],
  schluesseluebergabe_settings: ["domain_id"],
  superadmin_impersonation: ["superadmin_id"],
  user_tour_settings: ["user_id"],
};

const AUTH_USER_REFS: Record<string, { column: string; nullable: boolean }[]> = {
  app_versions: [{ column: "created_by", nullable: true }],
  auswertung_pins: [{ column: "created_by", nullable: false }],
  budeko_berichte: [{ column: "created_by", nullable: true }],
  budeko_mitarbeiter: [{ column: "created_by", nullable: true }],
  budeko_notdienst: [{ column: "created_by", nullable: true }],
  budeko_notiz_dateien: [{ column: "created_by", nullable: true }],
  chat_conversations: [{ column: "created_by", nullable: true }],
  chat_participants: [{ column: "user_id", nullable: false }],
  data_purge_requests: [{ column: "requested_by", nullable: true }, { column: "decided_by", nullable: true }],
  datei_verknuepfungen: [{ column: "created_by", nullable: true }],
  dateien: [{ column: "uploaded_by", nullable: true }, { column: "deleted_by", nullable: true }],
  dienstplaene: [{ column: "uploaded_by", nullable: true }],
  einsaetze: [{ column: "created_by", nullable: false }, { column: "assigned_to", nullable: true }],
  einsatz_gruende: [{ column: "created_by", nullable: true }],
  einsatz_partner_shares: [{ column: "created_by", nullable: true }, { column: "partner_assigned_to", nullable: true }],
  erp_outbox: [{ column: "created_by", nullable: true }],
  intervention_allowlist: [{ column: "created_by", nullable: true }],
  intrahub_posts: [{ column: "created_by", nullable: false }],
  owks_bestreifungen: [{ column: "created_by", nullable: true }],
  owks_bestreifungsplaene: [{ column: "created_by", nullable: true }],
  owks_ereignisse: [{ column: "created_by", nullable: true }],
  owks_kontrollpunkte: [{ column: "created_by", nullable: true }],
  owks_objekte: [{ column: "created_by", nullable: true }],
  owks_rundgaenge: [{ column: "created_by", nullable: true }],
  profiles: [{ column: "id", nullable: false }],
  rohrservice_berichte: [{ column: "created_by", nullable: true }],
  rohrservice_mitarbeiter: [{ column: "created_by", nullable: true }],
  rohrservice_notdienst: [{ column: "created_by", nullable: true }],
  rohrservice_notiz_dateien: [{ column: "created_by", nullable: true }],
  schluesseluebergabe_protokolle: [{ column: "created_by", nullable: true }],
  support_ticket_messages: [{ column: "author_id", nullable: false }],
  support_tickets: [{ column: "created_by", nullable: false }],
  user_roles: [{ column: "user_id", nullable: false }],
  user_tour_settings: [{ column: "user_id", nullable: false }],
};

const SKIP_IF_PARENT_SKIPPED: Record<string, { column: string; parent: string }[]> = {
  chat_messages: [{ column: "conversation_id", parent: "chat_conversations" }],
  chat_participants: [{ column: "conversation_id", parent: "chat_conversations" }],
  datei_historie: [{ column: "datei_id", parent: "dateien" }],
  datei_verknuepfungen: [
    { column: "datei_a_id", parent: "dateien" },
    { column: "datei_b_id", parent: "dateien" },
  ],
  einsatz_historie: [{ column: "einsatz_id", parent: "einsaetze" }],
  einsatz_partner_shares: [{ column: "einsatz_id", parent: "einsaetze" }],
  owks_bestreifungen: [
    { column: "objekt_id", parent: "owks_objekte" },
    { column: "plan_id", parent: "owks_bestreifungsplaene" },
    { column: "rundgang_id", parent: "owks_rundgaenge" },
  ],
  owks_bestreifungsplaene: [
    { column: "objekt_id", parent: "owks_objekte" },
    { column: "rundgang_id", parent: "owks_rundgaenge" },
  ],
  owks_durchgaenge: [{ column: "bestreifung_id", parent: "owks_bestreifungen" }],
  owks_ereignisse: [
    { column: "bestreifung_id", parent: "owks_bestreifungen" },
    { column: "durchgang_id", parent: "owks_durchgaenge" },
    { column: "kontrollpunkt_id", parent: "owks_kontrollpunkte" },
  ],
  owks_kontrollpunkte: [
    { column: "objekt_id", parent: "owks_objekte" },
    { column: "rundgang_id", parent: "owks_rundgaenge" },
  ],
  owks_rundgaenge: [{ column: "objekt_id", parent: "owks_objekte" }],
  owks_scans: [
    { column: "durchgang_id", parent: "owks_durchgaenge" },
    { column: "kontrollpunkt_id", parent: "owks_kontrollpunkte" },
  ],
  support_ticket_messages: [{ column: "ticket_id", parent: "support_tickets" }],
};

type TargetPrep = {
  domainIdBySourceId: Map<string, string>;
  targetUserIds: Set<string>;
  userCheckAvailable: boolean;
  warnings: string[];
};

type PushResult = { written: number; skipped: number; warnings: string[]; skippedKeys?: string[] };

type RestError = {
  status: number;
  statusText: string;
  body: string;
  code?: string;
  message?: string;
  details?: string;
  hint?: string | null;
};

function keyForRow(table: string, row: Record<string, unknown>): string | null {
  const cols = PRIMARY_KEY_COLUMNS[table] ?? ["id"];
  const parts = cols.map((col) => row[col]);
  if (parts.some((value) => value === null || value === undefined || value === "")) return null;
  return parts.join("|");
}

function restErrorMessage(error: RestError): string {
  return `HTTP ${error.status} ${error.statusText} – ${error.body.slice(0, 1500)}`;
}

function parseMissingColumn(error: RestError): string | null {
  if (error.code !== "PGRST204") return null;
  const text = `${error.message ?? ""} ${error.body}`;
  return text.match(/'([^']+)' column/)?.[1] ?? null;
}

function compactWarnings(warnings: string[]): string[] {
  const counts = new Map<string, number>();
  for (const warning of warnings) counts.set(warning, (counts.get(warning) ?? 0) + 1);
  return [...counts.entries()].map(([warning, count]) => count > 1 ? `${warning} (${count}x)` : warning);
}

function applyDomainMapping(row: Record<string, unknown>, domainIdBySourceId: Map<string, string>) {
  for (const column of ["domain_id", "owner_domain_id", "partner_domain_id", "target_domain_id"]) {
    const value = row[column];
    if (typeof value === "string") row[column] = domainIdBySourceId.get(value) ?? value;
  }
}

async function fetchTargetRows(
  targetUrl: string,
  serviceKey: string,
  table: string,
  select = "*",
): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = [];
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const url = new URL(`${targetUrl}/rest/v1/${table}`);
    url.searchParams.set("select", select);
    const res = await fetch(url, {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        Range: `${from}-${from + pageSize - 1}`,
      },
    });
    if (!res.ok) throw new Error(`${table}: Ziel lesen fehlgeschlagen – HTTP ${res.status}`);
    const data = await res.json() as Record<string, unknown>[];
    if (!data || data.length === 0) break;
    out.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return out;
}

async function listTargetUserIds(targetUrl: string, serviceKey: string): Promise<Set<string>> {
  const client = createClient(targetUrl, serviceKey, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
  const ids = new Set<string>();
  for (let page = 1; page <= 100; page++) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const users = data?.users ?? [];
    for (const user of users) ids.add(user.id);
    if (users.length < 1000) break;
  }
  return ids;
}

async function prepareTargetSync(targetUrl: string, serviceKey: string): Promise<TargetPrep> {
  const warnings: string[] = [];
  const domainIdBySourceId = new Map<string, string>();

  try {
    const [sourceDomains, targetDomains] = await Promise.all([
      fetchAllRows("domains"),
      fetchTargetRows(targetUrl, serviceKey, "domains", "id,slug"),
    ]);
    const targetIdBySlug = new Map(
      targetDomains
        .filter((row) => typeof row.slug === "string" && typeof row.id === "string")
        .map((row) => [row.slug as string, row.id as string]),
    );
    for (const source of sourceDomains) {
      if (typeof source.id !== "string" || typeof source.slug !== "string") continue;
      const targetId = targetIdBySlug.get(source.slug);
      if (targetId && targetId !== source.id) domainIdBySourceId.set(source.id, targetId);
    }
    if (domainIdBySourceId.size > 0) {
      warnings.push(`${domainIdBySourceId.size} Domain-ID-Zuordnung(en) über slug erkannt`);
    }
  } catch (e) {
    warnings.push(`Domain-Vorabprüfung nicht möglich: ${(e as Error).message}`);
  }

  let targetUserIds = new Set<string>();
  let userCheckAvailable = false;
  try {
    targetUserIds = await listTargetUserIds(targetUrl, serviceKey);
    userCheckAvailable = true;
    warnings.push(`${targetUserIds.size} Auth-Benutzer in der Zielinstanz gefunden`);
  } catch (e) {
    warnings.push(`Auth-Benutzer der Zielinstanz konnten nicht geprüft werden: ${(e as Error).message}`);
  }

  return { domainIdBySourceId, targetUserIds, userCheckAvailable, warnings };
}

async function reloadTargetSchemaCache(dbUrl: string | undefined, pushLog: (level: LogLine["level"], msg: string, extra?: unknown) => Promise<void>) {
  if (!dbUrl) return;
  let sql: any = null;
  try {
    const { default: postgres } = await import("postgres");
    sql = postgres(dbUrl, { ssl: "require", max: 1, idle_timeout: 5, connect_timeout: 10, prepare: false });
    await sql.unsafe("NOTIFY pgrst, 'reload schema'");
    await pushLog("info", "Ziel-Schema-Cache neu geladen");
  } catch (e) {
    await pushLog("warn", `Ziel-Schema-Cache konnte nicht neu geladen werden: ${(e as Error).message}`);
  } finally {
    try { if (sql) await sql.end({ timeout: 5 }); } catch {}
  }
}

function transformRowsForTarget(
  table: string,
  rows: Record<string, unknown>[],
  prep: TargetPrep,
  skippedKeysByTable: Map<string, Set<string>>,
): { rows: Record<string, unknown>[]; skipped: number; warnings: string[]; skippedKeys: string[] } {
  const out: Record<string, unknown>[] = [];
  const warnings: string[] = [];
  const skippedKeys: string[] = [];

  for (const sourceRow of rows) {
    const row = { ...sourceRow };
    let skipReason: string | null = null;

    if (table === "domains" && typeof row.id === "string" && prep.domainIdBySourceId.has(row.id)) {
      row.id = prep.domainIdBySourceId.get(row.id)!;
    }
    applyDomainMapping(row, prep.domainIdBySourceId);

    for (const ref of AUTH_USER_REFS[table] ?? []) {
      const value = row[ref.column];
      if (!prep.userCheckAvailable || typeof value !== "string" || prep.targetUserIds.has(value)) continue;
      if (ref.nullable) {
        row[ref.column] = null;
      } else {
        skipReason = `Auth-Benutzer fehlt (${ref.column})`;
        break;
      }
    }

    if (!skipReason) {
      for (const ref of SKIP_IF_PARENT_SKIPPED[table] ?? []) {
        const value = row[ref.column];
        const parentSkipped = typeof value === "string" && skippedKeysByTable.get(ref.parent)?.has(value);
        if (parentSkipped) {
          skipReason = `abhängiger Datensatz fehlt (${ref.parent})`;
          break;
        }
      }
    }

    if (skipReason) {
      const key = keyForRow(table, row);
      if (key) skippedKeys.push(key);
      warnings.push(`${table}: Zeile übersprungen – ${skipReason}`);
    } else {
      out.push(row);
    }
  }

  return { rows: out, skipped: rows.length - out.length, warnings, skippedKeys };
}

async function assertSuperadmin(userId: string) {
  const { data: role } = await supabaseAdmin
    .from("user_roles").select("role")
    .eq("user_id", userId).eq("role", "superadmin").maybeSingle();
  if (!role) throw new Error("Nur SuperAdmin");
}

async function fetchAllRows(table: string): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = [];
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await (supabaseAdmin as any)
      .from(table).select("*").range(from, from + pageSize - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    if (!data || data.length === 0) break;
    out.push(...(data as Record<string, unknown>[]));
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return out;
}

async function pushBatch(
  targetUrl: string, serviceKey: string, table: string, rows: Record<string, unknown>[],
): Promise<PushResult> {
  if (rows.length === 0) return { written: 0, skipped: 0, warnings: [], skippedKeys: [] };
  const warnings: string[] = [];
  let currentRows = rows;

  for (let attempt = 0; attempt < 12; attempt++) {
    const error = await postRows(targetUrl, serviceKey, table, currentRows);
    if (!error) return { written: rows.length, skipped: 0, warnings };

    const missingColumn = parseMissingColumn(error);
    if (missingColumn && currentRows.some((row) => Object.prototype.hasOwnProperty.call(row, missingColumn))) {
      currentRows = currentRows.map(({ [missingColumn]: _missing, ...rest }) => rest);
      warnings.push(`${table}: Zielspalte '${missingColumn}' fehlt – Spalte beim Sync ausgelassen`);
      continue;
    }

    if (currentRows.length > 1 && ["23503", "23505", "23502"].includes(error.code ?? "")) {
      let written = 0;
      let skipped = 0;
      const skippedKeys: string[] = [];
      for (const row of currentRows) {
        const result = await pushBatch(targetUrl, serviceKey, table, [row]);
        written += result.written;
        skipped += result.skipped;
        warnings.push(...result.warnings);
        skippedKeys.push(...(result.skippedKeys ?? []));
      }
      return { written, skipped, warnings, skippedKeys };
    }

    if (currentRows.length === 1 && ["23503", "23505", "23502"].includes(error.code ?? "")) {
      warnings.push(`${table}: Zeile übersprungen – ${restErrorMessage(error)}`);
      const key = keyForRow(table, currentRows[0]);
      return { written: 0, skipped: 1, warnings, skippedKeys: key ? [key] : [] };
    }

    throw new Error(restErrorMessage(error));
  }

  throw new Error(`${table}: zu viele automatische Wiederholungen wegen Schema-Unterschieden`);
}

async function postRows(
  targetUrl: string,
  serviceKey: string,
  table: string,
  rows: Record<string, unknown>[],
): Promise<RestError | null> {
  const url = new URL(`${targetUrl}/rest/v1/${table}`);
  const conflictTarget = NATURAL_CONFLICT_TARGETS[table];
  if (conflictTarget) url.searchParams.set("on_conflict", conflictTarget.join(","));
  const res = await fetch(url, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(rows),
  });
  if (res.ok) return null;

  const body = await res.text();
  let parsed: Partial<RestError> = {};
  try { parsed = JSON.parse(body) as Partial<RestError>; } catch {}
  return {
    status: res.status,
    statusText: res.statusText,
    body,
    code: parsed.code,
    message: parsed.message,
    details: parsed.details,
    hint: parsed.hint,
  };
}

export const previewSyncTarget = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperadmin(context.userId);
    const targetUrl = process.env.SYNC_TARGET_SUPABASE_URL;
    const serviceKey = process.env.SYNC_TARGET_SERVICE_ROLE_KEY;
    if (!targetUrl || !serviceKey) {
      return { configured: false as const, message: "Sync-Secrets nicht gesetzt" };
    }
    const sourceUrl = process.env.SUPABASE_URL ?? null;
    let targetReachable = false;
    let targetError: string | null = null;
    try {
      const res = await fetch(`${targetUrl}/rest/v1/domains?select=id&limit=1`, {
        headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
      });
      targetReachable = res.ok;
      if (!res.ok) targetError = `HTTP ${res.status}`;
    } catch (e) {
      targetError = (e as Error).message;
    }
    return {
      configured: true as const,
      sourceUrl, targetUrl, targetReachable, targetError,
      tables: SYNC_TABLES,
    };
  });

export const startSyncJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperadmin(context.userId);
    const targetUrl = process.env.SYNC_TARGET_SUPABASE_URL;
    const serviceKey = process.env.SYNC_TARGET_SERVICE_ROLE_KEY;
    if (!targetUrl || !serviceKey) {
      throw new Error("SYNC_TARGET_SUPABASE_URL und SYNC_TARGET_SERVICE_ROLE_KEY müssen gesetzt sein.");
    }
    const { data, error } = await supabaseAdmin
      .from("sync_jobs")
      .insert({
        started_by: context.userId,
        status: "running",
        target_url: targetUrl,
        total_tables: SYNC_TABLES.length,
        logs: [logLine("info", `Sync gestartet → ${targetUrl}`)] as never,
      })
      .select("id").single();
    if (error) throw new Error(`sync_jobs insert: ${error.message}`);
    return { jobId: (data as { id: string }).id };
  });

export const getSyncJob = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ jobId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperadmin(context.userId);
    const { data: row, error } = await supabaseAdmin
      .from("sync_jobs").select("*").eq("id", data.jobId).single();
    if (error) throw new Error(error.message);
    return row;
  });

export const runFullSync = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ confirm: z.literal("SYNC NOW"), jobId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertSuperadmin(context.userId);
    const targetUrl = process.env.SYNC_TARGET_SUPABASE_URL;
    const serviceKey = process.env.SYNC_TARGET_SERVICE_ROLE_KEY;
    if (!targetUrl || !serviceKey) {
      throw new Error("SYNC_TARGET_SUPABASE_URL und SYNC_TARGET_SERVICE_ROLE_KEY müssen gesetzt sein.");
    }
    const jobId = data.jobId;
    const started = Date.now();
    const results: TableResult[] = [];
    const logs: LogLine[] = [];

    const persist = async (patch: Record<string, unknown>) => {
      try { await (supabaseAdmin as any).from("sync_jobs").update(patch).eq("id", jobId); } catch {}
    };
    const pushLog = async (level: LogLine["level"], msg: string, extra?: unknown) => {
      logs.push(logLine(level, msg, extra));
      await persist({ logs: logs as never });
    };

    const prep = await prepareTargetSync(targetUrl, serviceKey);
    for (const warning of prep.warnings) await pushLog("warn", warning);
    await reloadTargetSchemaCache(process.env.SYNC_TARGET_DB_URL, pushLog);

    let pending = [...SYNC_TABLES];
    const skippedKeysByTable = new Map<string, Set<string>>();
    try {
      for (let pass = 1; pass <= MAX_PASSES; pass++) {
        await pushLog("info", `Pass ${pass}/${MAX_PASSES} – ${pending.length} Tabellen`);
        const stillFailed: string[] = [];
        for (const table of pending) {
          let read = 0, written = 0, skipped = 0;
          let lastError: string | undefined;
          let lastErrorDetail: string | undefined;
          await persist({ current_table: table, current_pass: pass });
          const tStart = Date.now();
          try {
            const rows = await fetchAllRows(table);
            read = rows.length;
            await pushLog("info", `${table}: ${rows.length} Zeilen gelesen`);
            const transformed = transformRowsForTarget(table, rows, prep, skippedKeysByTable);
            skipped += transformed.skipped;
            if (transformed.skippedKeys.length > 0) {
              skippedKeysByTable.set(table, new Set(transformed.skippedKeys));
            }
            const compacted = compactWarnings(transformed.warnings);
            for (const warning of compacted.slice(0, 20)) await pushLog("warn", warning);
            if (compacted.length > 20) await pushLog("warn", `${table}: ${compacted.length - 20} weitere Überspring-Hinweise ausgeblendet`);

            for (let i = 0; i < transformed.rows.length; i += BATCH) {
              const slice = transformed.rows.slice(i, i + BATCH);
              const batch = await pushBatch(targetUrl, serviceKey, table, slice);
              written += batch.written;
              skipped += batch.skipped;
              if (batch.skippedKeys?.length) {
                const set = skippedKeysByTable.get(table) ?? new Set<string>();
                for (const key of batch.skippedKeys) set.add(key);
                skippedKeysByTable.set(table, set);
              }
              const batchWarnings = compactWarnings(batch.warnings);
              for (const warning of batchWarnings.slice(0, 20)) await pushLog("warn", warning);
              if (batchWarnings.length > 20) await pushLog("warn", `${table}: ${batchWarnings.length - 20} weitere Batch-Hinweise ausgeblendet`);
            }
            await pushLog("info", `${table}: ${written} Zeilen geschrieben${skipped ? `, ${skipped} übersprungen` : ""} (${Date.now() - tStart}ms)`);
          } catch (e) {
            const err = e as Error;
            lastError = err.message;
            lastErrorDetail = err.stack ?? err.message;
            await pushLog("error", `${table}: ${err.message}`, { stack: err.stack });
          }

          const existing = results.find((r) => r.table === table);
          if (existing) {
            existing.read = read; existing.written = written; existing.skipped = skipped;
            existing.error = lastError; existing.errorDetail = lastErrorDetail;
          } else {
            results.push({ table, read, written, skipped, error: lastError, errorDetail: lastErrorDetail });
          }
          if (lastError) stillFailed.push(table);

          await persist({
            tables: results as never,
            processed_tables: results.length,
            total_read: results.reduce((s, r) => s + r.read, 0),
            total_written: results.reduce((s, r) => s + r.written, 0),
            failed_count: results.filter((r) => r.error).length,
          });
        }
        pending = stillFailed;
        if (pending.length === 0) break;
      }
    } catch (e) {
      const err = e as Error;
      await pushLog("error", `Abbruch: ${err.message}`, { stack: err.stack });
      await persist({
        status: "error", finished_at: new Date().toISOString(),
        error: err.message, current_table: null,
      });
      throw err;
    }

    const totalRead = results.reduce((s, r) => s + r.read, 0);
    const totalWritten = results.reduce((s, r) => s + r.written, 0);
    const totalSkipped = results.reduce((s, r) => s + (r.skipped ?? 0), 0);
    const failed = results.filter((r) => r.error);
    const ok = failed.length === 0;
    await pushLog(
      ok ? "info" : "warn",
      ok ? `Fertig in ${Date.now() - started}ms – ${totalWritten} Zeilen geschrieben${totalSkipped ? `, ${totalSkipped} übersprungen` : ""}`
         : `Fertig mit ${failed.length} Fehler-Tabellen`,
    );
    await persist({
      status: ok ? "done" : "error",
      finished_at: new Date().toISOString(),
      current_table: null,
      processed_tables: results.length,
      total_read: totalRead, total_written: totalWritten,
      failed_count: failed.length, tables: results as never,
    });

    try {
      await supabaseAdmin.from("superadmin_audit_log").insert({
        actor_id: context.userId,
        actor_email: context.claims?.email ?? null,
        action: "db_sync_run",
        target_type: "database", target_id: null,
        target_label: targetUrl,
        metadata: {
          duration_ms: Date.now() - started,
          total_read: totalRead, total_written: totalWritten,
           total_skipped: totalSkipped,
          failed_tables: failed.map((f) => f.table),
          job_id: jobId,
        } as never,
      });
    } catch {}

    return { ok, durationMs: Date.now() - started, totalRead, totalWritten, totalSkipped,
      tables: results, failedCount: failed.length, jobId };
  });

// ============================================================
// Schema-Migration: führt supabase/migrations/*.sql gegen Ziel-DB aus
// ============================================================

// Migrations werden zum Build-Zeitpunkt eingebettet.
const MIGRATION_MODULES = import.meta.glob("/supabase/migrations/*.sql", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

function loadMigrations(): { name: string; sql: string }[] {
  return Object.entries(MIGRATION_MODULES)
    .map(([path, sql]) => ({ name: path.split("/").pop() as string, sql }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export const startSchemaMigrationJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperadmin(context.userId);
    const dbUrl = process.env.SYNC_TARGET_DB_URL;
    if (!dbUrl) throw new Error("SYNC_TARGET_DB_URL ist nicht gesetzt.");
    const files = loadMigrations();
    const { data, error } = await supabaseAdmin
      .from("sync_jobs")
      .insert({
        started_by: context.userId,
        status: "running",
        target_url: process.env.SYNC_TARGET_SUPABASE_URL ?? "(db-url)",
        total_tables: files.length,
        logs: [logLine("info", `Schema-Migration gestartet – ${files.length} Dateien`)] as never,
      })
      .select("id").single();
    if (error) throw new Error(`sync_jobs insert: ${error.message}`);
    return { jobId: (data as { id: string }).id, total: files.length };
  });

// Halb-automatisch: liefert alle Migrations als ein gebündeltes, idempotentes SQL-Skript zurück.
export const exportMigrationsSql = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperadmin(context.userId);
    const files = loadMigrations();
    const header = [
      `-- Lovable DB-Sync · Schema-Export`,
      `-- Generiert: ${new Date().toISOString()}`,
      `-- Anzahl Migrations-Dateien: ${files.length}`,
      `-- Anwendung: im SQL-Editor der Ziel-Instanz einfügen und ausführen.`,
      `-- Bereits angewendete Migrations werden via public._lovable_migrations übersprungen.`,
      ``,
      `CREATE TABLE IF NOT EXISTS public._lovable_migrations (`,
      `  name text PRIMARY KEY,`,
      `  applied_at timestamptz NOT NULL DEFAULT now(),`,
      `  duration_ms integer,`,
      `  checksum text`,
      `);`,
      ``,
    ].join("\n");

    const parts: string[] = [header];
    for (const f of files) {
      const nameLit = pgQuote(f.name);
      parts.push(
        `\n-- ============================================================`,
        `-- Migration: ${f.name}`,
        `-- ============================================================`,
        `DO $LVBL_OUTER$`,
        `BEGIN`,
        `  IF EXISTS (SELECT 1 FROM public._lovable_migrations WHERE name = ${nameLit}) THEN`,
        `    RAISE NOTICE '↷ skip %', ${nameLit};`,
        `  ELSE`,
        `    BEGIN`,
        `      EXECUTE $LVBL_BODY$`,
        f.sql.trimEnd(),
        `      $LVBL_BODY$;`,
        `      INSERT INTO public._lovable_migrations(name) VALUES (${nameLit}) ON CONFLICT (name) DO NOTHING;`,
        `      RAISE NOTICE '✓ applied %', ${nameLit};`,
        `    EXCEPTION WHEN OTHERS THEN`,
        `      INSERT INTO public._lovable_migrations(name) VALUES (${nameLit}) ON CONFLICT (name) DO NOTHING;`,
        `      RAISE NOTICE '≈ % skipped (% / %) – marked applied', ${nameLit}, SQLSTATE, SQLERRM;`,
        `    END;`,
        `  END IF;`,
        `END`,
        `$LVBL_OUTER$;`,
      );
    }
    return { filename: `lovable-migrations-${new Date().toISOString().slice(0,19).replace(/[:T]/g,"-")}.sql`, sql: parts.join("\n"), count: files.length };
  });

function pgQuote(s: string): string {
  return `'${s.replace(/'/g, "''")}'`;
}

// ============================================================
// Struktur-Abgleich: vergleicht Tabellen/Spalten Quelle ↔ Ziel
// und legt Fehlendes im Ziel an (KEINE Datenübertragung).
// ============================================================

type ColumnInfo = {
  table_name: string;
  column_name: string;
  data_type: string;          // information_schema.data_type (z. B. 'text', 'USER-DEFINED')
  udt_name: string;           // z. B. 'uuid', 'app_role', 'int4'
  is_nullable: "YES" | "NO";
  column_default: string | null;
  character_maximum_length: number | null;
  numeric_precision: number | null;
  numeric_scale: number | null;
};

type SchemaDiff = {
  missingTables: string[];              // Tabellen, die im Ziel komplett fehlen
  extraTables: string[];                // Tabellen, die nur im Ziel existieren
  missingColumns: { table: string; column: string; ddl: string }[];
  extraColumns: { table: string; column: string }[];
};

function pgIdent(s: string): string {
  return `"${s.replace(/"/g, '""')}"`;
}

function buildColumnType(col: ColumnInfo): string {
  // Für 'USER-DEFINED' (Enums, custom types) den udt_name direkt verwenden.
  if (col.data_type === "USER-DEFINED") return pgIdent(col.udt_name);
  if (col.data_type === "ARRAY") return `${col.udt_name.replace(/^_/, "")}[]`;
  if (col.data_type === "character varying" && col.character_maximum_length) {
    return `varchar(${col.character_maximum_length})`;
  }
  if (col.data_type === "numeric" && col.numeric_precision) {
    return col.numeric_scale != null
      ? `numeric(${col.numeric_precision},${col.numeric_scale})`
      : `numeric(${col.numeric_precision})`;
  }
  // information_schema.data_type liefert kanonische Namen wie 'timestamp with time zone'
  return col.data_type;
}

function buildAddColumnDdl(col: ColumnInfo): string {
  const type = buildColumnType(col);
  const parts = [`ADD COLUMN IF NOT EXISTS ${pgIdent(col.column_name)} ${type}`];
  if (col.column_default != null) parts.push(`DEFAULT ${col.column_default}`);
  // NOT NULL nur setzen, wenn ein Default existiert (sonst schlägt es bei bestehenden Zeilen fehl).
  if (col.is_nullable === "NO" && col.column_default != null) parts.push(`NOT NULL`);
  return parts.join(" ");
}

function buildCreateTableDdl(table: string, cols: ColumnInfo[]): string {
  const colDefs = cols.map((c) => {
    const type = buildColumnType(c);
    const bits = [`${pgIdent(c.column_name)} ${type}`];
    if (c.column_default != null) bits.push(`DEFAULT ${c.column_default}`);
    if (c.is_nullable === "NO") bits.push(`NOT NULL`);
    return `  ${bits.join(" ")}`;
  });
  return `CREATE TABLE IF NOT EXISTS public.${pgIdent(table)} (\n${colDefs.join(",\n")}\n);`;
}

async function readSchemaColumns(dbUrl: string): Promise<ColumnInfo[]> {
  const { default: postgres } = await import("postgres");
  const sql = postgres(dbUrl, { ssl: "require", max: 1, idle_timeout: 5, connect_timeout: 15, prepare: false });
  try {
    const rows = await sql<ColumnInfo[]>`
      SELECT
        table_name,
        column_name,
        data_type,
        udt_name,
        is_nullable,
        column_default,
        character_maximum_length,
        numeric_precision,
        numeric_scale
      FROM information_schema.columns
      WHERE table_schema = 'public'
      ORDER BY table_name, ordinal_position
    `;
    return rows.map((r) => ({ ...r }));
  } finally {
    try { await sql.end({ timeout: 5 }); } catch {}
  }
}

function computeSchemaDiff(source: ColumnInfo[], target: ColumnInfo[]): SchemaDiff {
  const bySrcTable = new Map<string, ColumnInfo[]>();
  for (const c of source) {
    const list = bySrcTable.get(c.table_name) ?? [];
    list.push(c); bySrcTable.set(c.table_name, list);
  }
  const byTgtTable = new Map<string, ColumnInfo[]>();
  for (const c of target) {
    const list = byTgtTable.get(c.table_name) ?? [];
    list.push(c); byTgtTable.set(c.table_name, list);
  }

  const missingTables: string[] = [];
  const extraTables: string[] = [];
  const missingColumns: SchemaDiff["missingColumns"] = [];
  const extraColumns: SchemaDiff["extraColumns"] = [];

  for (const [table, cols] of bySrcTable) {
    if (!byTgtTable.has(table)) {
      missingTables.push(table);
      continue;
    }
    const tgtCols = new Set(byTgtTable.get(table)!.map((c) => c.column_name));
    for (const col of cols) {
      if (!tgtCols.has(col.column_name)) {
        missingColumns.push({
          table,
          column: col.column_name,
          ddl: `ALTER TABLE public.${pgIdent(table)} ${buildAddColumnDdl(col)};`,
        });
      }
    }
  }
  for (const [table, cols] of byTgtTable) {
    if (!bySrcTable.has(table)) {
      extraTables.push(table);
      continue;
    }
    const srcCols = new Set(bySrcTable.get(table)!.map((c) => c.column_name));
    for (const col of cols) {
      if (!srcCols.has(col.column_name)) extraColumns.push({ table, column: col.column_name });
    }
  }

  missingTables.sort();
  extraTables.sort();
  missingColumns.sort((a, b) => (a.table + a.column).localeCompare(b.table + b.column));
  return { missingTables, extraTables, missingColumns, extraColumns };
}

export const previewSchemaDiff = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperadmin(context.userId);
    const sourceUrl = process.env.SUPABASE_DB_URL;
    const targetUrl = process.env.SYNC_TARGET_DB_URL;
    if (!sourceUrl || !targetUrl) {
      return {
        configured: false as const,
        message: "SUPABASE_DB_URL und SYNC_TARGET_DB_URL müssen gesetzt sein.",
      };
    }
    try {
      const [source, target] = await Promise.all([
        readSchemaColumns(sourceUrl),
        readSchemaColumns(targetUrl),
      ]);
      const diff = computeSchemaDiff(source, target);
      return {
        configured: true as const,
        sourceTables: new Set(source.map((c) => c.table_name)).size,
        targetTables: new Set(target.map((c) => c.table_name)).size,
        diff,
      };
    } catch (e) {
      return { configured: true as const, error: (e as Error).message };
    }
  });

export const applySchemaDiff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ confirm: z.literal("STRUCTURE ONLY"), jobId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertSuperadmin(context.userId);
    const sourceUrl = process.env.SUPABASE_DB_URL;
    const targetUrl = process.env.SYNC_TARGET_DB_URL;
    if (!sourceUrl || !targetUrl) {
      throw new Error("SUPABASE_DB_URL und SYNC_TARGET_DB_URL müssen gesetzt sein.");
    }
    const jobId = data.jobId;
    const started = Date.now();
    const logs: LogLine[] = [];
    const persist = async (patch: Record<string, unknown>) => {
      try { await (supabaseAdmin as any).from("sync_jobs").update(patch).eq("id", jobId); } catch {}
    };
    const pushLog = async (level: LogLine["level"], msg: string, extra?: unknown) => {
      logs.push(logLine(level, msg, extra));
      await persist({ logs: logs as never });
    };

    await pushLog("info", "Struktur-Abgleich gestartet (keine Daten werden übertragen)");

    const [source, target] = await Promise.all([
      readSchemaColumns(sourceUrl),
      readSchemaColumns(targetUrl),
    ]);
    const diff = computeSchemaDiff(source, target);

    await pushLog("info", `${diff.missingTables.length} fehlende Tabellen, ${diff.missingColumns.length} fehlende Spalten`);
    if (diff.extraTables.length) await pushLog("warn", `Nur im Ziel: ${diff.extraTables.length} Tabelle(n) – werden nicht angefasst`);
    if (diff.extraColumns.length) await pushLog("warn", `Nur im Ziel: ${diff.extraColumns.length} Spalte(n) – werden nicht angefasst`);

    // Statements aufbauen
    const bySrcTable = new Map<string, ColumnInfo[]>();
    for (const c of source) {
      const list = bySrcTable.get(c.table_name) ?? [];
      list.push(c); bySrcTable.set(c.table_name, list);
    }
    const statements: { label: string; sql: string }[] = [];
    for (const t of diff.missingTables) {
      statements.push({ label: `CREATE TABLE public.${t}`, sql: buildCreateTableDdl(t, bySrcTable.get(t) ?? []) });
      statements.push({
        label: `GRANT public.${t}`,
        sql: `GRANT SELECT, INSERT, UPDATE, DELETE ON public.${pgIdent(t)} TO authenticated; GRANT ALL ON public.${pgIdent(t)} TO service_role;`,
      });
      statements.push({
        label: `RLS public.${t}`,
        sql: `ALTER TABLE public.${pgIdent(t)} ENABLE ROW LEVEL SECURITY;`,
      });
    }
    for (const c of diff.missingColumns) {
      statements.push({ label: `ADD COLUMN ${c.table}.${c.column}`, sql: c.ddl });
    }

    if (statements.length === 0) {
      await pushLog("info", "Ziel-Schema ist bereits auf dem Stand der Quelle.");
      await persist({
        status: "done",
        finished_at: new Date().toISOString(),
        current_table: null,
        total_tables: 0,
        processed_tables: 0,
      });
      return { ok: true, applied: 0, failed: 0, diff, jobId, durationMs: Date.now() - started };
    }

    await persist({ total_tables: statements.length, processed_tables: 0 });

    const { default: postgres } = await import("postgres");
    const sql = postgres(targetUrl, { ssl: "require", max: 1, idle_timeout: 10, connect_timeout: 15, prepare: false });
    let applied = 0;
    let failed = 0;
    const failures: { label: string; error: string }[] = [];
    try {
      for (const stmt of statements) {
        try {
          await sql.unsafe(stmt.sql);
          applied++;
          await pushLog("info", `✓ ${stmt.label}`);
        } catch (e) {
          failed++;
          const msg = (e as Error).message;
          failures.push({ label: stmt.label, error: msg });
          await pushLog("error", `✗ ${stmt.label}: ${msg}`);
        }
        await persist({ processed_tables: applied + failed, current_table: stmt.label });
      }
      try { await sql.unsafe("NOTIFY pgrst, 'reload schema'"); } catch {}
    } finally {
      try { await sql.end({ timeout: 5 }); } catch {}
    }

    await pushLog(
      failed === 0 ? "info" : "warn",
      `Fertig in ${Date.now() - started}ms – ${applied} angewandt, ${failed} fehlgeschlagen`,
    );
    await persist({
      status: failed === 0 ? "done" : "error",
      finished_at: new Date().toISOString(),
      current_table: null,
      failed_count: failed,
    });

    try {
      await supabaseAdmin.from("superadmin_audit_log").insert({
        actor_id: context.userId,
        actor_email: context.claims?.email ?? null,
        action: "db_schema_diff_apply",
        target_type: "database",
        target_id: null,
        target_label: process.env.SYNC_TARGET_SUPABASE_URL ?? "(db-url)",
        metadata: {
          duration_ms: Date.now() - started,
          applied, failed, failures,
          missing_tables: diff.missingTables,
          missing_columns: diff.missingColumns.map((c) => `${c.table}.${c.column}`),
          job_id: jobId,
        } as never,
      });
    } catch {}

    return { ok: failed === 0, applied, failed, failures, diff, jobId, durationMs: Date.now() - started };
  });

export const startSchemaDiffJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperadmin(context.userId);
    const { data, error } = await supabaseAdmin
      .from("sync_jobs")
      .insert({
        started_by: context.userId,
        status: "running",
        target_url: process.env.SYNC_TARGET_SUPABASE_URL ?? "(db-url)",
        total_tables: 0,
        logs: [logLine("info", "Struktur-Abgleich gestartet")] as never,
      })
      .select("id").single();
    if (error) throw new Error(`sync_jobs insert: ${error.message}`);
    return { jobId: (data as { id: string }).id };
  });

export const exportFullBootstrapSql = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        email: z.string().email().max(255),
        password: z.string().min(4).max(128),
        displayName: z.string().min(1).max(120).optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertSuperadmin(context.userId);
    const files = loadMigrations();

    const header = [
      `-- Lovable DB-Bootstrap · Schema + Superadmin`,
      `-- Generiert: ${new Date().toISOString()}`,
      `-- Anzahl Migrations-Dateien: ${files.length}`,
      `-- Anwendung: in der frischen Ziel-DB im SQL-Editor einfügen und ausführen.`,
      `-- Bereits angewendete Migrations werden via public._lovable_migrations übersprungen.`,
      ``,
      `CREATE EXTENSION IF NOT EXISTS pgcrypto;`,
      ``,
      `CREATE TABLE IF NOT EXISTS public._lovable_migrations (`,
      `  name text PRIMARY KEY,`,
      `  applied_at timestamptz NOT NULL DEFAULT now(),`,
      `  duration_ms integer,`,
      `  checksum text`,
      `);`,
      ``,
    ].join("\n");

    const parts: string[] = [header];
    for (const f of files) {
      const nameLit = pgQuote(f.name);
      parts.push(
        `\n-- ============================================================`,
        `-- Migration: ${f.name}`,
        `-- ============================================================`,
        `DO $LVBL_OUTER$`,
        `BEGIN`,
        `  IF EXISTS (SELECT 1 FROM public._lovable_migrations WHERE name = ${nameLit}) THEN`,
        `    RAISE NOTICE '↷ skip %', ${nameLit};`,
        `  ELSE`,
        `    BEGIN`,
        `      EXECUTE $LVBL_BODY$`,
        f.sql.trimEnd(),
        `      $LVBL_BODY$;`,
        `      INSERT INTO public._lovable_migrations(name) VALUES (${nameLit}) ON CONFLICT (name) DO NOTHING;`,
        `      RAISE NOTICE '✓ applied %', ${nameLit};`,
        `    EXCEPTION WHEN OTHERS THEN`,
        `      INSERT INTO public._lovable_migrations(name) VALUES (${nameLit}) ON CONFLICT (name) DO NOTHING;`,
        `      RAISE NOTICE '≈ % skipped (% / %) – marked applied', ${nameLit}, SQLSTATE, SQLERRM;`,
        `    END;`,
        `  END IF;`,
        `END`,
        `$LVBL_OUTER$;`,
      );
    }

    const emailLit = pgQuote(data.email);
    const pwLit = pgQuote(data.password);
    const nameLit = pgQuote(data.displayName ?? "SuperAdmin");

    parts.push(
      ``,
      `-- ============================================================`,
      `-- Superadmin-Account anlegen / Passwort zurücksetzen`,
      `-- ============================================================`,
      `ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS domain_id UUID;`,
      `NOTIFY pgrst, 'reload schema';`,
      ``,
      `DO $LVBL_SA$`,
      `DECLARE`,
      `  v_email    TEXT := ${emailLit};`,
      `  v_password TEXT := ${pwLit};`,
      `  v_name     TEXT := ${nameLit};`,
      `  v_user_id  UUID;`,
      `BEGIN`,
      `  SELECT id INTO v_user_id FROM auth.users WHERE email = v_email;`,
      ``,
      `  IF v_user_id IS NULL THEN`,
      `    v_user_id := gen_random_uuid();`,
      `    INSERT INTO auth.users (`,
      `      instance_id, id, aud, role, email, encrypted_password,`,
      `      email_confirmed_at, created_at, updated_at,`,
      `      raw_app_meta_data, raw_user_meta_data, is_super_admin`,
      `    ) VALUES (`,
      `      '00000000-0000-0000-0000-000000000000',`,
      `      v_user_id, 'authenticated', 'authenticated', v_email,`,
      `      crypt(v_password, gen_salt('bf')),`,
      `      now(), now(), now(),`,
      `      jsonb_build_object('provider','email','providers',ARRAY['email']),`,
      `      jsonb_build_object('display_name', v_name),`,
      `      false`,
      `    );`,
      `    INSERT INTO auth.identities (`,
      `      id, user_id, provider_id, identity_data, provider,`,
      `      last_sign_in_at, created_at, updated_at`,
      `    ) VALUES (`,
      `      gen_random_uuid(), v_user_id, v_user_id::text,`,
      `      jsonb_build_object('sub', v_user_id::text, 'email', v_email),`,
      `      'email', now(), now(), now()`,
      `    );`,
      `  ELSE`,
      `    UPDATE auth.users`,
      `       SET encrypted_password = crypt(v_password, gen_salt('bf')),`,
      `           email_confirmed_at = COALESCE(email_confirmed_at, now()),`,
      `           updated_at         = now()`,
      `     WHERE id = v_user_id;`,
      `  END IF;`,
      ``,
      `  INSERT INTO public.profiles (id, display_name)`,
      `  VALUES (v_user_id, v_name)`,
      `  ON CONFLICT (id) DO NOTHING;`,
      ``,
      `  -- EXECUTE umgeht das "unsafe use of new enum value"-Problem,`,
      `  -- falls der Enum-Wert 'superadmin' erst in dieser Sitzung erzeugt wurde.`,
      `  EXECUTE format(`,
      `    'INSERT INTO public.user_roles (user_id, role, domain_id) VALUES (%L, %L::public.app_role, NULL) ON CONFLICT (user_id, role) DO NOTHING',`,
      `    v_user_id, 'superadmin'`,
      `  );`,
      `END`,
      `$LVBL_SA$;`,
      ``,
      `NOTIFY pgrst, 'reload schema';`,
    );

    return {
      filename: `lovable-bootstrap-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.sql`,
      sql: parts.join("\n"),
      count: files.length,
      email: data.email,
    };
  });

export const runSchemaMigration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ confirm: z.literal("MIGRATE NOW"), jobId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertSuperadmin(context.userId);
    const dbUrl = process.env.SYNC_TARGET_DB_URL;
    if (!dbUrl) throw new Error("SYNC_TARGET_DB_URL ist nicht gesetzt.");
    const { default: postgres } = await import("postgres");

    const jobId = data.jobId;
    const started = Date.now();
    const files = loadMigrations();
    const logs: LogLine[] = [];
    const tables: TableResult[] = [];

    const persist = async (patch: Record<string, unknown>) => {
      try { await (supabaseAdmin as any).from("sync_jobs").update(patch).eq("id", jobId); } catch {}
    };
    const pushLog = async (level: LogLine["level"], msg: string, extra?: unknown) => {
      logs.push(logLine(level, msg, extra));
      await persist({ logs: logs as never });
    };

    let sql: ReturnType<typeof postgres> | null = null;
    try {
      sql = postgres(dbUrl, {
        ssl: "require",
        max: 1,
        idle_timeout: 5,
        connect_timeout: 15,
        prepare: false,
      });

      await pushLog("info", "Verbindung zur Ziel-DB hergestellt");

      // Tracking-Tabelle anlegen (idempotent)
      await sql.unsafe(`
        CREATE TABLE IF NOT EXISTS public._lovable_migrations (
          name text PRIMARY KEY,
          applied_at timestamptz NOT NULL DEFAULT now(),
          duration_ms integer,
          checksum text
        );
      `);
      await pushLog("info", "Tracking-Tabelle _lovable_migrations bereit");

      const appliedRows = await sql<{ name: string }[]>`SELECT name FROM public._lovable_migrations`;
      const applied = new Set(appliedRows.map((r) => r.name));
      await pushLog("info", `${applied.size} Migrationen bereits angewendet, ${files.length - applied.size} ausstehend`);

      let processed = 0;
      let success = 0;
      let skipped = 0;
      let failed = 0;

      for (const file of files) {
        await persist({ current_table: file.name, current_pass: 1 });
        const t = Date.now();

        if (applied.has(file.name)) {
          skipped++;
          processed++;
          tables.push({ table: file.name, read: 0, written: 0 });
          await pushLog("info", `↷ ${file.name} – bereits angewendet`);
          await persist({
            tables: tables as never,
            processed_tables: processed,
            failed_count: failed,
          });
          continue;
        }

        let lastErr: string | undefined;
        let lastErrDetail: string | undefined;
        try {
          await sql.begin(async (tx) => {
            await tx.unsafe(file.sql);
            await tx`
              INSERT INTO public._lovable_migrations (name, duration_ms)
              VALUES (${file.name}, ${Date.now() - t})
              ON CONFLICT (name) DO NOTHING
            `;
          });
          success++;
          await pushLog("info", `✓ ${file.name} (${Date.now() - t}ms)`);
        } catch (e) {
          const err = e as Error & { code?: string; detail?: string; hint?: string; position?: string };
          // "already exists" o.ä.: als angewendet markieren, damit weitere Migrationen darauf aufbauen können
          const msg = err.message ?? String(err);
          const benign = /already exists|duplicate object|duplicate_object|42P07|42710|42701/i.test(
            `${msg} ${err.code ?? ""}`,
          );
          if (benign) {
            try {
              await sql`
                INSERT INTO public._lovable_migrations (name, duration_ms)
                VALUES (${file.name}, ${Date.now() - t})
                ON CONFLICT (name) DO NOTHING
              `;
              skipped++;
              await pushLog("warn", `≈ ${file.name} – Objekte bereits vorhanden, als angewendet markiert`, {
                code: err.code, message: msg.slice(0, 400),
              });
            } catch (markErr) {
              failed++;
              lastErr = msg;
              lastErrDetail = `${err.code ?? ""} ${msg}\n${err.detail ?? ""}\n${err.hint ?? ""}\n${(markErr as Error).message}`;
              await pushLog("error", `✗ ${file.name} – Markierung fehlgeschlagen`, { stack: lastErrDetail });
            }
          } else {
            failed++;
            lastErr = msg;
            lastErrDetail = [
              `code: ${err.code ?? "?"}`,
              `position: ${err.position ?? "?"}`,
              `detail: ${err.detail ?? ""}`,
              `hint: ${err.hint ?? ""}`,
              `message: ${msg}`,
              `stack: ${err.stack ?? ""}`,
            ].join("\n");
            await pushLog("error", `✗ ${file.name}: ${msg}`, { stack: lastErrDetail });
          }
        }

        processed++;
        tables.push({
          table: file.name,
          read: 0,
          written: lastErr ? 0 : 1,
          error: lastErr,
          errorDetail: lastErrDetail,
        });
        await persist({
          tables: tables as never,
          processed_tables: processed,
          failed_count: failed,
        });
      }

      await pushLog(
        failed === 0 ? "info" : "warn",
        `Fertig: ${success} ausgeführt, ${skipped} übersprungen, ${failed} Fehler`,
      );
      await persist({
        status: failed === 0 ? "done" : "error",
        finished_at: new Date().toISOString(),
        current_table: null,
        processed_tables: processed,
        failed_count: failed,
      });

      try {
        await supabaseAdmin.from("superadmin_audit_log").insert({
          actor_id: context.userId,
          actor_email: context.claims?.email ?? null,
          action: "schema_migrate",
          target_type: "database",
          target_id: null,
          target_label: process.env.SYNC_TARGET_SUPABASE_URL ?? null,
          metadata: {
            duration_ms: Date.now() - started,
            total: files.length,
            success, skipped, failed,
            job_id: jobId,
          } as never,
        });
      } catch {}

      return { ok: failed === 0, total: files.length, success, skipped, failed, jobId };
    } catch (e) {
      const err = e as Error;
      await pushLog("error", `Abbruch: ${err.message}`, { stack: err.stack });
      await persist({
        status: "error",
        finished_at: new Date().toISOString(),
        error: err.message,
        current_table: null,
      });
      throw err;
    } finally {
      try { if (sql) await sql.end({ timeout: 5 }); } catch {}
    }
  });

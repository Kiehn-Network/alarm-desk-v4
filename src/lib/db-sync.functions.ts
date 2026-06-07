import { createServerFn } from "@tanstack/react-start";
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
  error?: string;
  errorDetail?: string;
};

type LogLine = { t: string; level: "info" | "warn" | "error"; msg: string; extra?: unknown };

function logLine(level: LogLine["level"], msg: string, extra?: unknown): LogLine {
  return { t: new Date().toISOString(), level, msg, ...(extra !== undefined ? { extra } : {}) };
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
): Promise<number> {
  if (rows.length === 0) return 0;
  const res = await fetch(`${targetUrl}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(rows),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status} ${res.statusText} – ${text.slice(0, 1500)}`);
  }
  return rows.length;
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

    let pending = [...SYNC_TABLES];
    try {
      for (let pass = 1; pass <= MAX_PASSES; pass++) {
        await pushLog("info", `Pass ${pass}/${MAX_PASSES} – ${pending.length} Tabellen`);
        const stillFailed: string[] = [];
        for (const table of pending) {
          let read = 0, written = 0;
          let lastError: string | undefined;
          let lastErrorDetail: string | undefined;
          await persist({ current_table: table, current_pass: pass });
          const tStart = Date.now();
          try {
            const rows = await fetchAllRows(table);
            read = rows.length;
            await pushLog("info", `${table}: ${rows.length} Zeilen gelesen`);
            for (let i = 0; i < rows.length; i += BATCH) {
              const slice = rows.slice(i, i + BATCH);
              written += await pushBatch(targetUrl, serviceKey, table, slice);
            }
            await pushLog("info", `${table}: ${written} Zeilen geschrieben (${Date.now() - tStart}ms)`);
          } catch (e) {
            const err = e as Error;
            lastError = err.message;
            lastErrorDetail = err.stack ?? err.message;
            await pushLog("error", `${table}: ${err.message}`, { stack: err.stack });
          }

          const existing = results.find((r) => r.table === table);
          if (existing) {
            existing.read = read; existing.written = written;
            existing.error = lastError; existing.errorDetail = lastErrorDetail;
          } else {
            results.push({ table, read, written, error: lastError, errorDetail: lastErrorDetail });
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
    const failed = results.filter((r) => r.error);
    const ok = failed.length === 0;
    await pushLog(
      ok ? "info" : "warn",
      ok ? `Fertig in ${Date.now() - started}ms – ${totalWritten} Zeilen geschrieben`
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
          failed_tables: failed.map((f) => f.table),
          job_id: jobId,
        } as never,
      });
    } catch {}

    return { ok, durationMs: Date.now() - started, totalRead, totalWritten,
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
      parts.push(
        `\n-- ============================================================`,
        `-- Migration: ${f.name}`,
        `-- ============================================================`,
        `DO $LOVABLE_MIG$`,
        `BEGIN`,
        `  IF EXISTS (SELECT 1 FROM public._lovable_migrations WHERE name = ${pgQuote(f.name)}) THEN`,
        `    RAISE NOTICE 'skip %', ${pgQuote(f.name)};`,
        `  ELSE`,
        `    BEGIN`,
        `      -- >>> begin original migration`,
        f.sql,
        `      -- <<< end original migration`,
        `      INSERT INTO public._lovable_migrations (name) VALUES (${pgQuote(f.name)})`,
        `        ON CONFLICT (name) DO NOTHING;`,
        `    EXCEPTION WHEN duplicate_table OR duplicate_object OR duplicate_column OR duplicate_function THEN`,
        `      INSERT INTO public._lovable_migrations (name) VALUES (${pgQuote(f.name)})`,
        `        ON CONFLICT (name) DO NOTHING;`,
        `      RAISE NOTICE 'objects already exist for %, marked applied', ${pgQuote(f.name)};`,
        `    END;`,
        `  END IF;`,
        `END`,
        `$LOVABLE_MIG$;`,
      );
    }
    return { filename: `lovable-migrations-${new Date().toISOString().slice(0,19).replace(/[:T]/g,"-")}.sql`, sql: parts.join("\n"), count: files.length };
  });

function pgQuote(s: string): string {
  return `'${s.replace(/'/g, "''")}'`;
}

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

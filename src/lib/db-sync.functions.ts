import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Reihenfolge wichtig: zuerst Tabellen ohne FK auf andere public-Tabellen,
// dann abhängige. Mehrere Pässe gleichen verbleibende Reihenfolgeprobleme aus.
const SYNC_TABLES: string[] = [
  // Stammdaten
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
  // Nutzer/Rollen
  "profiles",
  "user_roles",
  "user_tour_settings",
  // Mitarbeiter Notdienste
  "budeko_mitarbeiter",
  "rohrservice_mitarbeiter",
  // Kerndaten
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
  // Chat
  "chat_conversations",
  "chat_participants",
  "chat_messages",
  // OWKS Revier-Center
  "owks_objekte",
  "owks_bestreifungsplaene",
  "owks_kontrollpunkte",
  "owks_rundgaenge",
  "owks_bestreifungen",
  "owks_durchgaenge",
  "owks_ereignisse",
  "owks_scans",
  // Notdienst Budeko
  "budeko_notdienst",
  "budeko_berichte",
  "budeko_notiz_dateien",
  // Notdienst Rohrservice
  "rohrservice_notdienst",
  "rohrservice_berichte",
  "rohrservice_notiz_dateien",
  // Support / ERP / Admin
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
};

async function fetchAllRows(table: string): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = [];
  let from = 0;
  // große Pages – supabase erlaubt bis 1000
  const pageSize = 1000;
  while (true) {
    const { data, error } = await (supabaseAdmin as any)
      .from(table)
      .select("*")
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    if (!data || data.length === 0) break;
    out.push(...(data as Record<string, unknown>[]));
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return out;
}

async function pushBatch(
  targetUrl: string,
  serviceKey: string,
  table: string,
  rows: Record<string, unknown>[],
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
    throw new Error(`${res.status}: ${text.slice(0, 400)}`);
  }
  return rows.length;
}

export const previewSyncTarget = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: role } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "superadmin")
      .maybeSingle();
    if (!role) throw new Error("Nur SuperAdmin");

    const targetUrl = process.env.SYNC_TARGET_SUPABASE_URL;
    const serviceKey = process.env.SYNC_TARGET_SERVICE_ROLE_KEY;
    if (!targetUrl || !serviceKey) {
      return {
        configured: false as const,
        message: "Sync-Secrets nicht gesetzt",
      };
    }

    // Quelle: aktuelle URL aus client.server env
    const sourceUrl = process.env.SUPABASE_URL ?? null;

    // Test: einen Ping zum Ziel
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
      sourceUrl,
      targetUrl,
      targetReachable,
      targetError,
      tables: SYNC_TABLES,
    };
  });

export const runFullSync = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        confirm: z.literal("SYNC NOW"),
      })
      .parse(d),
  )
  .handler(async ({ context }) => {
    const { data: role } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "superadmin")
      .maybeSingle();
    if (!role) throw new Error("Nur SuperAdmin");

    const targetUrl = process.env.SYNC_TARGET_SUPABASE_URL;
    const serviceKey = process.env.SYNC_TARGET_SERVICE_ROLE_KEY;
    if (!targetUrl || !serviceKey) {
      throw new Error(
        "SYNC_TARGET_SUPABASE_URL und SYNC_TARGET_SERVICE_ROLE_KEY müssen gesetzt sein.",
      );
    }

    const started = Date.now();
    const results: TableResult[] = [];
    // Tabellen, die noch erneut versucht werden müssen (FK-Reihenfolge)
    let pending = [...SYNC_TABLES];

    for (let pass = 1; pass <= MAX_PASSES; pass++) {
      const stillFailed: string[] = [];
      for (const table of pending) {
        let read = 0;
        let written = 0;
        let lastError: string | undefined;
        try {
          const rows = await fetchAllRows(table);
          read = rows.length;
          for (let i = 0; i < rows.length; i += BATCH) {
            const slice = rows.slice(i, i + BATCH);
            written += await pushBatch(targetUrl, serviceKey, table, slice);
          }
        } catch (e) {
          lastError = (e as Error).message;
        }

        if (pass === 1) {
          results.push({ table, read, written, error: lastError });
        } else {
          // bestehenden Eintrag updaten
          const existing = results.find((r) => r.table === table);
          if (existing) {
            existing.read = read;
            existing.written = written;
            existing.error = lastError;
          } else {
            results.push({ table, read, written, error: lastError });
          }
        }

        if (lastError) stillFailed.push(table);
      }
      pending = stillFailed;
      if (pending.length === 0) break;
    }

    const totalRead = results.reduce((s, r) => s + r.read, 0);
    const totalWritten = results.reduce((s, r) => s + r.written, 0);
    const failed = results.filter((r) => r.error);

    try {
      await supabaseAdmin.from("superadmin_audit_log").insert({
        actor_id: context.userId,
        actor_email: context.claims?.email ?? null,
        action: "db_sync_run",
        target_type: "database",
        target_id: null,
        target_label: targetUrl,
        metadata: {
          duration_ms: Date.now() - started,
          total_read: totalRead,
          total_written: totalWritten,
          failed_tables: failed.map((f) => f.table),
        } as never,
      });
    } catch {
      // audit failure soll Sync nicht verhindern
    }

    return {
      ok: failed.length === 0,
      durationMs: Date.now() - started,
      totalRead,
      totalWritten,
      tables: results,
      failedCount: failed.length,
    };
  });
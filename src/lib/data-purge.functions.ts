import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireEffectiveDomainId } from "@/lib/tenant.server";

// Whitelist der Tabellen, die per Tabellen-Purge (Superadmin → Admin-Bestätigung) hart
// gelöscht werden dürfen. Alle Tabellen haben eine `domain_id`-Spalte.
export const PURGEABLE_TABLES = [
  "einsaetze",
  "einsatz_historie",
  "dateien",
  "budeko_berichte",
  "budeko_notdienst",
  "budeko_mitarbeiter",
  "rohrservice_berichte",
  "rohrservice_notdienst",
  "rohrservice_mitarbeiter",
  "owks_ereignisse",
  "owks_scans",
  "owks_durchgaenge",
  "owks_rundgaenge",
  "owks_bestreifungen",
  "owks_bestreifungsplaene",
  "owks_kontrollpunkte",
  "owks_objekte",
  "schluessel_buch",
  "schluesseluebergabe_protokolle",
  "chat_messages",
  "intrahub_posts",
  "dienstplaene",
  "auswertung_pins",
  "driver_locations",
] as const;
export type PurgeableTable = (typeof PURGEABLE_TABLES)[number];
const PURGEABLE_TABLE_SET = new Set<string>(PURGEABLE_TABLES as readonly string[]);

// Domain-Admin: stellt einen Antrag, alle Dateien seiner Domäne zu löschen
export const requestDataPurge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ note: z.string().max(1000).optional().nullable() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const domainId = await requireEffectiveDomainId(supabase, userId);
    // Nur ein offener Antrag gleichzeitig pro Domäne
    const { data: existing } = await supabase
      .from("data_purge_requests")
      .select("id")
      .eq("domain_id", domainId)
      .eq("status", "pending")
      .maybeSingle();
    if (existing) throw new Error("Es existiert bereits ein offener Antrag.");
    const { data: row, error } = await supabase
      .from("data_purge_requests")
      .insert({
        domain_id: domainId,
        scope: "dateien",
        requested_by: userId,
        note: data.note ?? null,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

// Domain-Admin: eigene Anträge dieser Domäne anzeigen
export const listMyPurgeRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const domainId = await requireEffectiveDomainId(supabase, userId);
    const { data, error } = await supabase
      .from("data_purge_requests")
      .select("*")
      .eq("domain_id", domainId)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    return { requests: data ?? [] };
  });

// Domain-Admin: eigenen pending-Antrag zurückziehen
export const cancelPurgeRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("data_purge_requests")
      .delete()
      .eq("id", data.id)
      .eq("status", "pending");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// SuperAdmin: alle offenen Anträge anzeigen (mit Domain- und Antragsteller-Info)
export const listPendingPurgeRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data: isSa } = await supabase.rpc("is_superadmin");
    if (!isSa) throw new Error("forbidden");
    const { data, error } = await supabaseAdmin
      .from("data_purge_requests")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    const domainIds = Array.from(new Set(rows.map((r) => r.domain_id)));
    const userIds = Array.from(
      new Set(rows.flatMap((r) => [r.requested_by, r.decided_by].filter(Boolean))),
    ) as string[];
    const [{ data: ds }, { data: ps }] = await Promise.all([
      supabaseAdmin.from("domains").select("id, name, slug").in("id", domainIds),
      userIds.length
        ? supabaseAdmin.from("profiles").select("id, display_name").in("id", userIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);
    const dmap = Object.fromEntries((ds ?? []).map((d: any) => [d.id, d]));
    const pmap = Object.fromEntries((ps ?? []).map((p: any) => [p.id, p.display_name ?? ""]));
    return {
      requests: rows.map((r) => ({
        ...r,
        domain: dmap[r.domain_id] ?? null,
        requested_by_name: pmap[r.requested_by] ?? null,
        decided_by_name: r.decided_by ? pmap[r.decided_by] ?? null : null,
      })),
    };
  });

// SuperAdmin: Antrag entscheiden
export const decidePurgeRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        id: z.string().uuid(),
        decision: z.enum(["approve", "reject"]),
        note: z.string().max(1000).optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isSa } = await supabase.rpc("is_superadmin");
    if (!isSa) throw new Error("forbidden");

    const { data: req, error: reqErr } = await supabaseAdmin
      .from("data_purge_requests")
      .select("*")
      .eq("id", data.id)
      .single();
    if (reqErr) throw new Error(reqErr.message);
    if (req.status !== "pending") throw new Error("Antrag nicht mehr offen.");

    if (data.decision === "reject") {
      const { error } = await supabaseAdmin
        .from("data_purge_requests")
        .update({
          status: "rejected",
          decided_by: userId,
          decided_at: new Date().toISOString(),
          note: data.note ?? req.note,
        })
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { ok: true, status: "rejected" };
    }

    // approve → ausführen (hartes Löschen aller Dateien dieser Domäne)
    const domainId = req.domain_id as string;

    // Storage-Pfade einsammeln (auch soft-deleted)
    const { data: files, error: filesErr } = await supabaseAdmin
      .from("dateien")
      .select("id, storage_path")
      .eq("domain_id", domainId);
    if (filesErr) throw new Error(filesErr.message);
    const paths = (files ?? [])
      .map((f: any) => f.storage_path)
      .filter((p: string | null): p is string => !!p);

    // Storage-Objekte in Chunks löschen
    for (let i = 0; i < paths.length; i += 100) {
      const chunk = paths.slice(i, i + 100);
      const { error: rmErr } = await supabaseAdmin.storage.from("dateien").remove(chunk);
      if (rmErr) throw new Error(`Storage-Löschung fehlgeschlagen: ${rmErr.message}`);
    }

    // Abhängige Datensätze entfernen
    await supabaseAdmin.from("datei_verknuepfungen").delete().eq("domain_id", domainId);
    await supabaseAdmin.from("datei_historie").delete().eq("domain_id", domainId);
    const { error: delErr, count } = await supabaseAdmin
      .from("dateien")
      .delete({ count: "exact" })
      .eq("domain_id", domainId);
    if (delErr) throw new Error(delErr.message);

    const { error: updErr } = await supabaseAdmin
      .from("data_purge_requests")
      .update({
        status: "completed",
        decided_by: userId,
        decided_at: new Date().toISOString(),
        executed_at: new Date().toISOString(),
        affected_count: count ?? (files?.length ?? 0),
        note: data.note ?? req.note,
      })
      .eq("id", data.id);
    if (updErr) throw new Error(updErr.message);

    return { ok: true, status: "completed", affected: count ?? files?.length ?? 0 };
  });

// ============================================================
// SuperAdmin fordert das endgültige Löschen einer Tabelle an;
// der Domain-Admin muss bestätigen.
// ============================================================

export const superadminRequestTablePurge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        domainId: z.string().uuid(),
        tableName: z.string().min(1),
        note: z.string().max(1000).optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isSa } = await supabase.rpc("is_superadmin");
    if (!isSa) throw new Error("forbidden");
    if (!PURGEABLE_TABLE_SET.has(data.tableName)) {
      throw new Error("Tabelle nicht zum Löschen freigegeben.");
    }
    // Nur ein offener Antrag pro (Domain, Tabelle)
    const { data: existing } = await supabaseAdmin
      .from("data_purge_requests")
      .select("id")
      .eq("domain_id", data.domainId)
      .eq("scope", "table")
      .eq("target_table", data.tableName)
      .eq("status", "pending")
      .maybeSingle();
    if (existing) throw new Error("Es existiert bereits ein offener Antrag für diese Tabelle.");
    const { data: row, error } = await supabaseAdmin
      .from("data_purge_requests")
      .insert({
        domain_id: data.domainId,
        scope: "table",
        target_table: data.tableName,
        initiator: "superadmin",
        requested_by: userId,
        note: data.note ?? null,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

// Domain-Admin: offene, vom SuperAdmin gestellte Anträge in eigener Domäne anzeigen
export const listPendingSuperadminPurgeRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const domainId = await requireEffectiveDomainId(supabase, userId);
    const { data, error } = await supabase
      .from("data_purge_requests")
      .select("*")
      .eq("domain_id", domainId)
      .eq("initiator", "superadmin")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return { requests: data ?? [] };
  });

// Domain-Admin bestätigt oder lehnt einen SuperAdmin-Antrag ab
export const confirmSuperadminPurgeRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        id: z.string().uuid(),
        decision: z.enum(["approve", "reject"]),
        note: z.string().max(1000).optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const domainId = await requireEffectiveDomainId(supabase, userId);
    const { data: isAdmin } = await supabase.rpc("is_domain_admin", { _domain_id: domainId });
    if (!isAdmin) throw new Error("forbidden");

    const { data: req, error: reqErr } = await supabaseAdmin
      .from("data_purge_requests")
      .select("*")
      .eq("id", data.id)
      .single();
    if (reqErr) throw new Error(reqErr.message);
    if (req.domain_id !== domainId) throw new Error("forbidden");
    if (req.initiator !== "superadmin") throw new Error("Antrag ist nicht bestätigungspflichtig.");
    if (req.status !== "pending") throw new Error("Antrag nicht mehr offen.");
    if (req.scope !== "table" || !req.target_table) throw new Error("Ungültiger Antrag.");
    if (!PURGEABLE_TABLE_SET.has(req.target_table)) throw new Error("Tabelle nicht zugelassen.");

    if (data.decision === "reject") {
      const { error } = await supabaseAdmin
        .from("data_purge_requests")
        .update({
          status: "rejected",
          decided_by: userId,
          decided_at: new Date().toISOString(),
          note: data.note ?? req.note,
        })
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { ok: true, status: "rejected" };
    }

    // approve → hartes Löschen aller Zeilen der Tabelle für diese Domain
    const admin = supabaseAdmin as unknown as {
      from: (t: string) => {
        delete: (opts?: { count?: "exact" }) => {
          eq: (col: string, val: unknown) => Promise<{ error: { message: string } | null; count: number | null }>;
        };
      };
    };
    const { error: delErr, count } = await admin
      .from(req.target_table)
      .delete({ count: "exact" })
      .eq("domain_id", domainId);
    if (delErr) throw new Error(`Löschung fehlgeschlagen: ${delErr.message}`);

    const { error: updErr } = await supabaseAdmin
      .from("data_purge_requests")
      .update({
        status: "completed",
        decided_by: userId,
        decided_at: new Date().toISOString(),
        executed_at: new Date().toISOString(),
        affected_count: count ?? 0,
        note: data.note ?? req.note,
      })
      .eq("id", data.id);
    if (updErr) throw new Error(updErr.message);

    return { ok: true, status: "completed", affected: count ?? 0 };
  });
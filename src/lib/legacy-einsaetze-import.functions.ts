import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Import einsaetze from legacy systems.
 * Rows are arbitrary JSON objects; we map a known set of legacy fields
 * into the new schema and stash the full original row in `legacy_data`.
 */

const inputSchema = z.object({
  domain_id: z.string().uuid(),
  einsatz_typ: z.string().min(1).max(50).default("hausnotruf"),
  rows: z.array(z.record(z.string(), z.any())).min(1).max(5000),
});

function toIso(v: any): string | null {
  if (v == null || v === "" || /^null$/i.test(String(v))) return null;
  const s = String(v).trim();
  // Already ISO?
  const d = new Date(s.includes("T") ? s : s.replace(" ", "T"));
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

function pick(row: Record<string, any>, ...keys: string[]): any {
  for (const k of keys) {
    if (row[k] != null && row[k] !== "" && !/^null$/i.test(String(row[k]))) return row[k];
  }
  return null;
}

function mapStatus(s: any): string {
  const v = String(s ?? "").toLowerCase().trim();
  if (!v) return "abgeschlossen";
  if (["canceled", "cancelled", "storniert", "abgebrochen"].includes(v)) return "storniert";
  if (["completed", "done", "abgeschlossen", "fertig", "closed"].includes(v)) return "abgeschlossen";
  if (["in_progress", "in_bearbeitung", "running", "active"].includes(v)) return "in_bearbeitung";
  if (["pending", "open", "offen", "neu"].includes(v)) return "freigegeben";
  if (["rejected", "abgelehnt"].includes(v)) return "abgelehnt";
  return "abgeschlossen";
}

export const importLegacyEinsaetze = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => inputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Authorize: only superadmin or admin of target domain
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role, domain_id");
    const isSuper = (roles ?? []).some((r: any) => r.role === "superadmin");
    const isDomainAdmin = (roles ?? []).some(
      (r: any) => r.role === "admin" && r.domain_id === data.domain_id,
    );
    if (!isSuper && !isDomainAdmin) {
      throw new Error("Nur SuperAdmins oder Admins der Ziel-Domain dürfen importieren.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let inserted = 0;
    const errors: { row: number; message: string }[] = [];
    const records: any[] = [];

    for (let i = 0; i < data.rows.length; i++) {
      const r = data.rows[i];
      try {
        const start = toIso(pick(r, "start_time", "start", "created_at", "geplant_am"));
        const end = toIso(pick(r, "end_time", "end", "abgeschlossen_am", "einsatz_ende_am"));
        const vorort = toIso(pick(r, "vorort_time", "vor_ort_am", "vor_ort_time"));
        const abfahrt = toIso(pick(r, "abfahrt_time", "abfahrt_am"));
        const status = mapStatus(pick(r, "status"));
        const reason = String(
          pick(r, "reason", "einsatzgrund", "grund") ?? "Legacy-Import",
        ).slice(0, 500);
        const solution = pick(r, "solution", "loesung", "hausnotruf_loesung");
        const cancelReason = pick(r, "cancel_reason", "storniert_grund", "storno_grund");

        const rec: any = {
          domain_id: data.domain_id,
          einsatz_typ: data.einsatz_typ,
          einsatzgrund: reason,
          prioritaet: "normal",
          status,
          created_by: userId,
          created_at: start ?? new Date().toISOString(),
          geplant_am: start,
          vor_ort_am: vorort,
          abfahrt_am: abfahrt,
          einsatz_ende_am: end,
          abgeschlossen_am: status === "abgeschlossen" ? end : null,
          hausnotruf_loesung: solution ? String(solution).slice(0, 5000) : null,
          kunden_name: pick(r, "kunden_name", "customer", "kunde"),
          address: pick(r, "address", "adresse"),
          key_number: pick(r, "key_number", "schluessel"),
          anlagen_nr: pick(r, "anlagen_nr", "anlagennr"),
          teilnehmer_id: pick(r, "teilnehmer_id", "teilnehmerid"),
          beschreibung: pick(r, "beschreibung", "description", "notiz"),
          legacy_data: r,
        };
        if (status === "storniert") {
          rec.storniert_at = end ?? start;
          rec.storniert_grund = cancelReason ? String(cancelReason).slice(0, 2000) : null;
        }
        records.push(rec);
      } catch (e: any) {
        errors.push({ row: i + 1, message: e?.message ?? String(e) });
      }
    }

    // Chunked insert
    const CHUNK = 200;
    for (let i = 0; i < records.length; i += CHUNK) {
      const slice = records.slice(i, i + CHUNK);
      const { error, count } = await supabaseAdmin
        .from("einsaetze")
        .insert(slice, { count: "exact" });
      if (error) {
        errors.push({ row: i + 1, message: error.message });
      } else {
        inserted += count ?? slice.length;
      }
    }

    return { total: data.rows.length, inserted, errors };
  });

export const listImportDomains = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role, domain_id");
    const isSuper = (roles ?? []).some((r: any) => r.role === "superadmin");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin.from("domains").select("id, name, slug").order("name");
    if (!isSuper) {
      const ids = (roles ?? [])
        .filter((r: any) => r.role === "admin" && r.domain_id)
        .map((r: any) => r.domain_id);
      if (ids.length === 0) return { domains: [] };
      q = q.in("id", ids);
    }
    const { data, error } = await q;
    if (error) throw error;
    return { domains: data ?? [] };
  });
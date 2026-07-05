import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireEffectiveDomainId } from "@/lib/tenant.server";

const ROHR_MAP: Record<string, string> = {
  caller_name: "anrufer_name",
  caller_phone: "anrufer_telefon",
  caller_address: "anrufer_adresse",
  caller_company: "anrufer_firma",
  billing_name: "rechnung_name",
  billing_address: "rechnung_adresse",
  billing_phone: "rechnung_telefon",
  tenant_name: "mieter_name",
  tenant_phone: "mieter_telefon",
  street: "mieter_strasse",
  city: "mieter_ort",
  issue_type: "stoerungsart",
  data_forwarding: "weiterleitung",
  call_date: "zeit_kundenanruf",
  forward_date: "zeit_weitergabe",
  response_date: "zeit_rueckmeldung",
  forwarded_technician: "monteur_weitergabe",
  response_technician: "monteur_rueckmeldung",
  dispatcher: "diensthabender_alarmzentrale",
  created_at: "created_at",
};

const BUDEKO_MAP: Record<string, string> = {
  caller_name: "anrufer_name",
  caller_phone: "anrufer_telefon",
  caller_address: "anrufer_adresse",
  caller_company: "anrufer_firma",
  tenant_name: "mieter_name",
  tenant_phone: "mieter_telefon",
  street: "mieter_strasse",
  city: "mieter_ort",
  issue_type: "stoerungsart",
  data_forwarding: "weiterleitung",
  call_date: "zeit_kundenanruf",
  forward_date: "zeit_weitergabe",
  forwarded_technician: "monteur_weitergabe",
  dispatcher: "diensthabender_alarmzentrale",
  created_at: "created_at",
};

function normWeiterleitung(v: string | null | undefined): string | null {
  if (!v) return null;
  const s = String(v).toLowerCase();
  if (/n(ae|ä|a)chst/.test(s)) return "mail_naechster_tag";
  if (/mail|email|e-mail/.test(s)) return "mail";
  if (/mobil|handy|mobile|phone|tel/.test(s)) return "mobil";
  return null;
}

function normTs(v: string | null | undefined): string | null {
  if (!v) return null;
  const s = String(v).trim();
  if (!s || s.startsWith("0000")) return null;
  // MySQL "YYYY-MM-DD HH:MM:SS" → treat as local time; Postgres accepts.
  return s;
}

function assertAdmin(rows: any[]) {
  const ok = rows.some((r) => r.role === "superadmin" || r.role === "admin");
  if (!ok) throw new Error("Nur Admins dürfen Berichte importieren");
}

async function ensureAdmin(supabase: any, userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  assertAdmin(data ?? []);
}

const inputSchema = z.object({
  variant: z.enum(["rohrservice", "budeko"]),
  rows: z.array(z.record(z.string(), z.union([z.string(), z.null()]))).min(1).max(5000),
});

export const importNotdienstBerichte = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => inputSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensureAdmin(supabase, userId);
    const domainId = await requireEffectiveDomainId(supabase, userId);
    const map = data.variant === "rohrservice" ? ROHR_MAP : BUDEKO_MAP;
    const table = data.variant === "rohrservice" ? "rohrservice_berichte" : "budeko_berichte";

    const mapped = data.rows.map((row) => {
      const out: Record<string, any> = { domain_id: domainId, created_by: userId };
      for (const [src, dest] of Object.entries(map)) {
        const v = row[src];
        if (v == null || v === "") continue;
        if (dest === "weiterleitung") {
          const w = normWeiterleitung(v);
          if (w) out[dest] = w;
          continue;
        }
        if (dest.startsWith("zeit_") || dest === "created_at") {
          const t = normTs(v);
          if (t) out[dest] = t;
          continue;
        }
        out[dest] = String(v).slice(0, 4000);
      }
      return out;
    });

    // Insert in chunks to avoid payload limits
    const CHUNK = 200;
    let inserted = 0;
    for (let i = 0; i < mapped.length; i += CHUNK) {
      const slice = mapped.slice(i, i + CHUNK);
      const { error, count } = await (supabase.from(table) as any).insert(slice, { count: "exact" });
      if (error) throw new Error(`Import fehlgeschlagen bei Zeile ${i + 1}: ${error.message}`);
      inserted += count ?? slice.length;
    }
    return { inserted };
  });
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getEffectiveDomainId } from "@/lib/tenant.server";

export const getDashboardStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const domainId = await getEffectiveDomainId(supabase, userId);
    if (!domainId) {
      return {
        userId,
        stats: { monatEinsaetze: 0, aktiveEinsaetze: 0, gesamtEinsaetze: 0, storniert: 0, datensaetze: 0 },
        recent: [],
        noDomain: true as const,
      };
    }
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const [allRes, monatRes, aktivRes, stornoRes, dateienRes, recentRes] = await Promise.all([
      supabase.from("einsaetze").select("id", { count: "exact", head: true }),
      supabase.from("einsaetze").select("id", { count: "exact", head: true }).gte("created_at", monthStart),
      supabase.from("einsaetze").select("id", { count: "exact", head: true }).in("status", ["in_bearbeitung", "freigegeben", "wartet_freigabe"]),
      supabase.from("einsaetze").select("id", { count: "exact", head: true }).eq("status", "abgelehnt"),
      supabase.from("dateien").select("id", { count: "exact", head: true }).is("deleted_at", null),
      supabase.from("einsaetze")
        .select("id, einsatzgrund, kunden_name, status, created_at, abgeschlossen_am, assigned_to, vor_ort_am, einsatz_ende_am")
        .order("created_at", { ascending: false }).limit(8),
    ]);

    const recents = recentRes.data ?? [];
    const fahrerIds = Array.from(new Set(recents.map((r: any) => r.assigned_to).filter(Boolean))) as string[];
    let names: Record<string, string> = {};
    if (fahrerIds.length > 0) {
      const { data: ps } = await supabase.from("profiles").select("id, display_name").in("id", fahrerIds);
      names = Object.fromEntries((ps ?? []).map((p: any) => [p.id, p.display_name ?? ""]));
    }

    const fmtDur = (a?: string | null, b?: string | null) => {
      if (!a || !b) return "–";
      const ms = new Date(b).getTime() - new Date(a).getTime();
      if (ms <= 0) return "–";
      const m = Math.floor(ms / 60000);
      const h = Math.floor(m / 60);
      return h > 0 ? `${h}h ${m % 60}m` : `${m}m`;
    };

    return {
      userId,
      stats: {
        monatEinsaetze: monatRes.count ?? 0,
        aktiveEinsaetze: aktivRes.count ?? 0,
        gesamtEinsaetze: allRes.count ?? 0,
        storniert: stornoRes.count ?? 0,
        datensaetze: dateienRes.count ?? 0,
      },
      recent: recents.map((r: any) => ({
        id: r.id,
        dateiname: r.einsatzgrund + (r.kunden_name ? ` · ${r.kunden_name}` : ""),
        fahrer: r.assigned_to ? (names[r.assigned_to] ?? "–") : "–",
        start: r.created_at ? new Date(r.created_at).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "–",
        ende: r.abgeschlossen_am ? new Date(r.abgeschlossen_am).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "–",
        dauer: fmtDur(r.vor_ort_am, r.einsatz_ende_am),
        status: r.status,
      })),
    };
  });

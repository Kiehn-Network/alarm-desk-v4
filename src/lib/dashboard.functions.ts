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
        .select("id, einsatzgrund, kunden_name, kunden_email, address, teilnehmer_id, anlagen_nr, key_number, hausnotruf_provider, beschreibung, prioritaet, status, created_at, abgeschlossen_am, assigned_to, vor_ort_am, einsatz_ende_am")
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

export const getDashboardExtras = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const domainId = await getEffectiveDomainId(supabase, userId);
    if (!domainId) {
      return {
        reaktion: { heute: null as number | null, gestern: null as number | null, countHeute: 0 },
        provider: {} as Record<string, number>,
        stunden: { totalMin: 0, projectedMin: 0, daysElapsed: 0, daysInMonth: 0 },
        topKunden: [] as Array<{ name: string; count: number }>,
        aktiveFahrer: 0,
      };
    }
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterdayStart = new Date(todayStart.getTime() - 24 * 3600 * 1000);
    const onlineSince = new Date(Date.now() - 10 * 60 * 1000);

    const [rxTodayRes, rxYestRes, providerRes, hoursRes, kundenRes, drvRes] = await Promise.all([
      supabase.from("einsaetze").select("created_at, vor_ort_am")
        .gte("created_at", todayStart.toISOString()).not("vor_ort_am", "is", null),
      supabase.from("einsaetze").select("created_at, vor_ort_am")
        .gte("created_at", yesterdayStart.toISOString()).lt("created_at", todayStart.toISOString())
        .not("vor_ort_am", "is", null),
      supabase.from("einsaetze").select("hausnotruf_provider")
        .gte("created_at", monthStart.toISOString()).not("hausnotruf_provider", "is", null),
      supabase.from("einsaetze").select("vor_ort_am, einsatz_ende_am")
        .gte("created_at", monthStart.toISOString())
        .not("vor_ort_am", "is", null).not("einsatz_ende_am", "is", null),
      supabase.from("einsaetze").select("kunden_name")
        .gte("created_at", monthStart.toISOString()).not("kunden_name", "is", null),
      supabase.from("driver_locations").select("user_id", { count: "exact", head: true })
        .gte("updated_at", onlineSince.toISOString()),
    ]);

    const avgMin = (arr: any[] | null) => {
      if (!arr || arr.length === 0) return null;
      let sum = 0; let n = 0;
      arr.forEach((r) => {
        const ms = new Date(r.vor_ort_am).getTime() - new Date(r.created_at).getTime();
        if (ms > 0) { sum += ms; n++; }
      });
      return n > 0 ? Math.round((sum / n) / 60000) : null;
    };

    const providerCounts: Record<string, number> = {};
    (providerRes.data ?? []).forEach((r: any) => {
      const p = String(r.hausnotruf_provider ?? "").toLowerCase();
      if (!p) return;
      providerCounts[p] = (providerCounts[p] ?? 0) + 1;
    });

    let totalMin = 0;
    (hoursRes.data ?? []).forEach((r: any) => {
      const ms = new Date(r.einsatz_ende_am).getTime() - new Date(r.vor_ort_am).getTime();
      if (ms > 0) totalMin += Math.floor(ms / 60000);
    });
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const daysElapsed = now.getDate();
    const projectedMin = daysElapsed > 0 ? Math.round((totalMin / daysElapsed) * daysInMonth) : 0;

    const kundenCounts = new Map<string, number>();
    (kundenRes.data ?? []).forEach((r: any) => {
      const n = String(r.kunden_name ?? "").trim();
      if (!n) return;
      kundenCounts.set(n, (kundenCounts.get(n) ?? 0) + 1);
    });
    const topKunden = Array.from(kundenCounts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      reaktion: {
        heute: avgMin(rxTodayRes.data),
        gestern: avgMin(rxYestRes.data),
        countHeute: (rxTodayRes.data ?? []).length,
      },
      provider: providerCounts,
      stunden: { totalMin, projectedMin, daysElapsed, daysInMonth },
      topKunden,
      aktiveFahrer: drvRes.count ?? 0,
    };
  });

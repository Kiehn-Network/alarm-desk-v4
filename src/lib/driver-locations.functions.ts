import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const LocationInput = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  accuracy: z.number().min(0).max(100000).nullable().optional(),
  heading: z.number().min(0).max(360).nullable().optional(),
  speed: z.number().min(0).max(1000).nullable().optional(),
});

export const updateMyLocation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => LocationInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles")
      .select("domain_id")
      .eq("id", userId)
      .maybeSingle();
    if (!profile?.domain_id) return { ok: false as const, reason: "no_domain" };

    const { error } = await supabase
      .from("driver_locations")
      .upsert(
        {
          user_id: userId,
          domain_id: profile.domain_id,
          lat: data.lat,
          lng: data.lng,
          accuracy: data.accuracy ?? null,
          heading: data.heading ?? null,
          speed: data.speed ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export type DriverOnMap = {
  user_id: string;
  display_name: string | null;
  lat: number;
  lng: number;
  accuracy: number | null;
  updated_at: string;
  einsatz: null | {
    id: string;
    kunden_name: string | null;
    address: string | null;
    einsatzgrund: string;
    abfahrt_am: string | null;
    vor_ort_am: string | null;
    einsatz_ende_am: string | null;
    phase: "zugewiesen" | "anfahrt" | "vor_ort" | "ende";
  };
};

export const getDomainDrivers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DriverOnMap[]> => {
    const { supabase } = context;

    const { data: locs, error: locErr } = await supabase
      .from("driver_locations")
      .select("user_id, lat, lng, accuracy, updated_at");
    if (locErr) throw new Error(locErr.message);
    if (!locs || locs.length === 0) return [];

    const userIds = locs.map((l) => l.user_id);

    const [{ data: profiles }, { data: einsaetze }] = await Promise.all([
      supabase.from("profiles").select("id, display_name").in("id", userIds),
      supabase
        .from("einsaetze")
        .select("id, assigned_to, kunden_name, address, einsatzgrund, abfahrt_am, vor_ort_am, einsatz_ende_am, status, updated_at")
        .in("assigned_to", userIds)
        .in("status", ["freigegeben", "in_bearbeitung"])
        .order("updated_at", { ascending: false }),
    ]);

    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p.display_name as string | null]));
    const einsatzByUser = new Map<string, NonNullable<DriverOnMap["einsatz"]>>();
    for (const e of einsaetze ?? []) {
      if (!e.assigned_to || einsatzByUser.has(e.assigned_to)) continue;
      let phase: NonNullable<DriverOnMap["einsatz"]>["phase"] = "zugewiesen";
      if (e.einsatz_ende_am) phase = "ende";
      else if (e.vor_ort_am) phase = "vor_ort";
      else if (e.abfahrt_am) phase = "anfahrt";
      einsatzByUser.set(e.assigned_to, {
        id: e.id,
        kunden_name: e.kunden_name,
        address: e.address,
        einsatzgrund: e.einsatzgrund,
        abfahrt_am: e.abfahrt_am,
        vor_ort_am: e.vor_ort_am,
        einsatz_ende_am: e.einsatz_ende_am,
        phase,
      });
    }

    return locs.map((l) => ({
      user_id: l.user_id,
      display_name: profileMap.get(l.user_id) ?? null,
      lat: l.lat,
      lng: l.lng,
      accuracy: l.accuracy,
      updated_at: l.updated_at,
      einsatz: einsatzByUser.get(l.user_id) ?? null,
    }));
  });
export type EinsatzTracking = {
  einsatz_id: string;
  einsatzgrund: string;
  kunden_name: string | null;
  address: string | null;
  phase: "zugewiesen" | "anfahrt" | "vor_ort" | "ende";
  fahrer_id: string;
  fahrer_name: string | null;
  fahrer_telefon: string | null;
  telefon_name: string | null;
  fahrer_avatar: string | null;
  position_at: string | null;
  distance_km: number | null;
  eta_min: number | null;
};

async function geocode(address: string): Promise<[number, number] | null> {
  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=de&q=${encodeURIComponent(address)}`,
      { headers: { "User-Agent": "AlarmDesk/4 (dispatch)" } },
    );
    const j: any[] = await r.json();
    if (!j?.[0]) return null;
    return [Number(j[0].lat), Number(j[0].lon)];
  } catch { return null; }
}

async function route(from: [number, number], to: [number, number]) {
  try {
    const r = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${from[1]},${from[0]};${to[1]},${to[0]}?overview=false`,
    );
    const j: any = await r.json();
    const rt = j?.routes?.[0];
    if (!rt) return null;
    return { km: rt.distance / 1000, min: rt.duration / 60 };
  } catch { return null; }
}

function haversineKm(a: [number, number], b: [number, number]) {
  const R = 6371, t = Math.PI / 180;
  const dLat = (b[0] - a[0]) * t, dLng = (b[1] - a[1]) * t;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * t) * Math.cos(b[0] * t) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

export const getEinsatzTracking = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<EinsatzTracking[]> => {
    const { supabase } = context;
    const { data: es } = await supabase
      .from("einsaetze")
      .select("id, assigned_to, kunden_name, address, einsatzgrund, abfahrt_am, vor_ort_am, einsatz_ende_am, ziel_lat, ziel_lng")
      .in("status", ["freigegeben", "in_bearbeitung"])
      .not("assigned_to", "is", null)
      .order("created_at", { ascending: false })
      .limit(20);
    if (!es || es.length === 0) return [];
    const ids = Array.from(new Set(es.map((e) => e.assigned_to!)));
    const [{ data: profs }, { data: locs }] = await Promise.all([
      supabase.from("profiles").select("id, display_name, telefon, avatar_url, dienst_telefon_id").in("id", ids),
      supabase.from("driver_locations").select("user_id, lat, lng, updated_at").in("user_id", ids),
    ]);
    const pm = new Map((profs ?? []).map((p: any) => [p.id, p]));
    const telIds = (profs ?? []).map((p: any) => p.dienst_telefon_id).filter(Boolean);
    const tm = new Map<string, any>();
    if (telIds.length) {
      const { data: tels } = await supabase.from("dienst_telefone").select("id, name, nummer").in("id", telIds);
      (tels ?? []).forEach((t: any) => tm.set(t.id, t));
    }
    const lm = new Map((locs ?? []).map((l: any) => [l.user_id, l]));

    return Promise.all(es.map(async (e: any) => {
      let phase: EinsatzTracking["phase"] = "zugewiesen";
      if (e.einsatz_ende_am) phase = "ende";
      else if (e.vor_ort_am) phase = "vor_ort";
      else if (e.abfahrt_am) phase = "anfahrt";
      let ziel: [number, number] | null = e.ziel_lat != null && e.ziel_lng != null ? [e.ziel_lat, e.ziel_lng] : null;
      if (!ziel && e.address) {
        ziel = await geocode(e.address);
        if (ziel) await supabase.from("einsaetze").update({ ziel_lat: ziel[0], ziel_lng: ziel[1] } as any).eq("id", e.id);
      }
      const loc: any = lm.get(e.assigned_to);
      let distance_km: number | null = null, eta_min: number | null = null;
      if (ziel && loc && phase !== "vor_ort" && phase !== "ende") {
        const from: [number, number] = [loc.lat, loc.lng];
        const r = await route(from, ziel);
        if (r) { distance_km = r.km; eta_min = r.min; }
        else { distance_km = haversineKm(from, ziel) * 1.3; eta_min = (distance_km / 50) * 60; }
      } else if (phase === "vor_ort" || phase === "ende") { distance_km = 0; eta_min = 0; }
      const p: any = pm.get(e.assigned_to);
      return {
        einsatz_id: e.id, einsatzgrund: e.einsatzgrund, kunden_name: e.kunden_name, address: e.address, phase,
        fahrer_id: e.assigned_to, fahrer_name: p?.display_name ?? null, fahrer_telefon: tm.get(p?.dienst_telefon_id)?.nummer ?? p?.telefon ?? null,
        telefon_name: tm.get(p?.dienst_telefon_id)?.name ?? null,
        fahrer_avatar: p?.avatar_url ?? null, position_at: loc?.updated_at ?? null,
        distance_km: distance_km != null ? Math.round(distance_km * 10) / 10 : null,
        eta_min: eta_min != null ? Math.round(eta_min) : null,
      };
    }));
  });

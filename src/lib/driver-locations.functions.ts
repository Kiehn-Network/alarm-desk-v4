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
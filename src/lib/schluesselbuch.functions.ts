import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireEffectiveDomainId } from "@/lib/tenant.server";

// =================================================================
// SCHLÜSSELBUCH — Schlüsselausgabe und -rückgabe
// =================================================================

const ausgebenSchema = z.object({
  einsatz_id: z.string().uuid(),
  key_number: z.string().trim().min(1).max(100),
  traeger_user_id: z.string().uuid().optional().nullable(),
  traeger_name: z.string().trim().min(1).max(200),
  notiz: z.string().max(2000).optional().nullable(),
});

export const ausgebenSchluessel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => ausgebenSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const domainId = await requireEffectiveDomainId(supabase, userId);

    // Snapshot Kunden-Daten aus Einsatz holen
    const { data: einsatz, error: eErr } = await supabase
      .from("einsaetze")
      .select("kunden_name, address")
      .eq("id", data.einsatz_id)
      .single();
    if (eErr) throw new Error(eErr.message);

    const { data: row, error } = await supabase
      .from("schluessel_buch")
      .insert({
        domain_id: domainId,
        einsatz_id: data.einsatz_id,
        key_number: data.key_number,
        kunden_name: einsatz?.kunden_name ?? null,
        address: einsatz?.address ?? null,
        traeger_user_id: data.traeger_user_id ?? null,
        traeger_name: data.traeger_name,
        status: "ausgegeben",
        ausgegeben_by: userId,
        ausgegeben_at: new Date().toISOString(),
        notiz: data.notiz ?? null,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const uebernehmenSchluessel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("schluessel_buch")
      .update({
        status: "uebernommen",
        uebernommen_at: new Date().toISOString(),
        uebernommen_by: userId,
      })
      .eq("id", data.id)
      .in("status", ["ausgegeben"])
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const rueckgabeAnfragen = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("schluessel_buch")
      .update({
        status: "rueckgabe_offen",
        rueckgabe_angefragt_at: new Date().toISOString(),
        rueckgabe_angefragt_by: userId,
      })
      .eq("id", data.id)
      .in("status", ["ausgegeben", "uebernommen"])
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const rueckgabeBestaetigen = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Nur Disponent/Admin/SuperAdmin
    const { data: roles } = await supabaseAdmin
      .from("user_roles").select("role").eq("user_id", userId);
    const allowed = (roles ?? []).some((r: any) =>
      r.role === "dispatcher" || r.role === "admin" || r.role === "superadmin");
    if (!allowed) throw new Error("Nur Zentrale/Disponent darf Rückgabe bestätigen");

    const { data: row, error } = await supabase
      .from("schluessel_buch")
      .update({
        status: "zurueck",
        zurueck_at: new Date().toISOString(),
        zurueck_by: userId,
      })
      .eq("id", data.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const listSchluesselbuch = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("schluessel_buch")
      .select("*")
      .order("ausgegeben_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);

    const ids = new Set<string>();
    (data ?? []).forEach((r: any) => {
      if (r.traeger_user_id) ids.add(r.traeger_user_id);
      if (r.ausgegeben_by) ids.add(r.ausgegeben_by);
      if (r.uebernommen_by) ids.add(r.uebernommen_by);
      if (r.zurueck_by) ids.add(r.zurueck_by);
      if (r.rueckgabe_angefragt_by) ids.add(r.rueckgabe_angefragt_by);
    });
    let profiles: Record<string, string> = {};
    if (ids.size > 0) {
      const { data: ps } = await supabase
        .from("profiles").select("id, display_name").in("id", Array.from(ids));
      profiles = Object.fromEntries((ps ?? []).map((p: any) => [p.id, p.display_name ?? ""]));
    }
    return { entries: data ?? [], profiles };
  });

export const listSchluesselForEinsatz = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ einsatz_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("schluessel_buch")
      .select("*")
      .eq("einsatz_id", data.einsatz_id)
      .order("ausgegeben_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { entries: rows ?? [] };
  });
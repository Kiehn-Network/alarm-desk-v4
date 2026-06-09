import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireEffectiveDomainId } from "@/lib/tenant.server";

const itemSchema = z.object({
  anzahl: z.string().trim().max(50).default(""),
  art: z.string().trim().max(150).default(""),
  beschreibung: z.string().trim().max(300).default(""),
});

const createSchema = z.object({
  richtung: z.enum(["ausgang", "eingang"]),
  kunden_name: z.string().trim().max(200).optional().nullable(),
  strasse: z.string().trim().max(200).optional().nullable(),
  ort: z.string().trim().max(200).optional().nullable(),
  uebergeben_von_name: z.string().trim().max(200).optional().nullable(),
  uebergeben_an_name: z.string().trim().max(200).optional().nullable(),
  items: z.array(itemSchema).max(50).default([]),
  notiz: z.string().max(2000).optional().nullable(),
});

export const createSchluesselProtokoll = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => createSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const domainId = await requireEffectiveDomainId(supabase, userId);
    const { data: nrData, error: nrErr } = await supabaseAdmin.rpc(
      "next_schluessel_protokoll_nr",
      { _domain_id: domainId },
    );
    if (nrErr) throw new Error(nrErr.message);
    const { data: row, error } = await supabase
      .from("schluesseluebergabe_protokolle")
      .insert({
        domain_id: domainId,
        protokoll_nr: nrData as number,
        richtung: data.richtung,
        kunden_name: data.kunden_name ?? null,
        strasse: data.strasse ?? null,
        ort: data.ort ?? null,
        uebergeben_von_name: data.uebergeben_von_name ?? null,
        uebergeben_an_name: data.uebergeben_an_name ?? null,
        items: data.items,
        notiz: data.notiz ?? null,
        created_by: userId,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const listSchluesselProtokolle = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("schluesseluebergabe_protokolle")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return { protokolle: data ?? [] };
  });

export const deleteSchluesselProtokoll = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("schluesseluebergabe_protokolle")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---- Footer settings ----
const footerSchema = z.object({
  firmenname: z.string().trim().max(200).optional().nullable(),
  footer_adresse: z.string().trim().max(300).optional().nullable(),
  footer_kontakt: z.string().trim().max(300).optional().nullable(),
});

export const getSchluesselSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const domainId = await requireEffectiveDomainId(supabase, userId);
    const { data, error } = await supabase
      .from("schluesseluebergabe_settings")
      .select("*")
      .eq("domain_id", domainId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { settings: data ?? null };
  });

export const upsertSchluesselSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => footerSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const domainId = await requireEffectiveDomainId(supabase, userId);
    const { data: row, error } = await supabase
      .from("schluesseluebergabe_settings")
      .upsert(
        {
          domain_id: domainId,
          firmenname: data.firmenname ?? null,
          footer_adresse: data.footer_adresse ?? null,
          footer_kontakt: data.footer_kontakt ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "domain_id" },
      )
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });
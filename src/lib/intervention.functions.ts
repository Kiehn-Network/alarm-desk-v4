import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireEffectiveDomainId } from "@/lib/tenant.server";

const partnerSchema = z.object({
  id: z.string().uuid().optional().nullable(),
  partner_domain_id: z.string().uuid(),
  display_name: z.string().trim().min(1).max(200),
  kontakt_email: z.string().email().max(200).optional().nullable().or(z.literal("")),
  kontakt_telefon: z.string().max(60).optional().nullable().or(z.literal("")),
  notiz: z.string().max(2000).optional().nullable().or(z.literal("")),
  aktiv: z.boolean().default(true),
});

export const listMyPartners = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await (supabase as any)
      .from("intervention_partners")
      .select("id, display_name, kontakt_email, kontakt_telefon, notiz, aktiv, partner_domain_id, created_at")
      .order("display_name");
    if (error) throw new Error(error.message);
    return { partners: data ?? [] };
  });

export const listAvailablePartnerDomains = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const domainId = await requireEffectiveDomainId(supabase, userId);
    const { data, error } = await supabaseAdmin
      .from("domains")
      .select("id, name")
      .neq("id", domainId)
      .order("name");
    if (error) throw new Error(error.message);
    return { domains: data ?? [] };
  });

export const upsertPartner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => partnerSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const domainId = await requireEffectiveDomainId(supabase, userId);
    const payload: any = {
      domain_id: domainId,
      partner_domain_id: data.partner_domain_id,
      display_name: data.display_name,
      kontakt_email: data.kontakt_email || null,
      kontakt_telefon: data.kontakt_telefon || null,
      notiz: data.notiz || null,
      aktiv: data.aktiv,
    };
    if (data.id) {
      const { data: row, error } = await (supabase as any)
        .from("intervention_partners").update(payload).eq("id", data.id).select().single();
      if (error) throw new Error(error.message);
      return row;
    }
    const { data: row, error } = await (supabase as any)
      .from("intervention_partners").insert(payload).select().single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deletePartner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await (supabase as any)
      .from("intervention_partners").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const createForPartnerSchema = z.object({
  partner_id: z.string().uuid(),
  einsatzgrund: z.string().trim().min(1).max(200),
  einsatzgrund_id: z.string().uuid().optional().nullable(),
  kunden_name: z.string().max(200).optional().nullable(),
  address: z.string().max(255).optional().nullable(),
  key_number: z.string().max(100).optional().nullable(),
  anlagen_nr: z.string().max(100).optional().nullable(),
  teilnehmer_id: z.string().max(100).optional().nullable(),
  beschreibung: z.string().max(4000).optional().nullable(),
});

export const createEinsatzForPartner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => createForPartnerSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const domainId = await requireEffectiveDomainId(supabase, userId);

    const { data: partner, error: pErr } = await (supabase as any)
      .from("intervention_partners")
      .select("id, partner_domain_id, aktiv")
      .eq("id", data.partner_id).single();
    if (pErr || !partner) throw new Error("Partner nicht gefunden");
    if (!partner.aktiv) throw new Error("Partner ist deaktiviert");

    const payload: any = {
      einsatzgrund: data.einsatzgrund,
      einsatzgrund_id: data.einsatzgrund_id ?? null,
      einsatz_typ: "av_einsatz",
      kunden_name: data.kunden_name ?? null,
      address: data.address ?? null,
      key_number: data.key_number ?? null,
      anlagen_nr: data.anlagen_nr ?? null,
      teilnehmer_id: data.teilnehmer_id ?? null,
      beschreibung: data.beschreibung ?? null,
      prioritaet: "normal",
      status: "freigegeben",
      created_by: userId,
      domain_id: domainId,
      assigned_to: null,
      approved_by: userId,
      approved_at: new Date().toISOString(),
    };
    const { data: row, error } = await supabase
      .from("einsaetze").insert(payload).select().single();
    if (error) throw new Error(error.message);

    const { error: sErr } = await (supabase as any)
      .from("einsatz_partner_shares").insert({
        einsatz_id: row.id,
        owner_domain_id: domainId,
        partner_domain_id: partner.partner_domain_id,
        status: "offen",
        created_by: userId,
      });
    if (sErr) {
      // Rollback einsatz to avoid orphan
      await supabase.from("einsaetze").delete().eq("id", row.id);
      throw new Error("Share fehlgeschlagen: " + sErr.message);
    }

    await supabase.from("einsatz_historie").insert({
      einsatz_id: row.id,
      field_name: "partner_share",
      old_value: null,
      new_value: partner.partner_domain_id,
      changed_by: userId,
      domain_id: domainId,
    });
    return row;
  });

export const listSharedToMe = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await (supabase as any)
      .from("einsatz_partner_shares")
      .select("id, einsatz_id, owner_domain_id, status, partner_assigned_to, partner_notiz, created_at, ablehnung_grund")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    const shares = (data ?? []) as any[];
    if (shares.length === 0) return { shares: [], einsaetze: {}, owners: {} };
    const einsatzIds = Array.from(new Set(shares.map((s) => s.einsatz_id)));
    const ownerIds = Array.from(new Set(shares.map((s) => s.owner_domain_id)));
    const [{ data: einsaetze }, { data: owners }] = await Promise.all([
      supabase.from("einsaetze").select("*").in("id", einsatzIds),
      supabaseAdmin.from("domains").select("id, name").in("id", ownerIds),
    ]);
    return {
      shares,
      einsaetze: Object.fromEntries((einsaetze ?? []).map((e: any) => [e.id, e])),
      owners: Object.fromEntries((owners ?? []).map((d: any) => [d.id, d.name])),
    };
  });

export const listSharesForEinsatz = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ einsatz_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: shares, error } = await (supabase as any)
      .from("einsatz_partner_shares")
      .select("id, partner_domain_id, status, partner_assigned_to, partner_notiz, created_at, ablehnung_grund")
      .eq("einsatz_id", data.einsatz_id);
    if (error) throw new Error(error.message);
    const list = (shares ?? []) as any[];
    if (list.length === 0) return { shares: [] };
    const domIds = Array.from(new Set(list.map((s) => s.partner_domain_id)));
    const { data: doms } = await supabaseAdmin.from("domains").select("id, name").in("id", domIds);
    const nameMap = Object.fromEntries((doms ?? []).map((d: any) => [d.id, d.name]));
    return { shares: list.map((s) => ({ ...s, partner_name: nameMap[s.partner_domain_id] ?? null })) };
  });

export const partnerRespond = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    share_id: z.string().uuid(),
    action: z.enum(["accept", "decline"]),
    grund: z.string().max(500).optional().nullable(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const patch: any = data.action === "accept"
      ? { status: "angenommen", ablehnung_grund: null }
      : { status: "abgelehnt", ablehnung_grund: data.grund ?? null };
    const { data: row, error } = await (supabase as any)
      .from("einsatz_partner_shares").update(patch).eq("id", data.share_id).select().single();
    if (error) throw new Error(error.message);
    return row;
  });

export const partnerAssignFahrer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    share_id: z.string().uuid(),
    fahrer_id: z.string().uuid(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await (supabase as any)
      .from("einsatz_partner_shares")
      .update({ partner_assigned_to: data.fahrer_id, status: "in_bearbeitung" })
      .eq("id", data.share_id).select("id, einsatz_id").single();
    if (error) throw new Error(error.message);
    // Mirror to einsatz.assigned_to so the partner-fahrer sees it in "Meine Einsätze"
    await supabase.from("einsaetze").update({
      assigned_to: data.fahrer_id,
      assigned_at: new Date().toISOString(),
      status: "in_bearbeitung",
    }).eq("id", row.einsatz_id);
    await supabase.from("einsatz_historie").insert({
      einsatz_id: row.einsatz_id,
      field_name: "partner_assigned_to",
      old_value: null,
      new_value: data.fahrer_id,
      changed_by: userId,
    } as any);
    return row;
  });

export const unshareEinsatz = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ share_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await (supabase as any)
      .from("einsatz_partner_shares").delete().eq("id", data.share_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

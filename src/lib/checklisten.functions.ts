import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireEffectiveDomainId } from "@/lib/tenant.server";

export type CheckPunkt = {
  text: string;
  required: boolean;
  checked?: boolean;
  checked_at?: string | null;
};

async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase
    .from("user_roles").select("role")
    .eq("user_id", userId).in("role", ["admin", "superadmin"]);
  if (!data || data.length === 0) throw new Error("Nicht autorisiert");
}

const punktSchema = z.object({
  text: z.string().trim().min(1, "Punkt-Text erforderlich").max(300),
  required: z.boolean(),
});

const vorlageSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(120),
  einsatz_typ: z.enum(["av_einsatz", "hausnotruf", "beide"]),
  punkte: z.array(punktSchema).min(1, "Mindestens ein Prüfpunkt erforderlich").max(50),
  aktiv: z.boolean(),
});

export const listChecklistenVorlagen = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const domainId = await requireEffectiveDomainId(supabase, userId);
    const { data, error } = await supabase
      .from("checklisten_vorlagen").select("*")
      .eq("domain_id", domainId)
      .order("name");
    if (error) throw new Error(error.message);
    return { vorlagen: data ?? [] };
  });

export const saveChecklistenVorlage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => vorlageSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const domainId = await requireEffectiveDomainId(supabase, userId);
    if (data.id) {
      const { error } = await supabase
        .from("checklisten_vorlagen")
        .update({
          name: data.name,
          einsatz_typ: data.einsatz_typ,
          punkte: data.punkte,
          aktiv: data.aktiv,
        })
        .eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase
        .from("checklisten_vorlagen")
        .insert({
          domain_id: domainId,
          name: data.name,
          einsatz_typ: data.einsatz_typ,
          punkte: data.punkte,
          aktiv: data.aktiv,
          created_by: userId,
        });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const deleteChecklistenVorlage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { error } = await supabase.from("checklisten_vorlagen").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listEinsatzChecklisten = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ einsatz_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireEffectiveDomainId(supabase, userId);
    const { data: rows, error } = await supabase
      .from("einsatz_checklisten").select("*")
      .eq("einsatz_id", data.einsatz_id)
      .order("created_at");
    if (error) throw new Error(error.message);
    return { checklisten: rows ?? [] };
  });

export const startEinsatzCheckliste = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ einsatz_id: z.string().uuid(), vorlage_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const domainId = await requireEffectiveDomainId(supabase, userId);

    // Bereits laufende Checkliste derselben Vorlage wiederverwenden
    const { data: existing } = await supabase
      .from("einsatz_checklisten").select("*")
      .eq("einsatz_id", data.einsatz_id)
      .eq("vorlage_id", data.vorlage_id)
      .eq("abgeschlossen", false)
      .maybeSingle();
    if (existing) return existing;

    const { data: vorlage, error: vErr } = await supabase
      .from("checklisten_vorlagen").select("*")
      .eq("id", data.vorlage_id).maybeSingle();
    if (vErr || !vorlage) throw new Error("Vorlage nicht gefunden");

    const punkte = (vorlage.punkte as CheckPunkt[]).map((p) => ({
      text: p.text,
      required: !!p.required,
      checked: false,
      checked_at: null,
    }));

    const { data: row, error } = await supabase
      .from("einsatz_checklisten")
      .insert({
        domain_id: domainId,
        einsatz_id: data.einsatz_id,
        vorlage_id: data.vorlage_id,
        vorlage_name: vorlage.name,
        punkte,
        created_by: userId,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const toggleChecklistenPunkt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), index: z.number().int().min(0), checked: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireEffectiveDomainId(supabase, userId);
    const { data: row, error } = await supabase
      .from("einsatz_checklisten").select("*").eq("id", data.id).maybeSingle();
    if (error || !row) throw new Error("Checkliste nicht gefunden");
    if (row.abgeschlossen) throw new Error("Checkliste ist bereits abgeschlossen");
    const punkte = [...(row.punkte as CheckPunkt[])];
    if (!punkte[data.index]) throw new Error("Punkt nicht gefunden");
    punkte[data.index] = {
      ...punkte[data.index],
      checked: data.checked,
      checked_at: data.checked ? new Date().toISOString() : null,
    };
    const { error: upErr } = await supabase
      .from("einsatz_checklisten").update({ punkte }).eq("id", data.id);
    if (upErr) throw new Error(upErr.message);
    return { ok: true, punkte };
  });

export const completeEinsatzCheckliste = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireEffectiveDomainId(supabase, userId);
    const { data: row, error } = await supabase
      .from("einsatz_checklisten").select("*").eq("id", data.id).maybeSingle();
    if (error || !row) throw new Error("Checkliste nicht gefunden");
    if (row.abgeschlossen) return { ok: true };
    const punkte = row.punkte as CheckPunkt[];
    const fehlen = punkte
      .filter((p) => p.required && !p.checked)
      .map((p) => p.text);
    if (fehlen.length > 0) {
      throw new Error(`Pflichtpunkte offen: ${fehlen.join(" · ")}`);
    }
    const { error: upErr } = await supabase
      .from("einsatz_checklisten")
      .update({
        abgeschlossen: true,
        abgeschlossen_am: new Date().toISOString(),
        abgeschlossen_by: userId,
      })
      .eq("id", data.id);
    if (upErr) throw new Error(upErr.message);
    return { ok: true };
  });

export const getEinsatzChecklistenStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ einsatz_ids: z.array(z.string().uuid()).max(200) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireEffectiveDomainId(supabase, userId);
    if (data.einsatz_ids.length === 0) return { status: {} as Record<string, { offen: number; erledigt: number }> };
    const { data: rows, error } = await supabase
      .from("einsatz_checklisten").select("einsatz_id, abgeschlossen")
      .in("einsatz_id", data.einsatz_ids);
    if (error) throw new Error(error.message);
    const status: Record<string, { offen: number; erledigt: number }> = {};
    for (const id of data.einsatz_ids) status[id] = { offen: 0, erledigt: 0 };
    for (const r of rows ?? []) {
      const s = status[(r as any).einsatz_id];
      if (!s) continue;
      if ((r as any).abgeschlossen) s.erledigt += 1; else s.offen += 1;
    }
    return { status };
  });

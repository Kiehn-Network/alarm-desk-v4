import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type DienstTelefon = { id: string; name: string; nummer: string; aktiv: boolean };

export const listDienstTelefone = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ data, error }, { data: me }] = await Promise.all([
      supabase.from("dienst_telefone").select("id, name, nummer, aktiv").order("name"),
      supabase.from("profiles").select("dienst_telefon_id").eq("id", userId).maybeSingle(),
    ]);
    if (error) throw new Error(error.message);
    return { telefone: (data ?? []) as DienstTelefon[], selectedId: (me as any)?.dienst_telefon_id ?? null };
  });

export const saveDienstTelefon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    id: z.string().uuid().optional(),
    name: z.string().trim().min(1).max(80),
    nummer: z.string().trim().min(3).max(40),
    aktiv: z.boolean().default(true),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { getEffectiveDomainId } = await import("@/lib/tenant.server");
    const domainId = await getEffectiveDomainId(supabase, userId);
    if (!domainId) throw new Error("Keine Domain aktiv");
    const row = { name: data.name, nummer: data.nummer, aktiv: data.aktiv };
    const { error } = data.id
      ? await supabase.from("dienst_telefone").update(row).eq("id", data.id)
      : await supabase.from("dienst_telefone").insert({ ...row, domain_id: domainId });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteDienstTelefon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("dienst_telefone").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const selectMyDienstTelefon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid().nullable() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.id) {
      // RLS ensures only phones of the own domain are visible.
      const { data: t } = await supabase.from("dienst_telefone").select("id").eq("id", data.id).eq("aktiv", true).maybeSingle();
      if (!t) throw new Error("Telefon nicht gefunden");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("profiles").update({ dienst_telefon_id: data.id } as any).eq("id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const createSchema = z.object({
  filename: z.string().min(1).max(255),
  storage_path: z.string().min(1).max(500),
  mime_type: z.string().max(150).optional().nullable(),
  size_bytes: z.number().int().nonnegative().optional().nullable(),
  address: z.string().max(255).optional().nullable(),
  key_number: z.string().max(100).optional().nullable(),
  folder: z.string().max(100).optional().nullable(),
  kunden_name: z.string().max(200).optional().nullable(),
  notiz: z.string().max(2000).optional().nullable(),
  teilnehmer_id: z.string().max(100).optional().nullable(),
  anlagen_nr: z.string().max(100).optional().nullable(),
});

const updateSchema = createSchema.partial().extend({ id: z.string().uuid() });

export const listDateien = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data: dateien, error } = await supabase
      .from("dateien")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);

    const { data: links } = await supabase
      .from("datei_verknuepfungen")
      .select("*");

    return { dateien: dateien ?? [], links: links ?? [] };
  });

export const createDatei = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => createSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("dateien")
      .insert({ ...data, uploaded_by: userId })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateDatei = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => updateSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { id, ...patch } = data;
    const { data: row, error } = await supabase
      .from("dateien").update(patch).eq("id", id).select().single();
    if (error) throw new Error(error.message);
    return row;
  });

export const softDeleteDatei = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ id: z.string().uuid(), reason: z.string().max(500).optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("dateien")
      .update({ deleted_at: new Date().toISOString(), deleted_by: userId, deleted_reason: data.reason ?? null })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const linkDateien = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ a: z.string().uuid(), b: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.a === data.b) throw new Error("Datei kann nicht mit sich selbst verknüpft werden");
    const [a, b] = [data.a, data.b].sort();
    const { data: row, error } = await supabase
      .from("datei_verknuepfungen")
      .insert({ datei_a_id: a, datei_b_id: b, created_by: userId })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const unlinkDateien = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("datei_verknuepfungen").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getDateiSignedUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ storage_path: z.string().min(1) }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: signed, error } = await supabase.storage
      .from("dateien")
      .createSignedUrl(data.storage_path, 60);
    if (error) throw new Error(error.message);
    return { url: signed.signedUrl };
  });
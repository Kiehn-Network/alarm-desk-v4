import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireEffectiveDomainId } from "@/lib/tenant.server";

const attachmentSchema = z.object({
  path: z.string().min(1).max(500),
  name: z.string().min(1).max(255),
  mime: z.string().max(150).optional().nullable(),
  size: z.number().int().nonnegative().optional().nullable(),
});

const createSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().max(50000).default(""),
  attachments: z.array(attachmentSchema).max(20).default([]),
});

const updateSchema = createSchema.partial().extend({ id: z.string().uuid() });

export const listIntrahubPosts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("intrahub_posts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    const ids = Array.from(new Set((data ?? []).map((p: any) => p.created_by).filter(Boolean))) as string[];
    let profiles: Record<string, { display_name: string | null; avatar_url: string | null }> = {};
    if (ids.length > 0) {
      const { data: ps } = await supabase.from("profiles").select("id, display_name, avatar_url").in("id", ids);
      profiles = Object.fromEntries((ps ?? []).map((p: any) => [p.id, { display_name: p.display_name, avatar_url: p.avatar_url }]));
    }
    return { posts: (data ?? []).map((p: any) => ({ ...p, author: profiles[p.created_by] ?? null })) };
  });

export const createIntrahubPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => createSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const domainId = await requireEffectiveDomainId(supabase, userId);
    const { data: row, error } = await supabase
      .from("intrahub_posts")
      .insert({
        domain_id: domainId,
        created_by: userId,
        title: data.title,
        content: data.content ?? "",
        attachments: data.attachments ?? [],
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateIntrahubPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => updateSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { id, ...patch } = data;
    const { data: row, error } = await supabase
      .from("intrahub_posts").update(patch).eq("id", id).select().single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteIntrahubPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("intrahub_posts").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
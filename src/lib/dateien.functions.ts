import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireEffectiveDomainId } from "@/lib/tenant.server";

const createSchema = z.object({
  filename: z.string().min(1).max(255),
  storage_path: z.string().min(1).max(500).optional().nullable(),
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
    // Paginierte Abfrage, um den Supabase-Default von 1000 Zeilen zu umgehen
    const pageSize = 1000;
    let from = 0;
    const all: any[] = [];
    while (true) {
      const { data, error } = await supabase
        .from("dateien")
        .select("*")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .range(from, from + pageSize - 1);
      if (error) throw new Error(error.message);
      if (!data || data.length === 0) break;
      all.push(...data);
      if (data.length < pageSize) break;
      from += pageSize;
    }
    const dateien = all;

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
    const domainId = await requireEffectiveDomainId(supabase, userId);
    const { data: row, error } = await supabase
      .from("dateien")
      .insert({ ...data, uploaded_by: userId, domain_id: domainId })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateDatei = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => updateSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const domainId = await requireEffectiveDomainId(supabase, userId);
    const { id, ...patch } = data;
    const { data: before, error: beforeErr } = await supabase
      .from("dateien").select("*").eq("id", id).single();
    if (beforeErr) throw new Error(beforeErr.message);
    const { data: row, error } = await supabase
      .from("dateien").update(patch).eq("id", id).select().single();
    if (error) throw new Error(error.message);

    const trackable = [
      "filename","address","key_number","folder","kunden_name",
      "notiz","teilnehmer_id","anlagen_nr",
    ] as const;
    const entries = trackable
      .filter((k) => k in patch)
      .map((k) => ({
        datei_id: id,
        field_name: k,
        old_value: (before as any)?.[k] ?? null,
        new_value: (patch as any)[k] ?? null,
        changed_by: userId,
        domain_id: domainId,
      }))
      .filter((e) => (e.old_value ?? null) !== (e.new_value ?? null));
    if (entries.length > 0) {
      await supabase.from("datei_historie").insert(entries);
    }
    return row;
  });

export const listDateiHistorie = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ datei_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: entries, error } = await supabase
      .from("datei_historie")
      .select("*")
      .eq("datei_id", data.datei_id)
      .order("changed_at", { ascending: false });
    if (error) throw new Error(error.message);

    const userIds = Array.from(new Set((entries ?? []).map((e) => e.changed_by).filter(Boolean))) as string[];
    let profiles: Record<string, string> = {};
    if (userIds.length > 0) {
      const { data: ps } = await supabase
        .from("profiles").select("id, display_name").in("id", userIds);
      profiles = Object.fromEntries((ps ?? []).map((p) => [p.id, p.display_name ?? ""]));
    }
    return { entries: (entries ?? []).map((e) => ({ ...e, changed_by_name: e.changed_by ? profiles[e.changed_by] ?? null : null })) };
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
    const domainId = await requireEffectiveDomainId(supabase, userId);
    if (data.a === data.b) throw new Error("Datei kann nicht mit sich selbst verknüpft werden");
    const [a, b] = [data.a, data.b].sort();
    const { data: row, error } = await supabase
      .from("datei_verknuepfungen")
      .insert({ datei_a_id: a, datei_b_id: b, created_by: userId, domain_id: domainId })
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
    // Verify the caller is permitted to see this storage_path via the
    // RLS-protected dateien table. If no row is visible, deny.
    const { data: row } = await supabase
      .from("dateien")
      .select("id")
      .eq("storage_path", data.storage_path)
      .maybeSingle();
    if (!row) throw new Error("Datei nicht gefunden oder kein Zugriff");
    // Issue a short-lived HMAC token pointing to our own proxy route.
    // This hides the Supabase storage URL from clients.
    const { signFileToken } = await import("@/lib/file-proxy.server");
    const token = await signFileToken(data.storage_path, 60);
    return { url: `/api/public/files/get?t=${encodeURIComponent(token)}` };
  });

export const softDeleteDateienBulk = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      ids: z.array(z.string().uuid()).min(1).max(5000).optional(),
      kunden_name: z.string().max(200).optional(),
      all: z.boolean().optional(),
      reason: z.string().max(500).optional(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const domainId = await requireEffectiveDomainId(supabase, userId);
    const { data: roles } = await supabaseAdmin
      .from("user_roles").select("role, domain_id").eq("user_id", userId);
    const isAllowed = (roles ?? []).some((r: any) =>
      r.role === "superadmin" || (r.role === "admin" && r.domain_id === domainId));
    if (!isAllowed) throw new Error("Nur Domänen-Admins können Dateien löschen");

    // Resolve IDs (always domain-scoped, only not-yet-deleted rows)
    let ids: string[] = [];
    const base = supabase.from("dateien").select("id").eq("domain_id", domainId).is("deleted_at", null);
    if (data.all) {
      const { data: rows, error } = await base;
      if (error) throw new Error(error.message);
      ids = (rows ?? []).map((r: any) => r.id);
    } else if (data.kunden_name !== undefined) {
      const name = (data.kunden_name ?? "").trim();
      const q = name.length === 0
        ? supabase.from("dateien").select("id").eq("domain_id", domainId).is("deleted_at", null).or("kunden_name.is.null,kunden_name.eq.")
        : supabase.from("dateien").select("id").eq("domain_id", domainId).is("deleted_at", null).eq("kunden_name", name);
      const { data: rows, error } = await q;
      if (error) throw new Error(error.message);
      ids = (rows ?? []).map((r: any) => r.id);
    } else if (data.ids && data.ids.length > 0) {
      const { data: rows, error } = await supabase
        .from("dateien").select("id").eq("domain_id", domainId).is("deleted_at", null).in("id", data.ids);
      if (error) throw new Error(error.message);
      ids = (rows ?? []).map((r: any) => r.id);
    }
    if (ids.length === 0) return { ok: true, deleted: 0 };

    const CHUNK = 200;
    const nowIso = new Date().toISOString();
    let deleted = 0;
    for (let i = 0; i < ids.length; i += CHUNK) {
      const slice = ids.slice(i, i + CHUNK);
      const { error } = await supabase
        .from("dateien")
        .update({ deleted_at: nowIso, deleted_by: userId, deleted_reason: data.reason ?? null })
        .in("id", slice);
      if (error) throw new Error(error.message);
      deleted += slice.length;
    }
    return { ok: true, deleted };
  });

// ------------------------------------------------------------
// Duplikat-Erkennung (Kunden + Dateien) für Domänen-Admins
// ------------------------------------------------------------

function normalizeText(v: string | null | undefined): string {
  return (v ?? "")
    .toString()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\s\-_,.]+/g, " ")
    .trim();
}

async function assertDomainAdmin(userId: string, domainId: string) {
  const { data: roles } = await supabaseAdmin
    .from("user_roles").select("role, domain_id").eq("user_id", userId);
  const ok = (roles ?? []).some((r: any) =>
    r.role === "superadmin" || (r.role === "admin" && r.domain_id === domainId));
  if (!ok) throw new Error("Nur Domänen-Admins dürfen Duplikate verwalten");
}

export const findDuplikate = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const domainId = await requireEffectiveDomainId(supabase, userId);
    await assertDomainAdmin(userId, domainId);

    // Alle nicht-gelöschten Dateien der Domäne laden (paginiert)
    const pageSize = 1000;
    let from = 0;
    const all: any[] = [];
    while (true) {
      const { data, error } = await supabase
        .from("dateien")
        .select("id, filename, size_bytes, kunden_name, address, key_number, anlagen_nr, storage_path, created_at")
        .is("deleted_at", null)
        .order("created_at", { ascending: true })
        .range(from, from + pageSize - 1);
      if (error) throw new Error(error.message);
      if (!data || data.length === 0) break;
      all.push(...data);
      if (data.length < pageSize) break;
      from += pageSize;
    }

    // --- Kunden-Duplikate: normalisiert (Name + Adresse) ---
    type Variant = { kunden_name: string; address: string | null; count: number; ids: string[] };
    const kMap = new Map<string, Map<string, Variant>>();
    for (const d of all) {
      const rawName = (d.kunden_name ?? "").trim();
      if (!rawName) continue;
      const key = `${normalizeText(rawName)}|${normalizeText(d.address)}`;
      if (!kMap.has(key)) kMap.set(key, new Map());
      const vMap = kMap.get(key)!;
      const vKey = `${rawName}|${d.address ?? ""}`;
      const v: Variant = vMap.get(vKey) ?? { kunden_name: rawName, address: d.address ?? null, count: 0, ids: [] };
      v.count += 1;
      v.ids.push(d.id);
      vMap.set(vKey, v);
    }
    const kundenGroups = Array.from(kMap.entries())
      .map(([key, vMap]) => ({
        key,
        variants: Array.from(vMap.values()).sort((a, b) => b.count - a.count),
      }))
      .filter((g) => g.variants.length > 1)
      .sort((a, b) => (b.variants.reduce((s, v) => s + v.count, 0)) - (a.variants.reduce((s, v) => s + v.count, 0)));

    // --- Datei-Duplikate: gleiche Größe + normalisierter Dateiname ---
    const dMap = new Map<string, any[]>();
    for (const d of all) {
      if (!d.size_bytes || d.size_bytes <= 0) continue;
      const key = `${d.size_bytes}|${normalizeText(d.filename)}`;
      if (!dMap.has(key)) dMap.set(key, []);
      dMap.get(key)!.push(d);
    }
    const dateiGroups = Array.from(dMap.entries())
      .filter(([, items]) => items.length > 1)
      .map(([key, items]) => ({
        key,
        size_bytes: items[0].size_bytes as number,
        filename: items[0].filename as string,
        items: items.map((x) => ({
          id: x.id,
          filename: x.filename,
          size_bytes: x.size_bytes,
          kunden_name: x.kunden_name,
          address: x.address,
          key_number: x.key_number,
          anlagen_nr: x.anlagen_nr,
          created_at: x.created_at,
          storage_path: x.storage_path,
        })),
      }))
      .sort((a, b) => b.items.length - a.items.length);

    return {
      kundenGroups,
      dateiGroups,
      totalFiles: all.length,
    };
  });
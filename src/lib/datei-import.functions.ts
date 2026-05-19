import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireEffectiveDomainId } from "@/lib/tenant.server";

const rowSchema = z.object({
  filename: z.string().min(1).max(255),
  address: z.string().max(500).optional().nullable(),
  key_number: z.string().max(100).optional().nullable(),
  folder: z.string().max(100).optional().nullable(),
  kunden_name: z.string().max(200).optional().nullable(),
  notiz: z.string().max(5000).optional().nullable(),
  teilnehmer_id: z.string().max(100).optional().nullable(),
  anlagen_nr: z.string().max(100).optional().nullable(),
});

const inputSchema = z.object({
  rows: z.array(rowSchema).min(1).max(5000),
  duplicate_strategy: z.enum(["skip", "overwrite", "insert"]),
});

async function assertAdmin(supabase: any, userId: string, domainId: string) {
  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  const has = (roles ?? []).some(
    (r: any) => r.role === "admin" || r.role === "superadmin",
  );
  if (!has) throw new Error("Nur Admins dürfen importieren.");
  return domainId;
}

export const importDateien = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => inputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const domainId = await requireEffectiveDomainId(supabase, userId);
    await assertAdmin(supabase, userId, domainId);

    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    const errors: { row: number; message: string }[] = [];

    for (let i = 0; i < data.rows.length; i++) {
      const r = data.rows[i];
      try {
        const dupKey = r.anlagen_nr || r.teilnehmer_id;
        let existing: any = null;
        if (dupKey && data.duplicate_strategy !== "insert") {
          const q = supabase
            .from("dateien")
            .select("id")
            .eq("domain_id", domainId)
            .is("deleted_at", null);
          if (r.anlagen_nr) q.eq("anlagen_nr", r.anlagen_nr);
          else if (r.teilnehmer_id) q.eq("teilnehmer_id", r.teilnehmer_id);
          const { data: found } = await q.limit(1).maybeSingle();
          existing = found;
        }

        if (existing && data.duplicate_strategy === "skip") {
          skipped++;
          continue;
        }
        if (existing && data.duplicate_strategy === "overwrite") {
          const { error } = await supabase
            .from("dateien")
            .update({
              filename: r.filename,
              address: r.address ?? null,
              key_number: r.key_number ?? null,
              folder: r.folder ?? null,
              kunden_name: r.kunden_name ?? null,
              notiz: r.notiz ?? null,
              teilnehmer_id: r.teilnehmer_id ?? null,
              anlagen_nr: r.anlagen_nr ?? null,
            })
            .eq("id", existing.id);
          if (error) throw new Error(error.message);
          updated++;
          continue;
        }
        const { error } = await supabase.from("dateien").insert({
          filename: r.filename,
          address: r.address ?? null,
          key_number: r.key_number ?? null,
          folder: r.folder ?? null,
          kunden_name: r.kunden_name ?? null,
          notiz: r.notiz ?? null,
          teilnehmer_id: r.teilnehmer_id ?? null,
          anlagen_nr: r.anlagen_nr ?? null,
          uploaded_by: userId,
          domain_id: domainId,
        });
        if (error) throw new Error(error.message);
        inserted++;
      } catch (e: any) {
        errors.push({ row: i + 1, message: e?.message ?? String(e) });
      }
    }

    return { inserted, updated, skipped, errors, total: data.rows.length };
  });
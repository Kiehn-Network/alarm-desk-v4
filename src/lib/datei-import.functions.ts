import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireEffectiveDomainId } from "@/lib/tenant.server";

const rowSchema = z.object({
  legacy_id: z.string().max(100).optional().nullable(),
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
        const dupKey = r.legacy_id || r.anlagen_nr || r.teilnehmer_id;
        let existing: any = null;
        if (dupKey && data.duplicate_strategy !== "insert") {
          const q = supabase
            .from("dateien")
            .select("id")
            .eq("domain_id", domainId)
            .is("deleted_at", null);
          if (r.legacy_id) q.eq("legacy_id", r.legacy_id);
          else if (r.anlagen_nr) q.eq("anlagen_nr", r.anlagen_nr);
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
              legacy_id: r.legacy_id ?? null,
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
          legacy_id: r.legacy_id ?? null,
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

// =====================================================================
// Bulk-Datei-Upload: ordnet hochgeladene Storage-Dateien anhand
// Dateiname / Anlagen-Nr / Teilnehmer-ID den bestehenden `dateien`-Eintraegen zu.
// Bei bereits vorhandener Storage-Datei wird eine neue Version angelegt
// und ueber `datei_verknuepfungen` mit dem Original verbunden.
// =====================================================================

const fileSchema = z.object({
  upload_filename: z.string().min(1).max(500),
  storage_path: z.string().min(1).max(500),
  mime_type: z.string().max(150).optional().nullable(),
  size_bytes: z.number().int().nonnegative().optional().nullable(),
});

const attachSchema = z.object({
  files: z.array(fileSchema).min(1).max(2000),
});

function normalize(s: string | null | undefined) {
  return (s ?? "").toLowerCase().trim();
}
function stripExt(name: string) {
  const i = name.lastIndexOf(".");
  return i > 0 ? name.slice(0, i) : name;
}

export const attachFilesToDateien = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => attachSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const domainId = await requireEffectiveDomainId(supabase, userId);
    await assertAdmin(supabase, userId, domainId);

    // Bestehende dateien-Eintraege der Domaene laden (paginiert)
    const pageSize = 1000;
    let from = 0;
    const dateien: any[] = [];
    while (true) {
      const { data: page, error } = await supabase
        .from("dateien")
        .select("id, filename, anlagen_nr, teilnehmer_id, storage_path")
        .eq("domain_id", domainId)
        .is("deleted_at", null)
        .range(from, from + pageSize - 1);
      if (error) throw new Error(error.message);
      if (!page || page.length === 0) break;
      dateien.push(...page);
      if (page.length < pageSize) break;
      from += pageSize;
    }

    // Indizes vorbereiten
    const byFilename = new Map<string, any[]>();
    const byFilenameNoExt = new Map<string, any[]>();
    const withKeys: { row: any; anlagen?: string; teilnehmer?: string }[] = [];
    for (const r of dateien) {
      const fn = normalize(r.filename);
      if (fn) {
        const arr = byFilename.get(fn) ?? [];
        arr.push(r);
        byFilename.set(fn, arr);
        const ne = stripExt(fn);
        const arr2 = byFilenameNoExt.get(ne) ?? [];
        arr2.push(r);
        byFilenameNoExt.set(ne, arr2);
      }
      const an = normalize(r.anlagen_nr);
      const tn = normalize(r.teilnehmer_id);
      if (an || tn) withKeys.push({ row: r, anlagen: an || undefined, teilnehmer: tn || undefined });
    }

    let matched = 0;
    let versioned = 0;
    let attached = 0;
    const unmatched: { filename: string; storage_path: string }[] = [];
    const errors: { filename: string; message: string }[] = [];

    for (const f of data.files) {
      try {
        const baseRaw = f.upload_filename.split(/[\\/]/).pop() || f.upload_filename;
        const base = normalize(baseRaw);
        const baseNoExt = stripExt(base);

        // 1) Exakter Dateiname
        let candidates = byFilename.get(base) ?? byFilenameNoExt.get(baseNoExt) ?? [];
        // 2) Fallback: Anlagen-Nr / Teilnehmer-ID kommt im Upload-Namen vor
        if (candidates.length === 0) {
          const fallback: any[] = [];
          for (const wk of withKeys) {
            if (wk.anlagen && base.includes(wk.anlagen)) fallback.push(wk.row);
            else if (wk.teilnehmer && base.includes(wk.teilnehmer)) fallback.push(wk.row);
          }
          candidates = fallback;
        }

        if (candidates.length === 0) {
          unmatched.push({ filename: baseRaw, storage_path: f.storage_path });
          continue;
        }

        // Bei mehreren Treffern: ersten ohne Storage bevorzugen, sonst ersten
        const target =
          candidates.find((c) => !c.storage_path) ?? candidates[0];

        matched++;

        if (!target.storage_path) {
          // Storage anhaengen
          const { error: upErr } = await supabase
            .from("dateien")
            .update({
              storage_path: f.storage_path,
              mime_type: f.mime_type ?? null,
              size_bytes: f.size_bytes ?? null,
              filename: baseRaw, // Originalname uebernehmen, falls vorher Platzhalter
            })
            .eq("id", target.id);
          if (upErr) throw new Error(upErr.message);
          await supabase.from("datei_historie").insert({
            datei_id: target.id,
            field_name: "storage_path",
            old_value: null,
            new_value: f.storage_path,
            changed_by: userId,
            domain_id: domainId,
          });
          // lokal aktualisieren, damit weitere Uploads ggf. Version anlegen
          target.storage_path = f.storage_path;
          attached++;
        } else {
          // Neue Version anlegen
          const { count } = await supabase
            .from("datei_verknuepfungen")
            .select("id", { count: "exact", head: true })
            .or(`datei_a_id.eq.${target.id},datei_b_id.eq.${target.id}`);
          const versionNr = (count ?? 0) + 2;

          const { data: full, error: fErr } = await supabase
            .from("dateien")
            .select("address, key_number, folder, kunden_name, notiz, teilnehmer_id, anlagen_nr")
            .eq("id", target.id)
            .single();
          if (fErr) throw new Error(fErr.message);

          const newName = `${stripExt(target.filename || baseRaw)} (v${versionNr})`;
          const { data: inserted, error: insErr } = await supabase
            .from("dateien")
            .insert({
              filename: newName,
              storage_path: f.storage_path,
              mime_type: f.mime_type ?? null,
              size_bytes: f.size_bytes ?? null,
              address: full?.address ?? null,
              key_number: full?.key_number ?? null,
              folder: full?.folder ?? null,
              kunden_name: full?.kunden_name ?? null,
              notiz: full?.notiz ?? null,
              teilnehmer_id: full?.teilnehmer_id ?? null,
              anlagen_nr: full?.anlagen_nr ?? null,
              uploaded_by: userId,
              domain_id: domainId,
            })
            .select("id")
            .single();
          if (insErr) throw new Error(insErr.message);

          // Verknuepfung Original <-> neue Version
          const [a, b] = [target.id, inserted!.id].sort();
          await supabase.from("datei_verknuepfungen").insert({
            datei_a_id: a,
            datei_b_id: b,
            created_by: userId,
            domain_id: domainId,
          });
          versioned++;
        }
      } catch (e: any) {
        errors.push({ filename: f.upload_filename, message: e?.message ?? String(e) });
      }
    }

    return {
      total: data.files.length,
      matched,
      attached,
      versioned,
      unmatched,
      errors,
    };
  });
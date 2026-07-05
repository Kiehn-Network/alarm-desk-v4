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

// =================================================================
// Geführter Testlauf — legt Demo-Schlüsseleinträge an, die man im
// UI durchklicken kann, und räumt sie wieder auf.
// Erkennung: key_number beginnt mit "DEMO-" und notiz beginnt mit "[DEMO]".
// =================================================================
const DEMO_PREFIX = "DEMO-";
const DEMO_NOTE = "[DEMO] Testlauf – kann gefahrlos gelöscht werden.";

export const seedSchluesselDemo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const domainId = await requireEffectiveDomainId(supabase, userId);

    // Bestehende Demo-Daten dieser Domain zuerst aufräumen (idempotent).
    await cleanupDemoInternal(domainId);

    // Demo-Einsatz anlegen
    const { data: einsatz, error: eErr } = await supabase
      .from("einsaetze")
      .insert({
        domain_id: domainId,
        einsatzgrund: "DEMO-Schlüsselbuch",
        kunden_name: "Demo-Kunde GmbH",
        address: "Musterweg 1, 12345 Musterstadt",
        prioritaet: "normal",
        beschreibung: "[DEMO] Nur für den geführten Testlauf",
        created_by: userId,
      })
      .select("id")
      .single();
    if (eErr) throw new Error(eErr.message);

    const now = new Date();
    const yesterday = new Date(now.getTime() - 26 * 60 * 60 * 1000);
    const twoDaysAgo = new Date(now.getTime() - 50 * 60 * 60 * 1000);

    // Eintrag 1: bereits als Rückgabe offen markiert (der Klick-Höhepunkt)
    const rows = [
      {
        domain_id: domainId,
        einsatz_id: einsatz.id,
        key_number: `${DEMO_PREFIX}RÜCKGABE`,
        kunden_name: "Demo-Kunde GmbH",
        address: "Musterweg 1, 12345 Musterstadt",
        traeger_name: "Demo-Träger Meier",
        status: "rueckgabe_offen" as const,
        ausgegeben_by: userId,
        ausgegeben_at: twoDaysAgo.toISOString(),
        uebernommen_at: twoDaysAgo.toISOString(),
        uebernommen_by: userId,
        rueckgabe_angefragt_at: yesterday.toISOString(),
        rueckgabe_angefragt_by: userId,
        notiz: DEMO_NOTE,
      },
      {
        domain_id: domainId,
        einsatz_id: einsatz.id,
        key_number: `${DEMO_PREFIX}OFFEN`,
        kunden_name: "Demo-Kunde GmbH",
        address: "Musterweg 1, 12345 Musterstadt",
        traeger_name: "Demo-Träger Schulz",
        status: "ausgegeben" as const,
        ausgegeben_by: userId,
        ausgegeben_at: now.toISOString(),
        notiz: DEMO_NOTE,
      },
    ];
    const { error: sErr } = await supabase.from("schluessel_buch").insert(rows);
    if (sErr) throw new Error(sErr.message);
    return { ok: true, einsatz_id: einsatz.id };
  });

export const cleanupSchluesselDemo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const domainId = await requireEffectiveDomainId(supabase, userId);
    await cleanupDemoInternal(domainId);
    return { ok: true };
  });

async function cleanupDemoInternal(domainId: string) {
  // Alle Demo-Schlüsseleinträge dieser Domain löschen
  await supabaseAdmin
    .from("schluessel_buch")
    .delete()
    .eq("domain_id", domainId)
    .like("key_number", `${DEMO_PREFIX}%`);
  // Demo-Einsätze dieser Domain löschen
  await supabaseAdmin
    .from("einsaetze")
    .delete()
    .eq("domain_id", domainId)
    .eq("einsatzgrund", "DEMO-Schlüsselbuch");
}

// =================================================================
// Rückgabe-offen-Reminder — verschickt Erinnerungen, wenn der
// Status "rueckgabe_offen" länger als 1 Tag besteht. Aufruf via
// pg_cron → /api/public/hooks/schluessel-rueckgabe-reminder
// =================================================================
export async function runSchluesselRueckgabeReminders() {
  const now = new Date();
  const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

  const { data: rows, error } = await supabaseAdmin
    .from("schluessel_buch")
    .select("id, domain_id, key_number, kunden_name, address, traeger_name, rueckgabe_angefragt_at")
    .eq("status", "rueckgabe_offen")
    .not("rueckgabe_angefragt_at", "is", null)
    .lt("rueckgabe_angefragt_at", cutoff);
  if (error) throw new Error(error.message);
  if (!rows || rows.length === 0) return { ok: true, checked: 0, sent: 0 };

  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const tag = "schluessel_rueckgabe_reminder";

  // Empfänger pro Domain cachen
  const domainRecipients = new Map<string, { name: string | null; emails: string[] }>();
  const { data: authList } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const usersById = new Map<string, string>();
  (authList?.users ?? []).forEach((u) => { if (u.email) usersById.set(u.id, u.email); });

  let sent = 0;
  for (const r of rows as any[]) {
    // Dedupe: nur einmal pro Tag pro Schlüsseleintrag
    const { data: dupe } = await supabaseAdmin
      .from("email_send_log")
      .select("id")
      .eq("template_name", tag)
      .gte("created_at", todayStart)
      .contains("metadata", { schluessel_id: r.id })
      .limit(1)
      .maybeSingle();
    if (dupe) continue;

    let bucket = domainRecipients.get(r.domain_id);
    if (!bucket) {
      const { data: dom } = await supabaseAdmin
        .from("domains").select("name").eq("id", r.domain_id).maybeSingle();
      const { data: roles } = await supabaseAdmin
        .from("user_roles").select("user_id")
        .eq("domain_id", r.domain_id)
        .in("role", ["admin", "dispatcher"]);
      const emails = Array.from(new Set(
        (roles ?? []).map((x: any) => usersById.get(x.user_id)).filter(Boolean) as string[],
      ));
      bucket = { name: (dom as any)?.name ?? null, emails };
      domainRecipients.set(r.domain_id, bucket);
    }
    if (bucket.emails.length === 0) continue;

    const offenSeit = Math.max(
      1,
      Math.floor((now.getTime() - new Date(r.rueckgabe_angefragt_at).getTime()) / 86400000),
    );

    for (const recipient of bucket.emails) {
      const payload = {
        recipient,
        template: tag,
        subject: `Schlüssel-Rückgabe offen seit ${offenSeit} Tag(en) — ${r.key_number}`,
        data: {
          domain: bucket.name,
          schluessel_id: r.id,
          key_number: r.key_number,
          kunden_name: r.kunden_name,
          address: r.address,
          traeger_name: r.traeger_name,
          rueckgabe_angefragt_at: r.rueckgabe_angefragt_at,
          offen_seit_tage: offenSeit,
        },
      };
      const { error: enqErr } = await supabaseAdmin.rpc("enqueue_email", {
        queue_name: "transactional_emails",
        payload,
      });
      await supabaseAdmin.from("email_send_log").insert({
        template_name: tag,
        recipient_email: recipient,
        status: enqErr ? "failed" : "pending",
        error_message: enqErr?.message ?? null,
        metadata: {
          schluessel_id: r.id,
          domain_id: r.domain_id,
          offen_seit_tage: offenSeit,
          queue_name: "transactional_emails",
          payload,
        },
      });
      if (!enqErr) sent++;
    }
  }
  return { ok: true, checked: rows.length, sent };
}
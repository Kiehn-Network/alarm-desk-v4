import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireEffectiveDomainId } from "@/lib/tenant.server";
import { buildErpPayload, enqueueErpForEinsatz, processErpOutboxItem } from "@/lib/esrp.server";

async function isDomainAdmin(userId: string, domainId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles").select("role,domain_id")
    .eq("user_id", userId).in("role", ["admin", "superadmin"]);
  return (data ?? []).some(
    (r: any) => r.role === "superadmin" || r.domain_id === domainId,
  );
}

function maskToken(t: string | null | undefined) {
  if (!t) return "";
  if (t.length <= 4) return "••••";
  return "••••" + t.slice(-4);
}

export const getEsrpSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const domainId = await requireEffectiveDomainId(supabase, userId);
    const { data } = await supabaseAdmin
      .from("erp_settings").select("*").eq("domain_id", domainId).maybeSingle();
    const admin = await isDomainAdmin(userId, domainId);
    const base = data ?? {
      domain_id: domainId,
      api_base: "",
      api_user: "",
      api_token: "",
      endpoint_path: "/azs-av-einsaetze",
      use_api_prefix: false,
      aktiv: false,
      auto_on_abschluss: true,
    };
    return {
      ...base,
      api_token: admin ? base.api_token : maskToken(base.api_token),
      _is_admin: admin,
    };
  });

const updateSchema = z.object({
  api_base: z.string().trim().max(500),
  api_user: z.string().trim().max(200),
  api_token: z.string().trim().max(500).optional(),
  endpoint_path: z.string().trim().min(1).max(200),
  use_api_prefix: z.boolean(),
  aktiv: z.boolean(),
  auto_on_abschluss: z.boolean(),
});

export const updateEsrpSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => updateSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const domainId = await requireEffectiveDomainId(supabase, userId);
    if (!(await isDomainAdmin(userId, domainId))) {
      throw new Error("Nur Admins dürfen ESRP-Einstellungen ändern");
    }
    const patch: any = {
      domain_id: domainId,
      api_base: data.api_base,
      api_user: data.api_user,
      endpoint_path: data.endpoint_path,
      use_api_prefix: data.use_api_prefix,
      aktiv: data.aktiv,
      auto_on_abschluss: data.auto_on_abschluss,
      updated_by: userId,
    };
    if (data.api_token !== undefined && data.api_token !== "") {
      patch.api_token = data.api_token;
    }
    const { error } = await supabaseAdmin
      .from("erp_settings").upsert(patch, { onConflict: "domain_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const enqueueEinsatzToErp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ einsatz_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const domainId = await requireEffectiveDomainId(supabase, userId);
    // Sicherstellen, dass der Einsatz zur Domäne gehört
    const { data: e } = await supabase
      .from("einsaetze").select("id,domain_id").eq("id", data.einsatz_id).maybeSingle();
    if (!e) throw new Error("Einsatz nicht gefunden");
    if (e.domain_id !== domainId) throw new Error("Einsatz gehört nicht zur Domäne");
    return enqueueErpForEinsatz({
      einsatz_id: data.einsatz_id,
      domain_id: domainId,
      created_by: userId,
    });
  });

export const retryErpOutbox = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ outbox_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const domainId = await requireEffectiveDomainId(supabase, userId);
    const { data: job } = await supabase
      .from("erp_outbox").select("id,domain_id,einsatz_id").eq("id", data.outbox_id).maybeSingle();
    if (!job) throw new Error("Job nicht gefunden");
    if (job.domain_id !== domainId) throw new Error("Job gehört nicht zur Domäne");
    const patch: any = {
      status: "pending", next_retry_at: null, last_error: null,
    };
    if (job.einsatz_id) {
      const { data: einsatz } = await supabaseAdmin
        .from("einsaetze")
        .select("*")
        .eq("id", job.einsatz_id)
        .maybeSingle();
      if (einsatz) {
        const payload = await buildErpPayload(einsatz);
        patch.payload = payload as any;
        patch.external_id = payload.einsatzId;
      }
    }
    await supabaseAdmin.from("erp_outbox").update(patch).eq("id", data.outbox_id);
    return processErpOutboxItem(data.outbox_id);
  });

export const listErpOutbox = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("erp_outbox").select("*")
      .order("created_at", { ascending: false }).limit(100);
    if (error) throw new Error(error.message);
    return { jobs: data ?? [] };
  });

export const processErpOutboxNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const domainId = await requireEffectiveDomainId(supabase, userId);
    if (!(await isDomainAdmin(userId, domainId))) {
      throw new Error("Nur Admins dürfen die Outbox manuell verarbeiten");
    }
    // Nur eigene Domain: IDs vorab filtern, dann pro Job verarbeiten
    const nowIso = new Date().toISOString();
    const { data: jobs } = await supabaseAdmin
      .from("erp_outbox")
      .select("id")
      .eq("domain_id", domainId)
      .in("status", ["pending", "failed"])
      .or(`next_retry_at.is.null,next_retry_at.lte.${nowIso}`)
      .order("created_at", { ascending: true })
      .limit(50);
    const results: { id: string; ok: boolean; error?: string }[] = [];
    for (const j of jobs ?? []) {
      const r = await processErpOutboxItem(j.id);
      results.push({ id: j.id, ...r });
    }
    return { processed: results.length, results };
  });

export const listEinsatzErpStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ einsatz_ids: z.array(z.string().uuid()).max(500) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    if (data.einsatz_ids.length === 0) return { status: {} as Record<string, any> };
    const { data: rows, error } = await context.supabase
      .from("erp_outbox")
      .select("einsatz_id,status,tries,last_error,sent_at,created_at")
      .in("einsatz_id", data.einsatz_ids)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const map: Record<string, any> = {};
    for (const r of rows ?? []) {
      if (!map[r.einsatz_id]) map[r.einsatz_id] = r;
    }
    return { status: map };
  });
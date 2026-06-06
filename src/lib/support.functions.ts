import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const StatusEnum = z.enum(["open", "in_progress", "closed"]);
const PriorityEnum = z.enum(["low", "normal", "high"]);

export const listSupportTickets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        status: z.union([StatusEnum, z.literal("all")]).optional(),
        domain_id: z.string().uuid().optional(),
      })
      .parse(i ?? {}),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("support_tickets")
      .select("id, domain_id, created_by, subject, status, priority, last_message_at, created_at")
      .order("last_message_at", { ascending: false })
      .limit(500);
    if (data.status && data.status !== "all") q = q.eq("status", data.status);
    if (data.domain_id) q = q.eq("domain_id", data.domain_id);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const tickets = rows ?? [];
    const domIds = Array.from(new Set(tickets.map((t) => t.domain_id)));
    const userIds = Array.from(new Set(tickets.map((t) => t.created_by)));
    const [{ data: doms }, { data: profs }] = await Promise.all([
      domIds.length
        ? context.supabase.from("domains").select("id, name, slug").in("id", domIds)
        : Promise.resolve({ data: [] as any[] }),
      userIds.length
        ? context.supabase.from("profiles").select("id, display_name").in("id", userIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);
    const dmap = new Map((doms ?? []).map((d: any) => [d.id, d]));
    const pmap = new Map((profs ?? []).map((p: any) => [p.id, p]));
    return tickets.map((t) => ({
      ...t,
      domain: dmap.get(t.domain_id) ?? null,
      creator: pmap.get(t.created_by) ?? null,
    }));
  });

export const getSupportTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: ticket, error } = await context.supabase
      .from("support_tickets")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!ticket) throw new Error("Ticket nicht gefunden");
    const { data: msgs } = await context.supabase
      .from("support_ticket_messages")
      .select("id, author_id, body, created_at")
      .eq("ticket_id", data.id)
      .order("created_at", { ascending: true });
    const ids = Array.from(
      new Set([ticket.created_by, ...(msgs ?? []).map((m) => m.author_id)]),
    );
    const { data: profs } = ids.length
      ? await context.supabase.from("profiles").select("id, display_name").in("id", ids)
      : { data: [] as any[] };
    const pmap = new Map((profs ?? []).map((p: any) => [p.id, p]));
    return {
      ticket: { ...ticket, creator: pmap.get(ticket.created_by) ?? null },
      messages: (msgs ?? []).map((m) => ({ ...m, author: pmap.get(m.author_id) ?? null })),
    };
  });

export const createSupportTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        subject: z.string().min(3).max(200),
        description: z.string().min(5).max(5000),
        priority: PriorityEnum.default("normal"),
        domain_id: z.string().uuid().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    let domainId = data.domain_id;
    if (!domainId) {
      const { data: prof } = await context.supabase
        .from("profiles")
        .select("domain_id")
        .eq("id", context.userId)
        .maybeSingle();
      domainId = prof?.domain_id ?? undefined;
    }
    if (!domainId) throw new Error("Kein Mandant zugeordnet");
    const { data: row, error } = await context.supabase
      .from("support_tickets")
      .insert({
        domain_id: domainId,
        created_by: context.userId,
        subject: data.subject,
        description: data.description,
        priority: data.priority,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await context.supabase.from("support_ticket_messages").insert({
      ticket_id: row.id,
      author_id: context.userId,
      body: data.description,
    });
    return { id: row.id };
  });

export const addSupportTicketMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ ticket_id: z.string().uuid(), body: z.string().min(1).max(5000) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("support_ticket_messages").insert({
      ticket_id: data.ticket_id,
      author_id: context.userId,
      body: data.body,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateSupportTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        id: z.string().uuid(),
        status: StatusEnum.optional(),
        priority: PriorityEnum.optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const patch: { status?: z.infer<typeof StatusEnum>; priority?: z.infer<typeof PriorityEnum> } = {};
    if (data.status) patch.status = data.status;
    if (data.priority) patch.priority = data.priority;
    if (!Object.keys(patch).length) return { ok: true };
    const { error } = await context.supabase
      .from("support_tickets")
      .update(patch)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getOpenTicketsCount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { count, error } = await context.supabase
      .from("support_tickets")
      .select("id", { count: "exact", head: true })
      .neq("status", "closed");
    if (error) throw new Error(error.message);
    return { count: count ?? 0 };
  });
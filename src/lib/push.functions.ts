import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getPushConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getVapidPublicKey } = await import("./push.server");
    const { data } = await context.supabase
      .from("profiles").select("push_einsaetze").eq("id", context.userId).maybeSingle();
    return { publicKey: getVapidPublicKey(), enabled: (data as any)?.push_einsaetze !== false };
  });

export const setPushPref = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ enabled: z.boolean() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("profiles").update({ push_einsaetze: data.enabled } as any).eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const savePushSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    endpoint: z.string().url(), p256dh: z.string().min(1), auth: z.string().min(1),
    user_agent: z.string().max(500).optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: prof } = await context.supabase
      .from("profiles").select("domain_id").eq("id", context.userId).maybeSingle();
    await supabaseAdmin.from("push_subscriptions").delete().eq("endpoint", data.endpoint);
    const { error } = await supabaseAdmin.from("push_subscriptions").insert({
      user_id: context.userId, domain_id: (prof as any)?.domain_id ?? null,
      endpoint: data.endpoint, p256dh: data.p256dh, auth: data.auth, user_agent: data.user_agent ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removePushSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ endpoint: z.string() }).parse(i))
  .handler(async ({ data, context }) => {
    await context.supabase.from("push_subscriptions").delete()
      .eq("endpoint", data.endpoint).eq("user_id", context.userId);
    return { ok: true };
  });

export const sendTestPush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { sendPushToUsers } = await import("./push.server");
    await sendPushToUsers([context.userId], {
      title: "AlarmDesk Test", body: "Push-Benachrichtigungen funktionieren.", url: "/profil",
    });
    return { ok: true };
  });

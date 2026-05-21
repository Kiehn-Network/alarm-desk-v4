import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const createSuperadmin = createServerFn({ method: "POST" })
  .inputValidator((i) =>
    z.object({
      token: z.string().min(1).max(200),
      email: z.string().email().max(255),
      password: z.string().min(8).max(72),
      display_name: z.string().trim().min(1).max(120),
    }).parse(i),
  )
  .handler(async ({ data }) => {
    const expected = process.env.SUPERADMIN_SETUP_TOKEN;
    if (!expected) throw new Error("Setup-Token nicht konfiguriert");
    if (data.token !== expected) throw new Error("Ungültiger Setup-Token");

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { display_name: data.display_name },
    });
    if (error) throw new Error(error.message);
    const uid = created.user!.id;

    await supabaseAdmin.from("profiles").update({ display_name: data.display_name }).eq("id", uid);
    // Ensure superadmin role (idempotent)
    await supabaseAdmin.from("user_roles").delete().eq("user_id", uid).eq("role", "superadmin");
    const { error: rErr } = await supabaseAdmin.from("user_roles").insert({
      user_id: uid, role: "superadmin", domain_id: null,
    });
    if (rErr) throw new Error(rErr.message);

    return { ok: true, id: uid };
  });
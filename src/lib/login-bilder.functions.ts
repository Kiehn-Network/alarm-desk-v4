import { createServerFn } from "@tanstack/react-start";

// Öffentlich: liefert kurzlebige Links zu den vom Superadmin hochgeladenen Login-Bildern.
export const getLoginBilder = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin.storage.from("login-bilder").list("", { limit: 50 });
    const files = (data ?? []).filter((f) => f.id && /\.(jpe?g|png|webp|gif|avif)$/i.test(f.name));
    if (!files.length) return [] as string[];
    const { data: signed } = await supabaseAdmin.storage
      .from("login-bilder")
      .createSignedUrls(files.map((f) => f.name), 60 * 60 * 6);
    return (signed ?? []).map((s) => s.signedUrl).filter((u): u is string => !!u);
  } catch {
    return [] as string[];
  }
});

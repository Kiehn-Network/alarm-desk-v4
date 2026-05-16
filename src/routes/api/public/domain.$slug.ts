import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/public/domain/$slug")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const slug = String(params.slug ?? "").trim().toLowerCase();
        if (!slug || !/^[a-z0-9_-]{1,64}$/.test(slug)) {
          return new Response(JSON.stringify({ ok: false }), {
            status: 404,
            headers: { "Content-Type": "application/json" },
          });
        }
        const { data: domain } = await supabaseAdmin
          .from("domains")
          .select("id, name, slug, status")
          .eq("slug", slug)
          .maybeSingle();
        if (!domain || domain.status !== "active") {
          return new Response(JSON.stringify({ ok: false }), {
            status: 404,
            headers: { "Content-Type": "application/json" },
          });
        }
        const { data: settings } = await supabaseAdmin
          .from("app_settings")
          .select("firmenname, logo_url, wartung_aktiv, wartung_nachricht, wartung_farbe")
          .eq("domain_id", domain.id)
          .maybeSingle();
        return new Response(
          JSON.stringify({
            ok: true,
            domain: {
              id: domain.id,
              name: domain.name,
              slug: domain.slug,
              firmenname: settings?.firmenname ?? domain.name,
              logo_url: settings?.logo_url ?? null,
              wartung_aktiv: !!settings?.wartung_aktiv,
              wartung_nachricht: settings?.wartung_nachricht ?? null,
              wartung_farbe: settings?.wartung_farbe ?? "info",
            },
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=30" },
          },
        );
      },
    },
  },
});
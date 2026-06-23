import { createFileRoute } from "@tanstack/react-router";
import { withCors } from "@/lib/cors";
import { supabaseAdmin } from "@/integrations/supabase/client.server";


export const Route = createFileRoute("/api/public/version")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => {
        return new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin":
              request.headers.get("origin") ?? "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers":
              "Content-Type, Authorization, X-Requested-With, Accept, Origin",
            "Access-Control-Max-Age": "86400",
          },
        });
      },
      GET: async ({ request }) => {
        const { data: settings } = await supabaseAdmin
          .from("platform_settings")
          .select("current_version")
          .eq("id", 1)
          .maybeSingle();
        const { data: versions } = await supabaseAdmin
          .from("app_versions")
          .select("id, version, changelog, released_at")
          .order("released_at", { ascending: false })
          .limit(50);
        const response = new Response(
          JSON.stringify({
            current_version: settings?.current_version ?? "1.0.0",
            versions: versions ?? [],
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "Cache-Control": "public, max-age=60",
            },
          },
        );
        return withCors(response, request);
      },
    },
  },
});

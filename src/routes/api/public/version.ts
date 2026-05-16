import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/public/version")({
  server: {
    handlers: {
      GET: async () => {
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
        return new Response(
          JSON.stringify({
            current_version: settings?.current_version ?? "1.0.0",
            versions: versions ?? [],
          }),
          { status: 200, headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=60" } },
        );
      },
    },
  },
});
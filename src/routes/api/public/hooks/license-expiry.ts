import { createFileRoute } from "@tanstack/react-router";
import { withCors } from "@/lib/cors";
import { runExpiryNotices } from "@/lib/superadmin.functions";

export const Route = createFileRoute("/api/public/hooks/license-expiry")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env.SUPABASE_SERVICE_ROLE_KEY;
        const auth = request.headers.get("authorization") ?? "";
        const token = auth.toLowerCase().startsWith("bearer ")
          ? auth.slice(7).trim()
          : "";
        if (!expected || token !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }
        try {
          const r = await runExpiryNotices();
          return new Response(JSON.stringify(r), { headers: { "content-type": "application/json" } });
        } catch {
          return new Response(
            JSON.stringify({ ok: false, error: "internal_error" }),
            { status: 500, headers: { "content-type": "application/json" } },
          );
        }
      },
    },
  },
});
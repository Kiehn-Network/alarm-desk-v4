import { createFileRoute } from "@tanstack/react-router";
import { withCors } from "@/lib/cors";
import { runExpiryNotices } from "@/lib/superadmin.functions";

export const Route = createFileRoute("/api/public/hooks/license-expiry")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => {
        return new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": request.headers.get("origin") ?? "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With, Accept, Origin",
            "Access-Control-Max-Age": "86400",
          },
        });
      },
      POST: async ({ request }) => {
        const expected = process.env.SUPABASE_SERVICE_ROLE_KEY;
        const auth = request.headers.get("authorization") ?? "";
        const token = auth.toLowerCase().startsWith("bearer ")
          ? auth.slice(7).trim()
          : "";
        if (!expected || token !== expected) {
          return withCors(new Response("Unauthorized", { status: 401 }), request);
        }
        try {
          const r = await runExpiryNotices();
          return withCors(
            new Response(JSON.stringify(r), { headers: { "content-type": "application/json" } }),
            request,
          );
        } catch {
          return withCors(
            new Response(
              JSON.stringify({ ok: false, error: "internal_error" }),
              { status: 500, headers: { "content-type": "application/json" } },
            ),
            request,
          );
        }
      },
    },
  },
});

import { createFileRoute } from "@tanstack/react-router";
import { processDueErpJobs } from "@/lib/esrp.server";

export const Route = createFileRoute("/api/public/hooks/esrp-worker")({
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
          const results = await processDueErpJobs(20);
          return new Response(
            JSON.stringify({ ok: true, processed: results.length, results }),
            { headers: { "content-type": "application/json" } },
          );
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
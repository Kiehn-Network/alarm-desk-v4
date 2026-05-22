import { createFileRoute } from "@tanstack/react-router";
import { processDueErpJobs } from "@/lib/esrp.server";

export const Route = createFileRoute("/api/public/hooks/esrp-worker")({
  server: {
    handlers: {
      POST: async () => {
        try {
          const results = await processDueErpJobs(20);
          return new Response(
            JSON.stringify({ ok: true, processed: results.length, results }),
            { headers: { "content-type": "application/json" } },
          );
        } catch (e: any) {
          return new Response(
            JSON.stringify({ ok: false, error: e?.message ?? "unknown" }),
            { status: 500, headers: { "content-type": "application/json" } },
          );
        }
      },
    },
  },
});
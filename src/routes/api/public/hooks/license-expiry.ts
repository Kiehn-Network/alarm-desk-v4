import { createFileRoute } from "@tanstack/react-router";
import { runExpiryNotices } from "@/lib/superadmin.functions";

export const Route = createFileRoute("/api/public/hooks/license-expiry")({
  server: {
    handlers: {
      POST: async () => {
        try {
          const r = await runExpiryNotices();
          return new Response(JSON.stringify(r), { headers: { "content-type": "application/json" } });
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
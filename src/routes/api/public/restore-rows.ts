import { createFileRoute } from "@tanstack/react-router";

// TEMPORARY maintenance endpoint: bulk row import via service role.
// Only reachable from localhost (dev sandbox); removed after the restore.
export const Route = createFileRoute("/api/public/restore-rows")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const host = new URL(request.url).hostname;
        if (host !== "localhost" && host !== "127.0.0.1") {
          return new Response("Forbidden", { status: 403 });
        }
        const url = process.env["SUPABASE_URL"];
        const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
        if (!url || !key) return new Response("env missing", { status: 500 });
        const body = (await request.json()) as {
          op?: "upsert" | "update";
          table: string;
          rows?: any[];
          patch?: any;
          query?: string;
          onConflict?: string;
        };
        const headers: Record<string, string> = {
          apikey: key,
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal,resolution=merge-duplicates",
        };
        if (body.op === "update") {
          const r = await fetch(`${url}/rest/v1/${body.table}?${body.query ?? ""}`, {
            method: "PATCH",
            headers,
            body: JSON.stringify(body.patch),
          });
          return new Response(JSON.stringify({ status: r.status, body: (await r.text()).slice(0, 500) }));
        }
        const rows = body.rows ?? [];
        const out: any[] = [];
        for (let i = 0; i < rows.length; i += 200) {
          const chunk = rows.slice(i, i + 200);
          const qs = body.onConflict ? `?on_conflict=${body.onConflict}` : "";
          const r = await fetch(`${url}/rest/v1/${body.table}${qs}`, {
            method: "POST",
            headers,
            body: JSON.stringify(chunk),
          });
          if (!r.ok) out.push({ i, status: r.status, body: (await r.text()).slice(0, 300) });
        }
        return new Response(JSON.stringify({ total: rows.length, errors: out }));
      },
    },
  },
});

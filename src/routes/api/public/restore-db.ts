import { createFileRoute } from "@tanstack/react-router";

// TEMPORARY maintenance endpoint: executes SQL from a local restore run.
// Only reachable from localhost (dev sandbox); removed after the restore.
export const Route = createFileRoute("/api/public/restore-db")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const host = new URL(request.url).hostname;
        if (host !== "localhost" && host !== "127.0.0.1") {
          return new Response("Forbidden", { status: 403 });
        }
        const dbUrl = process.env["SUPABASE_DB_URL"];
        if (!dbUrl) return new Response("SUPABASE_DB_URL missing", { status: 500 });
        const sqlText = await request.text();
        const { default: postgres } = await import("postgres");
        const sql = postgres(dbUrl, { ssl: "require", max: 1, prepare: false, connect_timeout: 20, idle_timeout: 5 });
        try {
          const rows = await sql.unsafe(sqlText);
          return new Response(JSON.stringify(rows).slice(0, 2000));
        } catch (e: any) {
          return new Response(String(e?.message ?? e), { status: 500 });
        } finally {
          try { await sql.end({ timeout: 5 }); } catch { /* noop */ }
        }
      },
    },
  },
});

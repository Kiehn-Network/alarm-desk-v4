import { createFileRoute } from "@tanstack/react-router";

// TEMPORARY maintenance endpoint: recreates auth users from a backup.
// Only reachable from localhost (dev sandbox); removed after the restore.
export const Route = createFileRoute("/api/public/restore-users")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const host = new URL(request.url).hostname;
        if (host !== "localhost" && host !== "127.0.0.1") return new Response("Forbidden", { status: 403 });
        const url = process.env["SUPABASE_URL"];
        const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
        if (!url || !key) return new Response("env missing", { status: 500 });
        const out: any[] = [];
        for (let page = 1; page <= 5; page++) {
          const r = await fetch(`${url}/auth/v1/admin/users?page=${page}&per_page=200`, {
            headers: { apikey: key, Authorization: `Bearer ${key}` },
          });
          const j: any = await r.json();
          const us = j?.users ?? [];
          out.push(...us.map((u: any) => ({ id: u.id, email: u.email })));
          if (us.length < 200) break;
        }
        return new Response(JSON.stringify(out));
      },
      POST: async ({ request }) => {
        const host = new URL(request.url).hostname;
        if (host !== "localhost" && host !== "127.0.0.1") {
          return new Response("Forbidden", { status: 403 });
        }
        const url = process.env["SUPABASE_URL"];
        const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
        if (!url || !key) return new Response("env missing", { status: 500 });
        const users = (await request.json()) as any[];
        const results: any[] = [];
        for (const u of users) {
          const res = await fetch(`${url}/auth/v1/admin/users`, {
            method: "POST",
            headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              id: u.id,
              email: u.email,
              password_hash: u.encrypted_password ?? undefined,
              email_confirm: true,
              user_metadata: u.user_metadata ?? {},
              app_metadata: u.app_metadata ?? {},
            }),
          });
          const txt = await res.text();
          results.push({ email: u.email, status: res.status, body: res.ok ? "ok" : txt.slice(0, 200) });
        }
        return new Response(JSON.stringify(results));
      },
    },
  },
});

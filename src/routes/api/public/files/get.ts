import { createFileRoute } from "@tanstack/react-router";
import { withCors } from "@/lib/cors";


export const Route = createFileRoute("/api/public/files/get")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => {
        return new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": request.headers.get("origin") ?? "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With, Accept, Origin",
            "Access-Control-Max-Age": "86400",
          },
        });
      },
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const token = url.searchParams.get("t");
          if (!token) {
            return withCors(new Response("Missing token", { status: 400 }), request);
          }

          const { verifyFileToken } = await import("@/lib/file-proxy.server");
          const { storagePath, noDownload } = await verifyFileToken(token);

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data, error } = await supabaseAdmin.storage
            .from("dateien")
            .download(storagePath);
          if (error || !data) {
            return withCors(new Response("Not found", { status: 404 }), request);
          }

          const filename = storagePath.split("/").pop() ?? "datei";
          // Token can enforce inline-only (no download) regardless of query param.
          const inline = noDownload || url.searchParams.get("inline") === "1";
          const disposition = `${inline ? "inline" : "attachment"}; filename="${filename.replace(/"/g, "")}"`;

          return withCors(
            new Response(data, {
              status: 200,
              headers: {
                "Content-Type": data.type || "application/octet-stream",
                "Content-Disposition": disposition,
                "Cache-Control": "private, no-store",
                "X-Content-Type-Options": "nosniff",
              },
            }),
            request,
          );
        } catch (e: any) {
          return withCors(
            new Response(e?.message ?? "Unauthorized", { status: 401 }),
            request,
          );
        }
      },
    },
  },
});

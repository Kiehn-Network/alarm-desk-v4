import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/files/get")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const token = url.searchParams.get("t");
          if (!token) return new Response("Missing token", { status: 400 });

          const { verifyFileToken } = await import("@/lib/file-proxy.server");
          const { storagePath, noDownload } = await verifyFileToken(token);

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data, error } = await supabaseAdmin.storage
            .from("dateien")
            .download(storagePath);
          if (error || !data) return new Response("Not found", { status: 404 });

          const filename = storagePath.split("/").pop() ?? "datei";
          // Token can enforce inline-only (no download) regardless of query param.
          const inline = noDownload || url.searchParams.get("inline") === "1";
          const disposition = `${inline ? "inline" : "attachment"}; filename="${filename.replace(/"/g, "")}"`;

          return new Response(data, {
            status: 200,
            headers: {
              "Content-Type": data.type || "application/octet-stream",
              "Content-Disposition": disposition,
              "Cache-Control": "private, no-store",
              "X-Content-Type-Options": "nosniff",
            },
          });
        } catch (e: any) {
          return new Response(e?.message ?? "Unauthorized", { status: 401 });
        }
      },
    },
  },
});
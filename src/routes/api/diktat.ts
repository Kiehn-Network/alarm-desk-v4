import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

const GATEWAY = "https://ai.gateway.lovable.dev";
const MAX_BYTES = 20 * 1024 * 1024;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

async function readSse(res: Response, onEvent: (e: any) => void) {
  const reader = res.body!.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (!done) buf += dec.decode(value, { stream: true }).replace(/\r/g, "");
    if (done) buf += "\n\n";
    let i;
    while ((i = buf.indexOf("\n\n")) >= 0) {
      const block = buf.slice(0, i);
      buf = buf.slice(i + 2);
      for (const line of block.split("\n")) {
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (!data || data === "[DONE]") continue;
        try { onEvent(JSON.parse(data)); } catch { /* ignore */ }
      }
    }
    if (done) break;
  }
}

async function upstreamError(res: Response) {
  let msg = `Fehler ${res.status}`;
  try { const t = await res.text(); const j = JSON.parse(t); msg = j?.error?.message ?? j?.message ?? msg; } catch { /* */ }
  if (res.status === 402) msg = "KI-Guthaben aufgebraucht. Bitte Admin informieren.";
  if (res.status === 429) msg = "Gerade zu viele Anfragen – bitte gleich nochmal versuchen.";
  return json(res.status, { error: msg });
}

export const Route = createFileRoute("/api/diktat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization") ?? "";
        const token = auth.replace(/^Bearer\s+/i, "");
        if (!token) return json(401, { error: "Nicht angemeldet" });
        const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data: u } = await sb.auth.getUser(token);
        if (!u?.user) return json(401, { error: "Nicht angemeldet" });

        const len = Number(request.headers.get("content-length") ?? 0);
        if (len > MAX_BYTES) return json(413, { error: "Aufnahme zu lang (max. ca. 10 Minuten)." });
        const form = await request.formData();
        const file = form.get("file");
        const feld = String(form.get("feld") ?? "Einsatzbericht").slice(0, 80);
        if (!(file instanceof File) || file.size < 2048) return json(400, { error: "Keine Sprache aufgenommen – bitte erneut versuchen." });
        if (file.size > MAX_BYTES) return json(413, { error: "Aufnahme zu lang." });

        const key = process.env.LOVABLE_API_KEY;
        if (!key) return json(500, { error: "KI nicht eingerichtet" });

        // 1) Sprache -> Text
        const fd = new FormData();
        fd.append("model", "openai/gpt-transcribe");
        fd.append("file", file, "aufnahme.wav");
        fd.append("response_format", "json");
        fd.append("stream", "true");
        fd.append("language", "de");
        fd.append("prompt", "Einsatzbericht eines Sicherheits- und Hausnotruf-Fahrers auf Deutsch.");
        const tr = await fetch(`${GATEWAY}/v1/audio/transcriptions`, {
          method: "POST", headers: { Authorization: `Bearer ${key}` }, body: fd, signal: request.signal,
        });
        if (!tr.ok) return upstreamError(tr);
        let roh = ""; let fertig = "";
        await readSse(tr, (e) => {
          if (e.type === "transcript.text.delta") roh += e.delta ?? "";
          if (e.type === "transcript.text.done") fertig = e.text ?? "";
        });
        console.log("[diktat]", tr.headers.get("content-type"), file.type, file.size, roh.length, fertig.length);
        roh = (fertig || roh).trim();
        if (!roh) return json(422, { error: "Es wurde keine Sprache erkannt – bitte deutlicher sprechen." });

        // 2) Grammatik & Rechtschreibung
        const rs = await fetch(`${GATEWAY}/v1/responses`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Lovable-API-Key": key, Authorization: `Bearer ${key}`, "X-Lovable-AIG-SDK": "fetch" },
          signal: request.signal,
          body: JSON.stringify({
            model: "openai/gpt-6-astra",
            stream: true,
            store: false,
            reasoning: { effort: "low" },
            instructions:
              `Du korrigierst diktierte Texte für das Feld „${feld}" eines Einsatzberichts. ` +
              "Korrigiere Rechtschreibung, Grammatik und Zeichensetzung, entferne Füllwörter (äh, ähm) und Versprecher, " +
              "schreibe in klaren, sachlichen deutschen Sätzen. Erfinde NICHTS dazu, lasse keine Fakten weg, " +
              "ändere keine Namen, Zahlen, Uhrzeiten oder Adressen. Gib ausschließlich den korrigierten Text zurück.",
            input: [{ role: "user", content: roh }],
          }),
        });
        if (!rs.ok) return json(200, { text: roh, roh, korrigiert: false });
        let out = "";
        await readSse(rs, (e) => { if (e.type === "response.output_text.delta") out += e.delta ?? ""; });
        out = out.trim();
        return json(200, { text: out || roh, roh, korrigiert: !!out });
      },
    },
  },
});

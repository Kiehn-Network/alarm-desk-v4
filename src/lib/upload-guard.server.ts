// Serverseitige Prüfungen für Notiz-Uploads, Notiz-HTML und Berichtversand.

const ALLOWED: { mime: string; ext: string[]; test: (b: Uint8Array) => boolean }[] = [
  { mime: "application/pdf", ext: ["pdf"], test: (b) => b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46 },
  { mime: "image/png", ext: ["png"], test: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  { mime: "image/jpeg", ext: ["jpg", "jpeg"], test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: "image/gif", ext: ["gif"], test: (b) => b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 },
  { mime: "image/webp", ext: ["webp"], test: (b) => b[0] === 0x52 && b[1] === 0x49 && b[8] === 0x57 && b[9] === 0x45 },
];

/** Ermittelt den echten Dateityp anhand der Datei-Signatur; wirft bei nicht erlaubten Typen. */
export function detectAllowedMime(buf: Uint8Array, filename: string): string {
  const ext = (filename.split(".").pop() ?? "").toLowerCase();
  const hit = ALLOWED.find((a) => a.test(buf));
  if (!hit || !hit.ext.includes(ext)) {
    throw new Error("Dateityp nicht erlaubt. Erlaubt sind PDF, PNG, JPG, GIF und WEBP.");
  }
  return hit.mime;
}

/** Entfernt aktive Inhalte aus gespeichertem Notiz-HTML (zusätzlich zur Bereinigung im Browser). */
export function stripActiveHtml(html: string | null | undefined): string | null | undefined {
  if (html == null) return html;
  return html
    .replace(/<\s*(script|style|iframe|object|embed|link|meta|base|form)[\s\S]*?(<\s*\/\s*\1\s*>|\/?>)/gi, "")
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/(href|src|xlink:href|action|formaction)\s*=\s*("|')?\s*(javascript|vbscript|data):[^"'\s>]*\2?/gi, "$1=\"#\"");
}

/** Nur Admins/Disponenten der Domäne (oder Superadmins) dürfen Berichte versenden. */
export async function assertCanSendBericht(supabase: any, userId: string, domainId: string) {
  const { data } = await supabase
    .from("user_roles")
    .select("role,domain_id")
    .eq("user_id", userId)
    .in("role", ["admin", "dispatcher", "service", "superadmin"]);
  const ok = (data ?? []).some(
    (r: any) => r.role === "superadmin" || r.domain_id === domainId || r.domain_id === null,
  );
  if (!ok) throw new Error("Nur Admins und Disponenten dürfen Berichte versenden.");
}

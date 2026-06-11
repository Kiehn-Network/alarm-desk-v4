const enc = new TextEncoder();

function b64url(bytes: ArrayBuffer | Uint8Array): string {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (const b of u8) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(str: string): Uint8Array {
  const pad = str.length % 4 === 0 ? "" : "=".repeat(4 - (str.length % 4));
  const b = atob(str.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const out = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) out[i] = b.charCodeAt(i);
  return out;
}

async function getKey(): Promise<CryptoKey> {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("Server-Konfiguration unvollständig");
  return crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function signFileToken(storagePath: string, ttlSeconds: number): Promise<string> {
  const payload = { p: storagePath, e: Math.floor(Date.now() / 1000) + ttlSeconds };
  const payloadStr = b64url(enc.encode(JSON.stringify(payload)));
  const key = await getKey();
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payloadStr));
  return `${payloadStr}.${b64url(sig)}`;
}

export async function verifyFileToken(token: string): Promise<{ storagePath: string }> {
  const parts = token.split(".");
  if (parts.length !== 2) throw new Error("Ungültiger Token");
  const [payloadStr, sigStr] = parts;
  const key = await getKey();
  const ok = await crypto.subtle.verify("HMAC", key, b64urlDecode(sigStr), enc.encode(payloadStr));
  if (!ok) throw new Error("Ungültige Signatur");
  const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(payloadStr))) as { p: string; e: number };
  if (!payload || typeof payload.p !== "string" || typeof payload.e !== "number") throw new Error("Ungültiger Token");
  if (payload.e < Math.floor(Date.now() / 1000)) throw new Error("Token abgelaufen");
  return { storagePath: payload.p };
}
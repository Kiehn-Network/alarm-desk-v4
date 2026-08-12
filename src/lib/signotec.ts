/**
 * signotec STPadServer / signoPAD-API/Web Anbindung.
 *
 * Voraussetzung: Auf dem PC läuft der lokale signotec "STPadServer"
 * (WebSocket-Dienst, Standard-Port 49494). Ohne diesen Dienst ist
 * kein Zugriff auf ein Sigma LITE aus dem Browser möglich –
 * dann greift der Touch/Maus-Fallback.
 */

const WS_URLS = [
  "wss://local.signotec.com:49494",
  "ws://127.0.0.1:49494",
];

type Json = Record<string, unknown>;

function openSocket(url: string, timeoutMs = 2500): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch (e) {
      reject(e);
      return;
    }
    const t = setTimeout(() => {
      try { ws.close(); } catch { /* noop */ }
      reject(new Error("Timeout"));
    }, timeoutMs);
    ws.onopen = () => { clearTimeout(t); resolve(ws); };
    ws.onerror = () => { clearTimeout(t); reject(new Error("Verbindung fehlgeschlagen")); };
  });
}

async function connect(): Promise<WebSocket> {
  let lastErr: unknown = null;
  for (const url of WS_URLS) {
    try {
      return await openSocket(url);
    } catch (e) {
      lastErr = e;
    }
  }
  throw new Error(
    `signotec-Dienst nicht erreichbar (${String((lastErr as Error)?.message ?? "")}). Bitte STPadServer starten.`,
  );
}

function send(ws: WebSocket, payload: Json, timeoutMs = 120000): Promise<Json> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("Zeitüberschreitung am Unterschriftenpad")), timeoutMs);
    ws.onmessage = (ev) => {
      clearTimeout(t);
      try {
        resolve(JSON.parse(String(ev.data)) as Json);
      } catch {
        reject(new Error("Ungültige Antwort vom signotec-Dienst"));
      }
    };
    ws.onerror = () => { clearTimeout(t); reject(new Error("Fehler am signotec-Dienst")); };
    ws.send(JSON.stringify(payload));
  });
}

function ok(res: Json) {
  const status = (res["Status"] ?? res["status"]) as number | string | undefined;
  return status === 0 || status === "0" || status === undefined;
}

function fail(res: Json, fallback: string): never {
  throw new Error(String(res["ErrorMessage"] ?? res["Error"] ?? fallback));
}

/** Prüft, ob der lokale signotec-Dienst erreichbar ist. */
export async function isSignotecAvailable(): Promise<boolean> {
  try {
    const ws = await connect();
    ws.close();
    return true;
  } catch {
    return false;
  }
}

/**
 * Startet eine Unterschrift auf dem Pad und liefert das Bild als data-URL (PNG).
 * Der Anwender unterschreibt am Gerät und bestätigt dort mit dem OK-Button.
 */
export async function captureSignotecSignature(opts?: {
  who?: string;
  reason?: string;
}): Promise<string> {
  const ws = await connect();
  try {
    const open = await send(ws, { Command: "OpenDevice", Index: 0 }, 15000);
    if (!ok(open)) fail(open, "Pad konnte nicht geöffnet werden");

    const start = await send(ws, {
      Command: "StartSignature",
      Who: opts?.who ?? "",
      Why: opts?.reason ?? "Schlüsselübergabe",
      Where: "",
    });
    if (!ok(start)) fail(start, "Unterschrift konnte nicht gestartet werden");

    const confirm = await send(ws, { Command: "ConfirmSignature" });
    if (!ok(confirm)) fail(confirm, "Unterschrift wurde abgebrochen");

    const img = await send(ws, {
      Command: "GetSignatureImage",
      Width: 600,
      Height: 200,
      PenWidth: 3,
      ImageFormat: "png",
    }, 20000);
    if (!ok(img)) fail(img, "Bild konnte nicht gelesen werden");

    const raw = String(
      img["ImageData"] ?? img["Image"] ?? img["Data"] ?? img["imageData"] ?? "",
    );
    if (!raw) throw new Error("Keine Bilddaten vom Pad erhalten");
    return raw.startsWith("data:") ? raw : `data:image/png;base64,${raw}`;
  } finally {
    try {
      ws.send(JSON.stringify({ Command: "CloseDevice" }));
    } catch { /* noop */ }
    setTimeout(() => { try { ws.close(); } catch { /* noop */ } }, 200);
  }
}

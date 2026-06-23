const ALLOWED_ORIGINS = [
  "https://alarmdesk.alarmzentrale-steinberg.de",
  "https://alarmzentrale-steinberg.de",
  "http://localhost:3000",
  "http://localhost:5173",
  "http://localhost:8080",
];

export function getAllowedOrigin(requestOrigin: string | null): string | null {
  if (!requestOrigin) return null;
  // Exakte Übereinstimmung
  if (ALLOWED_ORIGINS.includes(requestOrigin)) return requestOrigin;
  // Lokale Entwicklung: beliebiger localhost-Port erlauben
  if (/^https?:\/\/localhost(:\d+)?$/.test(requestOrigin)) return requestOrigin;
  return null;
}

export function buildCorsHeaders(request: Request) {
  const origin = getAllowedOrigin(request.headers.get("origin"));
  return {
    "Access-Control-Allow-Origin": origin ?? "",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With, Accept, Origin",
    "Access-Control-Max-Age": "86400",
  };
}

export function withCors(response: Response, request: Request): Response {
  const headers = new Headers(response.headers);
  const corsHeaders = buildCorsHeaders(request);
  for (const [key, value] of Object.entries(corsHeaders)) {
    if (value) headers.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

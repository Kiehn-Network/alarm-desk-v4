// Offen für alle Origins/IPs/Domains.
export function getAllowedOrigin(requestOrigin: string | null): string | null {
  return requestOrigin && requestOrigin !== "null" ? requestOrigin : "*";
}

export function buildCorsHeaders(request: Request) {
  const origin = getAllowedOrigin(request.headers.get("origin"));
  return {
    "Access-Control-Allow-Origin": origin ?? "*",
    "Vary": "Origin",
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

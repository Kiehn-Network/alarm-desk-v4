// Rewrites the origin of a Supabase Storage URL (e.g. signed URL) to a
// customer-provided public host. Set PUBLIC_STORAGE_URL to the base URL of
// the Supabase instance whose host should appear in outgoing links
// (e.g. https://data.alarmdesk-software.de). When unset, the original URL
// is returned unchanged.
export function rewriteStorageUrl(url: string): string {
  const base = process.env.PUBLIC_STORAGE_URL;
  if (!base) return url;
  try {
    const target = new URL(base);
    const original = new URL(url);
    original.protocol = target.protocol;
    original.host = target.host;
    original.port = target.port;
    return original.toString();
  } catch {
    return url;
  }
}
// Helper for tenant scoping inside server functions.
// Returns the effective domain id of the current request:
// - if a superadmin is impersonating a domain, that target_domain_id is returned
// - otherwise the user's own profiles.domain_id
// Returns null for superadmins that are not impersonating.
export async function getEffectiveDomainId(
  supabase: any,
  userId: string,
): Promise<string | null> {
  // Try RPC first (security definer, returns effective id)
  const { data: rpcData, error: rpcErr } = await supabase.rpc(
    "current_effective_domain_id",
  );
  if (!rpcErr && rpcData) return rpcData as string;
  // Fallback: read profile
  const { data: prof } = await supabase
    .from("profiles")
    .select("domain_id")
    .eq("id", userId)
    .maybeSingle();
  return prof?.domain_id ?? null;
}

export async function requireEffectiveDomainId(
  supabase: any,
  userId: string,
): Promise<string> {
  const d = await getEffectiveDomainId(supabase, userId);
  if (!d) {
    throw new Error(
      "Keine Domain zugewiesen. Bitte kontaktiere einen Administrator.",
    );
  }
  return d;
}

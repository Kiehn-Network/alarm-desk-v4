import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { normalizeBranding, type EmailBranding } from "@/lib/email-brand";

export async function loadDomainBranding(domainId: string): Promise<EmailBranding> {
  const { data } = await supabaseAdmin
    .from("domain_email_settings")
    .select("brand_logo_url, brand_primary_color, brand_header_label, brand_greeting, brand_signature, brand_footer_html, from_name")
    .eq("domain_id", domainId)
    .maybeSingle() as any;
  return normalizeBranding({
    logo_url: data?.brand_logo_url ?? null,
    primary_color: data?.brand_primary_color ?? "",
    header_label: data?.brand_header_label ?? "",
    greeting: data?.brand_greeting ?? "",
    signature: data?.brand_signature ?? "",
    footer_html: data?.brand_footer_html ?? "",
    from_name: data?.from_name ?? null,
  });
}

export function brandName(branding: EmailBranding): string {
  return branding.from_name?.trim() || "AlarmDesk";
}
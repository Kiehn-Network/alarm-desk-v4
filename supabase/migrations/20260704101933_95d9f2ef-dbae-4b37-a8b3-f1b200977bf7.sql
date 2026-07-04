
ALTER TABLE public.domain_email_settings
  ADD COLUMN IF NOT EXISTS brand_logo_url text,
  ADD COLUMN IF NOT EXISTS brand_primary_color text,
  ADD COLUMN IF NOT EXISTS brand_header_label text,
  ADD COLUMN IF NOT EXISTS brand_greeting text,
  ADD COLUMN IF NOT EXISTS brand_signature text,
  ADD COLUMN IF NOT EXISTS brand_footer_html text;

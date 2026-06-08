
-- Platform-wide email settings (singleton)
CREATE TABLE public.platform_email_settings (
  id boolean PRIMARY KEY DEFAULT true,
  provider text NOT NULL DEFAULT 'resend' CHECK (provider IN ('resend','mailgun','sendgrid')),
  api_key text,
  from_email text,
  from_name text,
  mailgun_domain text,
  mailgun_region text DEFAULT 'us' CHECK (mailgun_region IN ('us','eu')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  CONSTRAINT platform_email_settings_singleton CHECK (id = true)
);

-- Deny direct client access; server functions use service_role
GRANT ALL ON public.platform_email_settings TO service_role;
ALTER TABLE public.platform_email_settings ENABLE ROW LEVEL SECURITY;

-- Per-domain email settings
CREATE TABLE public.domain_email_settings (
  domain_id uuid PRIMARY KEY REFERENCES public.domains(id) ON DELETE CASCADE,
  mode text NOT NULL DEFAULT 'platform' CHECK (mode IN ('platform','own')),
  provider text CHECK (provider IN ('resend','mailgun','sendgrid')),
  api_key text,
  from_email text,
  from_name text,
  mailgun_domain text,
  mailgun_region text CHECK (mailgun_region IN ('us','eu')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

GRANT ALL ON public.domain_email_settings TO service_role;
ALTER TABLE public.domain_email_settings ENABLE ROW LEVEL SECURITY;

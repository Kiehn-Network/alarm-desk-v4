ALTER TABLE public.platform_email_settings DROP CONSTRAINT platform_email_settings_provider_check;
ALTER TABLE public.platform_email_settings ADD CONSTRAINT platform_email_settings_provider_check CHECK (provider = ANY (ARRAY['resend','mailgun','sendgrid','smtp']));
ALTER TABLE public.domain_email_settings DROP CONSTRAINT domain_email_settings_provider_check;
ALTER TABLE public.domain_email_settings ADD CONSTRAINT domain_email_settings_provider_check CHECK (provider IS NULL OR provider = ANY (ARRAY['resend','mailgun','sendgrid','smtp']));
ALTER TABLE public.platform_email_settings
  ADD COLUMN IF NOT EXISTS smtp_host text,
  ADD COLUMN IF NOT EXISTS smtp_port integer,
  ADD COLUMN IF NOT EXISTS smtp_username text,
  ADD COLUMN IF NOT EXISTS smtp_password text,
  ADD COLUMN IF NOT EXISTS smtp_secure text;

ALTER TABLE public.domain_email_settings
  ADD COLUMN IF NOT EXISTS smtp_host text,
  ADD COLUMN IF NOT EXISTS smtp_port integer,
  ADD COLUMN IF NOT EXISTS smtp_username text,
  ADD COLUMN IF NOT EXISTS smtp_password text,
  ADD COLUMN IF NOT EXISTS smtp_secure text;
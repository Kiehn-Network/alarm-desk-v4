ALTER TABLE public.domain_email_settings
  ADD COLUMN IF NOT EXISTS brand_layout text NOT NULL DEFAULT 'card'
    CHECK (brand_layout IN ('card','banner','minimal','sidebar'));
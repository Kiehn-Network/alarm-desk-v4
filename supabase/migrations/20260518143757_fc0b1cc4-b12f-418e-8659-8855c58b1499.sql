ALTER TABLE public.app_settings
ADD COLUMN IF NOT EXISTS theme text NOT NULL DEFAULT 'midnight';
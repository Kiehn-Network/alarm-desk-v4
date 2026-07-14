
ALTER TABLE public.einsaetze ADD COLUMN IF NOT EXISTS abfahrt_zentrale_am timestamptz;

ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS fahrer_zeiten_config jsonb NOT NULL DEFAULT jsonb_build_object(
  'abfahrt_zentrale', jsonb_build_object('enabled', false, 'required', false),
  'vor_ort',          jsonb_build_object('enabled', true,  'required', true),
  'abfahrt_objekt',   jsonb_build_object('enabled', true,  'required', false)
);

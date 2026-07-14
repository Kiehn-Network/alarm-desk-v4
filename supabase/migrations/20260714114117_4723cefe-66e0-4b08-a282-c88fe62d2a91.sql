
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS pdf_zeiten_config jsonb NOT NULL DEFAULT jsonb_build_object(
  'created',          true,
  'abfahrt_zentrale', false,
  'vor_ort',          true,
  'abfahrt_objekt',   true,
  'einsatz_ende',     true,
  'abgeschlossen',    true
);

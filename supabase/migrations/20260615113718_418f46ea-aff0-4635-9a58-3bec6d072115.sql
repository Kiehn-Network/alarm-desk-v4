ALTER TABLE public.einsaetze ADD COLUMN IF NOT EXISTS legacy_data jsonb;
CREATE INDEX IF NOT EXISTS einsaetze_legacy_data_gin ON public.einsaetze USING gin (legacy_data);
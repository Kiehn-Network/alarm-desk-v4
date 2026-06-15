ALTER TABLE public.dateien ADD COLUMN IF NOT EXISTS legacy_id text;
CREATE INDEX IF NOT EXISTS dateien_legacy_id_domain_idx ON public.dateien (domain_id, legacy_id) WHERE legacy_id IS NOT NULL;
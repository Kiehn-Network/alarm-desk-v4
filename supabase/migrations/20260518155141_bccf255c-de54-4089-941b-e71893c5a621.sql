
ALTER TYPE einsatz_status ADD VALUE IF NOT EXISTS 'storniert';

ALTER TABLE public.einsaetze
  ADD COLUMN IF NOT EXISTS storniert_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS storniert_by UUID,
  ADD COLUMN IF NOT EXISTS storniert_grund TEXT;

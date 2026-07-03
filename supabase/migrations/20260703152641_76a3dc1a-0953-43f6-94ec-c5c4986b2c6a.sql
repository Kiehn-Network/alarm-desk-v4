ALTER TABLE public.einsaetze ADD COLUMN IF NOT EXISTS sub_unternehmen text;
ALTER TABLE public.einsaetze ALTER COLUMN assigned_to DROP NOT NULL;
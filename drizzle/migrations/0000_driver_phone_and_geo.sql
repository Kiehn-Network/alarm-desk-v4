ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS telefon text;
ALTER TABLE public.einsaetze ADD COLUMN IF NOT EXISTS ziel_lat double precision, ADD COLUMN IF NOT EXISTS ziel_lng double precision;
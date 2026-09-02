ALTER TABLE public.schluessel_bestand
  ADD COLUMN IF NOT EXISTS kategorie text NOT NULL DEFAULT 'AZ';

ALTER TABLE public.schluessel_bestand
  DROP CONSTRAINT IF EXISTS schluessel_bestand_kategorie_check;
ALTER TABLE public.schluessel_bestand
  ADD CONSTRAINT schluessel_bestand_kategorie_check
  CHECK (kategorie IN ('AZ','Malteser','LüWa','Sonstige'));

DROP INDEX IF EXISTS public.schluessel_bestand_domain_key_uidx;
CREATE UNIQUE INDEX IF NOT EXISTS schluessel_bestand_domain_kat_key_uidx
  ON public.schluessel_bestand (domain_id, kategorie, lower(key_number));
CREATE INDEX IF NOT EXISTS schluessel_bestand_kategorie_idx
  ON public.schluessel_bestand (domain_id, kategorie);
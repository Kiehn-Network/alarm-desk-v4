ALTER TABLE public.einsatz_gruende
  ADD COLUMN IF NOT EXISTS einsatz_typ text;

ALTER TABLE public.einsatz_gruende
  DROP CONSTRAINT IF EXISTS einsatz_gruende_einsatz_typ_check;

ALTER TABLE public.einsatz_gruende
  ADD CONSTRAINT einsatz_gruende_einsatz_typ_check
  CHECK (einsatz_typ IS NULL OR einsatz_typ IN ('av_einsatz','hausnotruf'));
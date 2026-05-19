
-- Add Hausnotruf module (so domains can toggle it on/off)
INSERT INTO public.app_modules (key, name, beschreibung, sort_order, enabled, is_global)
VALUES ('hausnotruf', 'Hausnotruf', 'Hausnotruf-Einsätze separat erfassen und auswerten', 100, true, true)
ON CONFLICT DO NOTHING;

-- Add einsatz_typ column to einsaetze
ALTER TABLE public.einsaetze
  ADD COLUMN IF NOT EXISTS einsatz_typ text NOT NULL DEFAULT 'av_einsatz';

-- Constrain allowed values
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'einsaetze_einsatz_typ_check'
  ) THEN
    ALTER TABLE public.einsaetze
      ADD CONSTRAINT einsaetze_einsatz_typ_check
      CHECK (einsatz_typ IN ('av_einsatz', 'hausnotruf'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_einsaetze_einsatz_typ ON public.einsaetze(einsatz_typ);

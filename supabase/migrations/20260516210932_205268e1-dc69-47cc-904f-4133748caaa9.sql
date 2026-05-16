
ALTER TABLE public.einsaetze
  ADD COLUMN IF NOT EXISTS vor_ort_am timestamptz,
  ADD COLUMN IF NOT EXISTS abfahrt_am timestamptz,
  ADD COLUMN IF NOT EXISTS einsatz_ende_am timestamptz,
  ADD COLUMN IF NOT EXISTS bericht_typ text,
  ADD COLUMN IF NOT EXISTS bericht_data jsonb,
  ADD COLUMN IF NOT EXISTS hausnotruf_problem text,
  ADD COLUMN IF NOT EXISTS hausnotruf_loesung text;

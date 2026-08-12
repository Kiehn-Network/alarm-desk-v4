ALTER TABLE public.schluesseluebergabe_protokolle
  ADD COLUMN IF NOT EXISTS signatur_von text,
  ADD COLUMN IF NOT EXISTS signatur_an text,
  ADD COLUMN IF NOT EXISTS signatur_quelle text;
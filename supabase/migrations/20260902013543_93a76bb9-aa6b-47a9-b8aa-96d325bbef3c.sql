ALTER TABLE public.schluessel_inventur_positionen
  ADD COLUMN IF NOT EXISTS kunden_name text,
  ADD COLUMN IF NOT EXISTS kategorie text NOT NULL DEFAULT 'AZ';

-- Bestehende Positionen aus dem Bestand auffüllen
UPDATE public.schluessel_inventur_positionen pos
SET
  kunden_name = b.kunden_name,
  kategorie = COALESCE(b.kategorie, 'AZ')
FROM public.schluessel_bestand b
WHERE pos.bestand_id = b.id
  AND (pos.kunden_name IS DISTINCT FROM b.kunden_name OR pos.kategorie IS DISTINCT FROM COALESCE(b.kategorie, 'AZ'));

-- Default-Constraint wieder entfernen, damit kategorie Pflicht wird, sobald Spalte existiert
ALTER TABLE public.schluessel_inventur_positionen
  ALTER COLUMN kategorie DROP DEFAULT;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.schluessel_inventur_positionen TO authenticated;
GRANT ALL ON public.schluessel_inventur_positionen TO service_role;

ALTER TABLE public.schluessel_inventur_positionen ENABLE ROW LEVEL SECURITY;
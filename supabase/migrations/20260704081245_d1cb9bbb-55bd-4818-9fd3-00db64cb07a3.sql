
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- dateien: schnelle Text-Suche (ILIKE %val%) für Kunden/Adresse/Dateiname
CREATE INDEX IF NOT EXISTS idx_dateien_kunden_name_trgm
  ON public.dateien USING gin (kunden_name gin_trgm_ops) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_dateien_address_trgm
  ON public.dateien USING gin (address gin_trgm_ops) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_dateien_filename_trgm
  ON public.dateien USING gin (filename gin_trgm_ops) WHERE deleted_at IS NULL;

-- exakte Treffer für Fahrer-Dateien-Lookup
CREATE INDEX IF NOT EXISTS idx_dateien_key_number
  ON public.dateien (key_number) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_dateien_anlagen_nr
  ON public.dateien (anlagen_nr) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_dateien_teilnehmer_id
  ON public.dateien (teilnehmer_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_dateien_storage_path
  ON public.dateien (storage_path) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_dateien_domain_created
  ON public.dateien (domain_id, created_at DESC) WHERE deleted_at IS NULL;

-- einsaetze: Kunden-Suche
CREATE INDEX IF NOT EXISTS idx_einsaetze_kunden_name_trgm
  ON public.einsaetze USING gin (kunden_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_einsaetze_address_trgm
  ON public.einsaetze USING gin (address gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_einsaetze_einsatzgrund_trgm
  ON public.einsaetze USING gin (einsatzgrund gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_einsaetze_key_number
  ON public.einsaetze (key_number);
CREATE INDEX IF NOT EXISTS idx_einsaetze_anlagen_nr
  ON public.einsaetze (anlagen_nr);
CREATE INDEX IF NOT EXISTS idx_einsaetze_teilnehmer_id
  ON public.einsaetze (teilnehmer_id);

-- Häufige Fahrer-/Dispatcher-Filter (offene Einsätze eines Fahrers, Dashboards)
CREATE INDEX IF NOT EXISTS idx_einsaetze_domain_status_created
  ON public.einsaetze (domain_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_einsaetze_assigned_status
  ON public.einsaetze (assigned_to, status) WHERE assigned_to IS NOT NULL;

-- user_roles: schneller Rollen-Lookup pro User
CREATE INDEX IF NOT EXISTS idx_user_roles_user
  ON public.user_roles (user_id);

-- einsatz_historie: schneller Verlauf pro Einsatz
CREATE INDEX IF NOT EXISTS idx_einsatz_historie_einsatz
  ON public.einsatz_historie (einsatz_id, changed_at DESC);

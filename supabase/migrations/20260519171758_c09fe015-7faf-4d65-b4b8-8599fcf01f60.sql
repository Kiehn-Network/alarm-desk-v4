-- ============================================================
-- SCHLÜSSELBUCH MODULE
-- Tracks key handovers per Einsatz: Ausgabe → Übernahme → Rückgabe
-- ============================================================

-- 1) Status enum
DO $$ BEGIN
  CREATE TYPE public.schluessel_status AS ENUM (
    'ausgegeben',       -- Disponent hat Schlüssel ausgegeben, wartet auf Fahrer-Bestätigung
    'uebernommen',      -- Fahrer hat Übernahme bestätigt
    'rueckgabe_offen',  -- Fahrer hat Rückgabe angefordert (Einsatz abgeschlossen)
    'zurueck'           -- Zentrale/Disponent hat Rückgabe bestätigt
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) Schlüsselbuch-Einträge
CREATE TABLE IF NOT EXISTS public.schluessel_buch (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id UUID NOT NULL,
  einsatz_id UUID NOT NULL,

  -- Schlüsseldaten (Snapshot aus Einsatz/Kundendatei)
  key_number TEXT NOT NULL,
  kunden_name TEXT,
  address TEXT,

  -- Träger: entweder ein User oder externer Name
  traeger_user_id UUID,
  traeger_name TEXT NOT NULL,

  status public.schluessel_status NOT NULL DEFAULT 'ausgegeben',

  -- Ausgabe (Disponent)
  ausgegeben_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ausgegeben_by UUID NOT NULL,

  -- Übernahme (Fahrer/Träger)
  uebernommen_at TIMESTAMPTZ,
  uebernommen_by UUID,

  -- Rückgabe-Anfrage (Fahrer)
  rueckgabe_angefragt_at TIMESTAMPTZ,
  rueckgabe_angefragt_by UUID,

  -- Rückgabe-Bestätigung (Zentrale/Disponent)
  zurueck_at TIMESTAMPTZ,
  zurueck_by UUID,

  notiz TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sb_domain ON public.schluessel_buch(domain_id);
CREATE INDEX IF NOT EXISTS idx_sb_einsatz ON public.schluessel_buch(einsatz_id);
CREATE INDEX IF NOT EXISTS idx_sb_status ON public.schluessel_buch(domain_id, status);
CREATE INDEX IF NOT EXISTS idx_sb_traeger ON public.schluessel_buch(traeger_user_id);

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_sb_updated_at ON public.schluessel_buch;
CREATE TRIGGER trg_sb_updated_at
  BEFORE UPDATE ON public.schluessel_buch
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3) RLS
ALTER TABLE public.schluessel_buch ENABLE ROW LEVEL SECURITY;

CREATE POLICY sb_select ON public.schluessel_buch
  FOR SELECT TO authenticated
  USING (is_superadmin() OR domain_id = current_effective_domain_id());

CREATE POLICY sb_insert ON public.schluessel_buch
  FOR INSERT TO authenticated
  WITH CHECK (
    (is_superadmin() OR domain_id = current_effective_domain_id())
    AND auth.uid() = ausgegeben_by
  );

CREATE POLICY sb_update ON public.schluessel_buch
  FOR UPDATE TO authenticated
  USING (is_superadmin() OR domain_id = current_effective_domain_id())
  WITH CHECK (is_superadmin() OR domain_id = current_effective_domain_id());

CREATE POLICY sb_delete ON public.schluessel_buch
  FOR DELETE TO authenticated
  USING (is_superadmin() OR (domain_id = current_effective_domain_id() AND is_domain_admin(domain_id)));

-- 4) Modul registrieren
INSERT INTO public.app_modules (key, name, beschreibung, enabled, sort_order, is_global)
VALUES ('schluesselbuch', 'Schlüsselbuch', 'Verwaltung der Schlüsselausgabe und -rückgabe pro Einsatz', true, 50, true)
ON CONFLICT (key) DO NOTHING;

-- Für alle Domains aktivieren
INSERT INTO public.domain_modules (domain_id, module_key, enabled)
SELECT d.id, 'schluesselbuch', true FROM public.domains d
ON CONFLICT (domain_id, module_key) DO NOTHING;
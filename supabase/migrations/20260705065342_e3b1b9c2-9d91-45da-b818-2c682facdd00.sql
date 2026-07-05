
-- Onboarding-Status pro Nutzer
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS onboarding_demo_mode BOOLEAN NOT NULL DEFAULT FALSE;

-- Bestehende Nutzer: als bereits abgeschlossen markieren
UPDATE public.profiles
  SET onboarding_completed_at = COALESCE(onboarding_completed_at, now())
  WHERE onboarding_completed_at IS NULL;

-- is_demo Marker auf allen relevanten Tabellen
ALTER TABLE public.schluessel_buch      ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.einsaetze            ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.rohrservice_berichte ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.budeko_berichte      ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.dateien              ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.dienstplaene         ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.chat_conversations   ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_schluessel_buch_is_demo      ON public.schluessel_buch(domain_id) WHERE is_demo;
CREATE INDEX IF NOT EXISTS idx_einsaetze_is_demo            ON public.einsaetze(domain_id) WHERE is_demo;
CREATE INDEX IF NOT EXISTS idx_rohrservice_berichte_is_demo ON public.rohrservice_berichte(domain_id) WHERE is_demo;
CREATE INDEX IF NOT EXISTS idx_budeko_berichte_is_demo      ON public.budeko_berichte(domain_id) WHERE is_demo;

-- Domain-weiter Demo-Cleanup, aufgerufen aus dem Onboarding-Splash
CREATE OR REPLACE FUNCTION public.cleanup_all_demo_for_domain(_domain_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _domain_id IS NULL THEN RETURN; END IF;
  IF NOT (public.is_superadmin() OR public.is_domain_admin(_domain_id) OR _domain_id = public.current_effective_domain_id()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  DELETE FROM public.schluessel_buch      WHERE domain_id = _domain_id AND is_demo;
  DELETE FROM public.rohrservice_berichte WHERE domain_id = _domain_id AND is_demo;
  DELETE FROM public.budeko_berichte      WHERE domain_id = _domain_id AND is_demo;
  DELETE FROM public.dateien              WHERE domain_id = _domain_id AND is_demo;
  DELETE FROM public.dienstplaene         WHERE domain_id = _domain_id AND is_demo;
  DELETE FROM public.chat_conversations   WHERE domain_id = _domain_id AND is_demo;
  DELETE FROM public.einsaetze            WHERE domain_id = _domain_id AND is_demo;
END;
$$;

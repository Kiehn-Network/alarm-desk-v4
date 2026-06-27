
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

INSERT INTO public.app_modules (key, name, beschreibung, is_global, enabled, sort_order)
VALUES ('auswertung', 'Auswertung', 'Karten-Auswertung von Echteinbrüchen mit Statistik', true, true, 80)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.domain_modules (domain_id, module_key, enabled)
SELECT id, 'auswertung', true FROM public.domains
ON CONFLICT (domain_id, module_key) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.auswertung_pins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id uuid NOT NULL REFERENCES public.domains(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kategorie text NOT NULL DEFAULT 'echteinbruch',
  titel text NOT NULL,
  adresse text,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  ereignis_am timestamptz NOT NULL DEFAULT now(),
  notiz text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS auswertung_pins_domain_idx ON public.auswertung_pins(domain_id);
CREATE INDEX IF NOT EXISTS auswertung_pins_ereignis_idx ON public.auswertung_pins(ereignis_am);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.auswertung_pins TO authenticated;
GRANT ALL ON public.auswertung_pins TO service_role;

ALTER TABLE public.auswertung_pins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ap_select ON public.auswertung_pins;
DROP POLICY IF EXISTS ap_insert ON public.auswertung_pins;
DROP POLICY IF EXISTS ap_update ON public.auswertung_pins;
DROP POLICY IF EXISTS ap_delete ON public.auswertung_pins;

CREATE POLICY ap_select ON public.auswertung_pins FOR SELECT
  USING (is_superadmin() OR domain_id = current_effective_domain_id());

CREATE POLICY ap_insert ON public.auswertung_pins FOR INSERT
  WITH CHECK ((is_superadmin() OR domain_id = current_effective_domain_id()) AND auth.uid() = created_by);

CREATE POLICY ap_update ON public.auswertung_pins FOR UPDATE
  USING (is_superadmin() OR created_by = auth.uid() OR (domain_id = current_effective_domain_id() AND is_domain_admin(domain_id)))
  WITH CHECK (is_superadmin() OR created_by = auth.uid() OR (domain_id = current_effective_domain_id() AND is_domain_admin(domain_id)));

CREATE POLICY ap_delete ON public.auswertung_pins FOR DELETE
  USING (is_superadmin() OR created_by = auth.uid() OR (domain_id = current_effective_domain_id() AND is_domain_admin(domain_id)));

DROP TRIGGER IF EXISTS auswertung_pins_updated_at ON public.auswertung_pins;
CREATE TRIGGER auswertung_pins_updated_at
  BEFORE UPDATE ON public.auswertung_pins
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

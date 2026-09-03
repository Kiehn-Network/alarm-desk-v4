CREATE TABLE public.lager_artikel (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id UUID NOT NULL,
  bezeichnung TEXT NOT NULL,
  beschreibung TEXT,
  barcode TEXT NOT NULL,
  barcode_generiert BOOLEAN NOT NULL DEFAULT false,
  einheit TEXT NOT NULL DEFAULT 'Stk',
  lagerort TEXT,
  bestand INTEGER NOT NULL DEFAULT 0,
  mindestbestand INTEGER NOT NULL DEFAULT 0,
  alarm_email TEXT,
  aktiv BOOLEAN NOT NULL DEFAULT true,
  last_alert_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX lager_artikel_domain_barcode_idx ON public.lager_artikel (domain_id, barcode);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lager_artikel TO authenticated;
GRANT ALL ON public.lager_artikel TO service_role;
ALTER TABLE public.lager_artikel ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lager_artikel_select" ON public.lager_artikel FOR SELECT TO authenticated
  USING (domain_id = public.current_effective_domain_id() OR public.is_superadmin());
CREATE POLICY "lager_artikel_insert" ON public.lager_artikel FOR INSERT TO authenticated
  WITH CHECK (public.is_domain_admin(domain_id));
CREATE POLICY "lager_artikel_update" ON public.lager_artikel FOR UPDATE TO authenticated
  USING (public.is_domain_admin(domain_id)) WITH CHECK (public.is_domain_admin(domain_id));
CREATE POLICY "lager_artikel_delete" ON public.lager_artikel FOR DELETE TO authenticated
  USING (public.is_domain_admin(domain_id));

CREATE TRIGGER lager_artikel_set_updated_at BEFORE UPDATE ON public.lager_artikel
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.lager_buchungen (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id UUID NOT NULL,
  artikel_id UUID NOT NULL REFERENCES public.lager_artikel(id) ON DELETE CASCADE,
  person_id UUID REFERENCES public.lager_personen(id) ON DELETE SET NULL,
  person_name TEXT,
  richtung TEXT NOT NULL CHECK (richtung IN ('eingang','ausgang')),
  menge INTEGER NOT NULL CHECK (menge > 0),
  bestand_nachher INTEGER NOT NULL DEFAULT 0,
  signatur TEXT,
  notiz TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX lager_buchungen_domain_created_idx ON public.lager_buchungen (domain_id, created_at DESC);
CREATE INDEX lager_buchungen_artikel_idx ON public.lager_buchungen (artikel_id);

GRANT SELECT, INSERT ON public.lager_buchungen TO authenticated;
GRANT ALL ON public.lager_buchungen TO service_role;
ALTER TABLE public.lager_buchungen ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lager_buchungen_select" ON public.lager_buchungen FOR SELECT TO authenticated
  USING (domain_id = public.current_effective_domain_id() OR public.is_superadmin());
CREATE POLICY "lager_buchungen_insert" ON public.lager_buchungen FOR INSERT TO authenticated
  WITH CHECK (domain_id = public.current_effective_domain_id());

CREATE TABLE public.lager_settings (
  domain_id UUID PRIMARY KEY,
  alarm_email TEXT,
  alarm_aktiv BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.lager_settings TO authenticated;
GRANT ALL ON public.lager_settings TO service_role;
ALTER TABLE public.lager_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lager_settings_select" ON public.lager_settings FOR SELECT TO authenticated
  USING (domain_id = public.current_effective_domain_id() OR public.is_superadmin());
CREATE POLICY "lager_settings_insert" ON public.lager_settings FOR INSERT TO authenticated
  WITH CHECK (public.is_domain_admin(domain_id));
CREATE POLICY "lager_settings_update" ON public.lager_settings FOR UPDATE TO authenticated
  USING (public.is_domain_admin(domain_id)) WITH CHECK (public.is_domain_admin(domain_id));

CREATE TRIGGER lager_settings_set_updated_at BEFORE UPDATE ON public.lager_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
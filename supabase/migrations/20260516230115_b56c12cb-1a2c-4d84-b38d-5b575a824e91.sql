
-- Mitarbeiter (für Notdienst-Dropdown)
CREATE TABLE public.rohrservice_mitarbeiter (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id uuid NOT NULL,
  name text NOT NULL,
  telefon_1 text,
  telefon_2 text,
  aktiv boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.rohrservice_mitarbeiter ENABLE ROW LEVEL SECURITY;
CREATE POLICY rsm_select ON public.rohrservice_mitarbeiter FOR SELECT TO authenticated
  USING (is_superadmin() OR domain_id = current_effective_domain_id());
CREATE POLICY rsm_insert ON public.rohrservice_mitarbeiter FOR INSERT TO authenticated
  WITH CHECK ((is_superadmin() OR domain_id = current_effective_domain_id()) AND auth.uid() = created_by);
CREATE POLICY rsm_update ON public.rohrservice_mitarbeiter FOR UPDATE TO authenticated
  USING (is_superadmin() OR domain_id = current_effective_domain_id())
  WITH CHECK (is_superadmin() OR domain_id = current_effective_domain_id());
CREATE POLICY rsm_delete ON public.rohrservice_mitarbeiter FOR DELETE TO authenticated
  USING (is_superadmin() OR (domain_id = current_effective_domain_id() AND is_domain_admin(domain_id)));
CREATE TRIGGER trg_rsm_updated BEFORE UPDATE ON public.rohrservice_mitarbeiter
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Notdienst-Einträge
CREATE TABLE public.rohrservice_notdienst (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id uuid NOT NULL,
  mitarbeiter_id uuid NOT NULL REFERENCES public.rohrservice_mitarbeiter(id) ON DELETE RESTRICT,
  von timestamptz NOT NULL,
  bis timestamptz NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.rohrservice_notdienst ENABLE ROW LEVEL SECURITY;
CREATE POLICY rsn_select ON public.rohrservice_notdienst FOR SELECT TO authenticated
  USING (is_superadmin() OR domain_id = current_effective_domain_id());
CREATE POLICY rsn_insert ON public.rohrservice_notdienst FOR INSERT TO authenticated
  WITH CHECK ((is_superadmin() OR domain_id = current_effective_domain_id()) AND auth.uid() = created_by);
CREATE POLICY rsn_update ON public.rohrservice_notdienst FOR UPDATE TO authenticated
  USING (is_superadmin() OR domain_id = current_effective_domain_id())
  WITH CHECK (is_superadmin() OR domain_id = current_effective_domain_id());
CREATE POLICY rsn_delete ON public.rohrservice_notdienst FOR DELETE TO authenticated
  USING (is_superadmin() OR domain_id = current_effective_domain_id());
CREATE TRIGGER trg_rsn_updated BEFORE UPDATE ON public.rohrservice_notdienst
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_rsn_domain_zeit ON public.rohrservice_notdienst(domain_id, von DESC);

-- Berichte
CREATE TABLE public.rohrservice_berichte (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id uuid NOT NULL,
  bericht_nr serial NOT NULL,

  -- Anrufer
  anrufer_name text,
  anrufer_telefon text,
  anrufer_adresse text,
  anrufer_firma text,

  -- Rechnungsempfänger
  rechnung_name text,
  rechnung_adresse text,
  rechnung_telefon text,

  -- Mieter / Standort
  mieter_name text,
  mieter_telefon text,
  mieter_strasse text,
  mieter_ort text,

  -- Störung
  stoerungsart text,

  -- Sofortweiterleitung: 'mail' | 'mobil' | 'mail_naechster_tag'
  weiterleitung text,

  -- Zeitangaben
  zeit_kundenanruf timestamptz,
  zeit_weitergabe timestamptz,
  monteur_weitergabe text,
  zeit_rueckmeldung timestamptz,
  monteur_rueckmeldung text,
  diensthabender_alarmzentrale text,

  -- Versand
  versendet boolean NOT NULL DEFAULT false,
  versendet_an text,
  versendet_am timestamptz,

  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.rohrservice_berichte ENABLE ROW LEVEL SECURITY;
CREATE POLICY rsb_select ON public.rohrservice_berichte FOR SELECT TO authenticated
  USING (is_superadmin() OR domain_id = current_effective_domain_id());
CREATE POLICY rsb_insert ON public.rohrservice_berichte FOR INSERT TO authenticated
  WITH CHECK ((is_superadmin() OR domain_id = current_effective_domain_id()) AND auth.uid() = created_by);
CREATE POLICY rsb_update ON public.rohrservice_berichte FOR UPDATE TO authenticated
  USING (is_superadmin() OR domain_id = current_effective_domain_id())
  WITH CHECK (is_superadmin() OR domain_id = current_effective_domain_id());
CREATE POLICY rsb_delete ON public.rohrservice_berichte FOR DELETE TO authenticated
  USING (is_superadmin() OR domain_id = current_effective_domain_id());
CREATE TRIGGER trg_rsb_updated BEFORE UPDATE ON public.rohrservice_berichte
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_rsb_domain_created ON public.rohrservice_berichte(domain_id, created_at DESC);

-- Modul registrieren
INSERT INTO public.app_modules (key, name, beschreibung, is_global, enabled, sort_order)
VALUES ('notdienst_rohrservice', 'Notdienst Rohrservice', 'Rohrservice-Berichte, Notdienst-Planung und Versand', true, true, 100)
ON CONFLICT DO NOTHING;

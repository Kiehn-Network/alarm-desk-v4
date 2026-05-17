-- Mitarbeiter
CREATE TABLE public.budeko_mitarbeiter (
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
ALTER TABLE public.budeko_mitarbeiter ENABLE ROW LEVEL SECURITY;
CREATE POLICY bkm_select ON public.budeko_mitarbeiter FOR SELECT TO authenticated
  USING (is_superadmin() OR domain_id = current_effective_domain_id());
CREATE POLICY bkm_insert ON public.budeko_mitarbeiter FOR INSERT TO authenticated
  WITH CHECK ((is_superadmin() OR domain_id = current_effective_domain_id()) AND auth.uid() = created_by);
CREATE POLICY bkm_update ON public.budeko_mitarbeiter FOR UPDATE TO authenticated
  USING (is_superadmin() OR domain_id = current_effective_domain_id())
  WITH CHECK (is_superadmin() OR domain_id = current_effective_domain_id());
CREATE POLICY bkm_delete ON public.budeko_mitarbeiter FOR DELETE TO authenticated
  USING (is_superadmin() OR (domain_id = current_effective_domain_id() AND is_domain_admin(domain_id)));
CREATE TRIGGER trg_bkm_updated BEFORE UPDATE ON public.budeko_mitarbeiter
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Notdienst
CREATE TABLE public.budeko_notdienst (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id uuid NOT NULL,
  mitarbeiter_id uuid NOT NULL REFERENCES public.budeko_mitarbeiter(id) ON DELETE RESTRICT,
  von timestamptz NOT NULL,
  bis timestamptz NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.budeko_notdienst ENABLE ROW LEVEL SECURITY;
CREATE POLICY bkn_select ON public.budeko_notdienst FOR SELECT TO authenticated
  USING (is_superadmin() OR domain_id = current_effective_domain_id());
CREATE POLICY bkn_insert ON public.budeko_notdienst FOR INSERT TO authenticated
  WITH CHECK ((is_superadmin() OR domain_id = current_effective_domain_id()) AND auth.uid() = created_by);
CREATE POLICY bkn_update ON public.budeko_notdienst FOR UPDATE TO authenticated
  USING (is_superadmin() OR domain_id = current_effective_domain_id())
  WITH CHECK (is_superadmin() OR domain_id = current_effective_domain_id());
CREATE POLICY bkn_delete ON public.budeko_notdienst FOR DELETE TO authenticated
  USING (is_superadmin() OR domain_id = current_effective_domain_id());
CREATE TRIGGER trg_bkn_updated BEFORE UPDATE ON public.budeko_notdienst
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_bkn_domain_zeit ON public.budeko_notdienst(domain_id, von DESC);

-- Berichte
CREATE TABLE public.budeko_berichte (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id uuid NOT NULL,
  bericht_nr serial NOT NULL,
  anrufer_name text,
  anrufer_telefon text,
  anrufer_adresse text,
  anrufer_firma text,
  mieter_name text,
  mieter_telefon text,
  mieter_strasse text,
  mieter_ort text,
  stoerungsart text,
  weiterleitung text,
  zeit_kundenanruf timestamptz,
  zeit_weitergabe timestamptz,
  monteur_weitergabe text,
  diensthabender_alarmzentrale text,
  versendet boolean NOT NULL DEFAULT false,
  versendet_an text,
  versendet_am timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.budeko_berichte ENABLE ROW LEVEL SECURITY;
CREATE POLICY bkb_select ON public.budeko_berichte FOR SELECT TO authenticated
  USING (is_superadmin() OR domain_id = current_effective_domain_id());
CREATE POLICY bkb_insert ON public.budeko_berichte FOR INSERT TO authenticated
  WITH CHECK ((is_superadmin() OR domain_id = current_effective_domain_id()) AND auth.uid() = created_by);
CREATE POLICY bkb_update ON public.budeko_berichte FOR UPDATE TO authenticated
  USING (is_superadmin() OR domain_id = current_effective_domain_id())
  WITH CHECK (is_superadmin() OR domain_id = current_effective_domain_id());
CREATE POLICY bkb_delete ON public.budeko_berichte FOR DELETE TO authenticated
  USING (is_superadmin() OR domain_id = current_effective_domain_id());
CREATE TRIGGER trg_bkb_updated BEFORE UPDATE ON public.budeko_berichte
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_bkb_domain_created ON public.budeko_berichte(domain_id, created_at DESC);

-- Notiz auf app_settings
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS budeko_notiz text;

-- Datei-Anhänge der Notiz
CREATE TABLE public.budeko_notiz_dateien (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id uuid NOT NULL,
  label text NOT NULL,
  storage_path text NOT NULL,
  mime_type text,
  size_bytes bigint,
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.budeko_notiz_dateien ENABLE ROW LEVEL SECURITY;
CREATE POLICY bknd_select ON public.budeko_notiz_dateien FOR SELECT TO authenticated
  USING (is_superadmin() OR domain_id = current_effective_domain_id());
CREATE POLICY bknd_insert ON public.budeko_notiz_dateien FOR INSERT TO authenticated
  WITH CHECK (
    (is_superadmin() OR (domain_id = current_effective_domain_id() AND is_domain_admin(domain_id)))
    AND auth.uid() = created_by
  );
CREATE POLICY bknd_update ON public.budeko_notiz_dateien FOR UPDATE TO authenticated
  USING (is_superadmin() OR (domain_id = current_effective_domain_id() AND is_domain_admin(domain_id)))
  WITH CHECK (is_superadmin() OR (domain_id = current_effective_domain_id() AND is_domain_admin(domain_id)));
CREATE POLICY bknd_delete ON public.budeko_notiz_dateien FOR DELETE TO authenticated
  USING (is_superadmin() OR (domain_id = current_effective_domain_id() AND is_domain_admin(domain_id)));
CREATE TRIGGER trg_bknd_updated BEFORE UPDATE ON public.budeko_notiz_dateien
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Storage-Bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('budeko-notizen', 'budeko-notizen', true)
ON CONFLICT (id) DO UPDATE SET public = true;

CREATE POLICY "bkn_public_read" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'budeko-notizen');

CREATE POLICY "bkn_admin_write" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'budeko-notizen'
    AND (is_superadmin() OR is_domain_admin(current_effective_domain_id()))
  );

CREATE POLICY "bkn_admin_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'budeko-notizen'
    AND (is_superadmin() OR is_domain_admin(current_effective_domain_id()))
  );

-- Modul registrieren
INSERT INTO public.app_modules (key, name, beschreibung, is_global, enabled, sort_order)
VALUES ('notdienst_budeko', 'Notdienst Budeko', 'Budeko-Berichte, Notdienst-Planung und Versand', true, true, 110)
ON CONFLICT DO NOTHING;

-- Platform-wide settings (singleton)
CREATE TABLE public.platform_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  current_version text NOT NULL DEFAULT '1.0.0',
  wartung_aktiv boolean NOT NULL DEFAULT false,
  wartung_nachricht text,
  wartung_farbe text NOT NULL DEFAULT 'info',
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.platform_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ps_select" ON public.platform_settings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "ps_super_all" ON public.platform_settings
  FOR ALL TO authenticated
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

-- Version / changelog history
CREATE TABLE public.app_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version text NOT NULL,
  changelog text,
  released_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_app_versions_released_at ON public.app_versions(released_at DESC);

ALTER TABLE public.app_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "av_select" ON public.app_versions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "av_super_all" ON public.app_versions
  FOR ALL TO authenticated
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

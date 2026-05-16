-- Variante + Notiz auf app_settings
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS rohrservice_variante text NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS rohrservice_notiz text;

ALTER TABLE public.app_settings
  DROP CONSTRAINT IF EXISTS app_settings_rs_variante_chk;
ALTER TABLE public.app_settings
  ADD CONSTRAINT app_settings_rs_variante_chk
  CHECK (rohrservice_variante IN ('standard','budeko'));

-- Tabelle für Datei-Anhänge der Notiz
CREATE TABLE IF NOT EXISTS public.rohrservice_notiz_dateien (
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

ALTER TABLE public.rohrservice_notiz_dateien ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rsnd_select ON public.rohrservice_notiz_dateien;
CREATE POLICY rsnd_select ON public.rohrservice_notiz_dateien
  FOR SELECT TO authenticated
  USING (is_superadmin() OR domain_id = current_effective_domain_id());

DROP POLICY IF EXISTS rsnd_insert ON public.rohrservice_notiz_dateien;
CREATE POLICY rsnd_insert ON public.rohrservice_notiz_dateien
  FOR INSERT TO authenticated
  WITH CHECK (
    (is_superadmin() OR (domain_id = current_effective_domain_id() AND is_domain_admin(domain_id)))
    AND auth.uid() = created_by
  );

DROP POLICY IF EXISTS rsnd_update ON public.rohrservice_notiz_dateien;
CREATE POLICY rsnd_update ON public.rohrservice_notiz_dateien
  FOR UPDATE TO authenticated
  USING (is_superadmin() OR (domain_id = current_effective_domain_id() AND is_domain_admin(domain_id)))
  WITH CHECK (is_superadmin() OR (domain_id = current_effective_domain_id() AND is_domain_admin(domain_id)));

DROP POLICY IF EXISTS rsnd_delete ON public.rohrservice_notiz_dateien;
CREATE POLICY rsnd_delete ON public.rohrservice_notiz_dateien
  FOR DELETE TO authenticated
  USING (is_superadmin() OR (domain_id = current_effective_domain_id() AND is_domain_admin(domain_id)));

CREATE TRIGGER trg_rsnd_updated_at BEFORE UPDATE ON public.rohrservice_notiz_dateien
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Public Bucket für Notiz-Anhänge
INSERT INTO storage.buckets (id, name, public)
VALUES ('rohrservice-notizen', 'rohrservice-notizen', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "rsn_public_read" ON storage.objects;
CREATE POLICY "rsn_public_read" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'rohrservice-notizen');

DROP POLICY IF EXISTS "rsn_admin_write" ON storage.objects;
CREATE POLICY "rsn_admin_write" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'rohrservice-notizen'
    AND (is_superadmin() OR is_domain_admin(current_effective_domain_id()))
  );

DROP POLICY IF EXISTS "rsn_admin_delete" ON storage.objects;
CREATE POLICY "rsn_admin_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'rohrservice-notizen'
    AND (is_superadmin() OR is_domain_admin(current_effective_domain_id()))
  );
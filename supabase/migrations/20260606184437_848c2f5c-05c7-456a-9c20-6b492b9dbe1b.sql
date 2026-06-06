
CREATE TABLE public.dienstplaene (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id uuid NOT NULL REFERENCES public.domains(id) ON DELETE CASCADE,
  title text NOT NULL,
  file_path text NOT NULL,
  file_size bigint,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dienstplaene TO authenticated;
GRANT ALL ON public.dienstplaene TO service_role;

ALTER TABLE public.dienstplaene ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dp_select_domain" ON public.dienstplaene
  FOR SELECT TO authenticated
  USING (domain_id = public.current_effective_domain_id() OR public.is_superadmin());

CREATE POLICY "dp_insert_admin" ON public.dienstplaene
  FOR INSERT TO authenticated
  WITH CHECK (public.is_domain_admin(domain_id));

CREATE POLICY "dp_update_admin" ON public.dienstplaene
  FOR UPDATE TO authenticated
  USING (public.is_domain_admin(domain_id))
  WITH CHECK (public.is_domain_admin(domain_id));

CREATE POLICY "dp_delete_admin" ON public.dienstplaene
  FOR DELETE TO authenticated
  USING (public.is_domain_admin(domain_id));

CREATE TRIGGER trg_dienstplaene_updated_at
  BEFORE UPDATE ON public.dienstplaene
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Storage policies for the 'dienstplaene' bucket.
-- Path convention: {domain_id}/{filename}.pdf
CREATE POLICY "dp_storage_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'dienstplaene' AND (
      public.is_superadmin()
      OR (storage.foldername(name))[1]::uuid = public.current_effective_domain_id()
    )
  );

CREATE POLICY "dp_storage_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'dienstplaene'
    AND public.is_domain_admin((storage.foldername(name))[1]::uuid)
  );

CREATE POLICY "dp_storage_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'dienstplaene'
    AND public.is_domain_admin((storage.foldername(name))[1]::uuid)
  );

CREATE POLICY "dp_storage_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'dienstplaene'
    AND public.is_domain_admin((storage.foldername(name))[1]::uuid)
  );

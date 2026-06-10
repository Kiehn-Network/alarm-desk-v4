
-- 1. Deterministic impersonation lookup
CREATE OR REPLACE FUNCTION public.current_effective_domain_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT target_domain_id FROM public.superadmin_impersonation
       WHERE superadmin_id = auth.uid()
       ORDER BY started_at DESC LIMIT 1),
    (SELECT domain_id FROM public.profiles WHERE id = auth.uid())
  )
$$;

-- 2. Domain-aware has_role
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
      AND (domain_id IS NULL OR domain_id = public.current_effective_domain_id())
  )
$$;

-- 3. Tighten dateien bucket policies (domain isolation via join on public.dateien)
DROP POLICY IF EXISTS dateien_bucket_select ON storage.objects;
DROP POLICY IF EXISTS dateien_bucket_insert ON storage.objects;
DROP POLICY IF EXISTS dateien_bucket_update ON storage.objects;
DROP POLICY IF EXISTS dateien_bucket_delete ON storage.objects;

CREATE POLICY dateien_bucket_select ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'dateien' AND (
    public.is_superadmin()
    OR EXISTS (
      SELECT 1 FROM public.dateien d
      WHERE d.storage_path = storage.objects.name
        AND d.domain_id = public.current_effective_domain_id()
    )
  )
);

CREATE POLICY dateien_bucket_insert ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'dateien' AND auth.uid() IS NOT NULL
);

CREATE POLICY dateien_bucket_update ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'dateien' AND (
    public.is_superadmin()
    OR EXISTS (
      SELECT 1 FROM public.dateien d
      WHERE d.storage_path = storage.objects.name
        AND d.domain_id = public.current_effective_domain_id()
    )
  )
);

CREATE POLICY dateien_bucket_delete ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'dateien' AND (
    public.is_superadmin()
    OR EXISTS (
      SELECT 1 FROM public.dateien d
      WHERE d.storage_path = storage.objects.name
        AND d.domain_id = public.current_effective_domain_id()
    )
  )
);

-- 4. Chat attachments: only conversation participants (paths are `{user_id}/{conversation_id}/...`)
DROP POLICY IF EXISTS chat_att_select ON storage.objects;
CREATE POLICY chat_att_select ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'chat-attachments' AND (
    public.is_superadmin()
    OR ((auth.uid())::text = (storage.foldername(name))[1])
    OR public.can_access_conversation(NULLIF((storage.foldername(name))[2], '')::uuid)
  )
);

-- 5. budeko-notizen: only own domain (paths are `{domain_id}/...`)
DROP POLICY IF EXISTS budeko_notizen_select ON storage.objects;
DROP POLICY IF EXISTS "Public read budeko-notizen" ON storage.objects;
CREATE POLICY budeko_notizen_select ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'budeko-notizen' AND (
    public.is_superadmin()
    OR (NULLIF((storage.foldername(name))[1], '')::uuid = public.current_effective_domain_id())
  )
);

-- 6. rohrservice-notizen: only own domain
DROP POLICY IF EXISTS rohrservice_notizen_select ON storage.objects;
DROP POLICY IF EXISTS "Public read rohrservice-notizen" ON storage.objects;
CREATE POLICY rohrservice_notizen_select ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'rohrservice-notizen' AND (
    public.is_superadmin()
    OR (NULLIF((storage.foldername(name))[1], '')::uuid = public.current_effective_domain_id())
  )
);

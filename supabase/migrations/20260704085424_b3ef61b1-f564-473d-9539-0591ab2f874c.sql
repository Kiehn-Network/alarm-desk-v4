
ALTER TABLE public.data_purge_requests DROP CONSTRAINT IF EXISTS data_purge_requests_scope_check;
ALTER TABLE public.data_purge_requests ADD CONSTRAINT data_purge_requests_scope_check CHECK (scope IN ('dateien','table'));

ALTER TABLE public.data_purge_requests ADD COLUMN IF NOT EXISTS initiator text NOT NULL DEFAULT 'admin';
ALTER TABLE public.data_purge_requests DROP CONSTRAINT IF EXISTS data_purge_requests_initiator_check;
ALTER TABLE public.data_purge_requests ADD CONSTRAINT data_purge_requests_initiator_check CHECK (initiator IN ('admin','superadmin'));

ALTER TABLE public.data_purge_requests ADD COLUMN IF NOT EXISTS target_table text;

DROP POLICY IF EXISTS "dpr_insert_admin" ON public.data_purge_requests;
CREATE POLICY "dpr_insert" ON public.data_purge_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    (public.is_superadmin() AND requested_by = auth.uid())
    OR (public.is_domain_admin(domain_id) AND requested_by = auth.uid() AND initiator = 'admin')
  );

DROP POLICY IF EXISTS "dpr_update_super" ON public.data_purge_requests;
CREATE POLICY "dpr_update" ON public.data_purge_requests
  FOR UPDATE TO authenticated
  USING (
    public.is_superadmin()
    OR (public.is_domain_admin(domain_id) AND initiator = 'superadmin')
  )
  WITH CHECK (
    public.is_superadmin()
    OR (public.is_domain_admin(domain_id) AND initiator = 'superadmin')
  );

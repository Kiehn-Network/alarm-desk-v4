
CREATE TABLE public.data_purge_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id UUID NOT NULL REFERENCES public.domains(id) ON DELETE CASCADE,
  scope TEXT NOT NULL DEFAULT 'dateien' CHECK (scope IN ('dateien')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','completed')),
  requested_by UUID NOT NULL,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_by UUID,
  decided_at TIMESTAMPTZ,
  note TEXT,
  executed_at TIMESTAMPTZ,
  affected_count INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_data_purge_requests_domain ON public.data_purge_requests(domain_id);
CREATE INDEX idx_data_purge_requests_status ON public.data_purge_requests(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.data_purge_requests TO authenticated;
GRANT ALL ON public.data_purge_requests TO service_role;

ALTER TABLE public.data_purge_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dpr_select_admin_or_super" ON public.data_purge_requests
  FOR SELECT TO authenticated
  USING (public.is_superadmin() OR public.is_domain_admin(domain_id));

CREATE POLICY "dpr_insert_admin" ON public.data_purge_requests
  FOR INSERT TO authenticated
  WITH CHECK (public.is_domain_admin(domain_id) AND requested_by = auth.uid());

CREATE POLICY "dpr_update_super" ON public.data_purge_requests
  FOR UPDATE TO authenticated
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

CREATE POLICY "dpr_delete_pending_self_or_super" ON public.data_purge_requests
  FOR DELETE TO authenticated
  USING (
    public.is_superadmin()
    OR (status = 'pending' AND requested_by = auth.uid() AND public.is_domain_admin(domain_id))
  );

CREATE TRIGGER trg_data_purge_requests_updated_at
  BEFORE UPDATE ON public.data_purge_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

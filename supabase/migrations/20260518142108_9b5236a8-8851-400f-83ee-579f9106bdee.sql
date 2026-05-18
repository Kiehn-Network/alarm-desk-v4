ALTER TABLE public.superadmin_impersonation
  DROP CONSTRAINT IF EXISTS superadmin_impersonation_superadmin_id_key;
ALTER TABLE public.superadmin_impersonation
  ADD CONSTRAINT superadmin_impersonation_superadmin_id_key UNIQUE (superadmin_id);

CREATE POLICY rsn_admin_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'rohrservice-notizen' AND public.is_domain_admin(public.current_effective_domain_id()))
  WITH CHECK (bucket_id = 'rohrservice-notizen' AND public.is_domain_admin(public.current_effective_domain_id()));

CREATE POLICY bkn_admin_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'budeko-notizen' AND public.is_domain_admin(public.current_effective_domain_id()))
  WITH CHECK (bucket_id = 'budeko-notizen' AND public.is_domain_admin(public.current_effective_domain_id()));

ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public, pgmq;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public, pgmq;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public, pgmq;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public, pgmq;

REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM PUBLIC, anon, authenticated;
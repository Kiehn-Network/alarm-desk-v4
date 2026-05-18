
CREATE TABLE public.intrahub_posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  domain_id UUID NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_intrahub_posts_domain ON public.intrahub_posts(domain_id, created_at DESC);

ALTER TABLE public.intrahub_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY ih_select ON public.intrahub_posts FOR SELECT TO authenticated
  USING (is_superadmin() OR domain_id = current_effective_domain_id());

CREATE POLICY ih_insert ON public.intrahub_posts FOR INSERT TO authenticated
  WITH CHECK ((is_superadmin() OR domain_id = current_effective_domain_id()) AND auth.uid() = created_by);

CREATE POLICY ih_update ON public.intrahub_posts FOR UPDATE TO authenticated
  USING (is_superadmin() OR created_by = auth.uid() OR (domain_id = current_effective_domain_id() AND is_domain_admin(domain_id)))
  WITH CHECK (is_superadmin() OR created_by = auth.uid() OR (domain_id = current_effective_domain_id() AND is_domain_admin(domain_id)));

CREATE POLICY ih_delete ON public.intrahub_posts FOR DELETE TO authenticated
  USING (is_superadmin() OR created_by = auth.uid() OR (domain_id = current_effective_domain_id() AND is_domain_admin(domain_id)));

CREATE TRIGGER intrahub_posts_set_updated
  BEFORE UPDATE ON public.intrahub_posts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO storage.buckets (id, name, public) VALUES ('intrahub', 'intrahub', true)
  ON CONFLICT (id) DO NOTHING;

CREATE POLICY "intrahub read" ON storage.objects FOR SELECT TO authenticated, anon
  USING (bucket_id = 'intrahub');

CREATE POLICY "intrahub upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'intrahub' AND auth.uid() IS NOT NULL);

CREATE POLICY "intrahub delete own" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'intrahub' AND owner = auth.uid());

CREATE TABLE public.dienst_telefone (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id uuid NOT NULL REFERENCES public.domains(id) ON DELETE CASCADE,
  name text NOT NULL,
  nummer text NOT NULL,
  aktiv boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dienst_telefone TO authenticated;
GRANT ALL ON public.dienst_telefone TO service_role;
ALTER TABLE public.dienst_telefone ENABLE ROW LEVEL SECURITY;
CREATE POLICY "domain read" ON public.dienst_telefone FOR SELECT TO authenticated
  USING (domain_id = public.current_effective_domain_id() OR public.is_superadmin());
CREATE POLICY "admin insert" ON public.dienst_telefone FOR INSERT TO authenticated
  WITH CHECK (public.is_domain_admin(domain_id));
CREATE POLICY "admin update" ON public.dienst_telefone FOR UPDATE TO authenticated
  USING (public.is_domain_admin(domain_id)) WITH CHECK (public.is_domain_admin(domain_id));
CREATE POLICY "admin delete" ON public.dienst_telefone FOR DELETE TO authenticated
  USING (public.is_domain_admin(domain_id));
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS dienst_telefon_id uuid REFERENCES public.dienst_telefone(id) ON DELETE SET NULL;
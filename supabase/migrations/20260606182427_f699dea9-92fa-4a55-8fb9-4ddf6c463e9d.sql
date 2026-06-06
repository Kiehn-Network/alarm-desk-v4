
-- Support PIN per domain + forced flag on impersonation
ALTER TABLE public.domains ADD COLUMN IF NOT EXISTS support_pin TEXT;

-- Generate unique 6-digit pins for existing domains
DO $$
DECLARE
  d RECORD;
  new_pin TEXT;
BEGIN
  FOR d IN SELECT id FROM public.domains WHERE support_pin IS NULL LOOP
    LOOP
      new_pin := lpad((floor(random()*1000000))::int::text, 6, '0');
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.domains WHERE support_pin = new_pin);
    END LOOP;
    UPDATE public.domains SET support_pin = new_pin WHERE id = d.id;
  END LOOP;
END $$;

ALTER TABLE public.domains ALTER COLUMN support_pin SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS domains_support_pin_key ON public.domains(support_pin);

ALTER TABLE public.superadmin_impersonation
  ADD COLUMN IF NOT EXISTS forced BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reason TEXT;

-- Allow domain admins to see forced impersonation row for their own domain
DROP POLICY IF EXISTS "imp_admin_view_forced" ON public.superadmin_impersonation;
CREATE POLICY "imp_admin_view_forced" ON public.superadmin_impersonation
  FOR SELECT TO authenticated
  USING (forced = true AND public.is_domain_admin(target_domain_id));

-- Function to regenerate support pin (admin of that domain or superadmin)
CREATE OR REPLACE FUNCTION public.regenerate_support_pin(_domain_id uuid)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  new_pin TEXT;
BEGIN
  IF NOT public.is_domain_admin(_domain_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  LOOP
    new_pin := lpad((floor(random()*1000000))::int::text, 6, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.domains WHERE support_pin = new_pin);
  END LOOP;
  UPDATE public.domains SET support_pin = new_pin WHERE id = _domain_id;
  RETURN new_pin;
END $$;

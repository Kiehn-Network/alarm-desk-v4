
CREATE OR REPLACE FUNCTION public.assign_domain_support_pin()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_pin TEXT;
BEGIN
  IF NEW.support_pin IS NULL OR NEW.support_pin = '' THEN
    LOOP
      new_pin := lpad((floor(random()*1000000))::int::text, 6, '0');
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.domains WHERE support_pin = new_pin);
    END LOOP;
    NEW.support_pin := new_pin;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_domains_support_pin ON public.domains;
CREATE TRIGGER trg_domains_support_pin
  BEFORE INSERT ON public.domains
  FOR EACH ROW EXECUTE FUNCTION public.assign_domain_support_pin();

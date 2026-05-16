
-- Driver live locations (latest position per user)
CREATE TABLE public.driver_locations (
  user_id uuid PRIMARY KEY,
  domain_id uuid NOT NULL,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  accuracy double precision,
  heading double precision,
  speed double precision,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_driver_locations_domain ON public.driver_locations(domain_id);

ALTER TABLE public.driver_locations ENABLE ROW LEVEL SECURITY;

-- Users update only their own row
CREATE POLICY dl_upsert_own
ON public.driver_locations
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id AND domain_id = current_user_domain_id());

CREATE POLICY dl_update_own
ON public.driver_locations
FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id AND domain_id = current_user_domain_id());

CREATE POLICY dl_delete_own
ON public.driver_locations
FOR DELETE TO authenticated
USING (auth.uid() = user_id OR is_superadmin());

-- Everyone in the same domain can read locations of their domain
CREATE POLICY dl_select
ON public.driver_locations
FOR SELECT TO authenticated
USING (is_superadmin() OR domain_id = current_effective_domain_id());

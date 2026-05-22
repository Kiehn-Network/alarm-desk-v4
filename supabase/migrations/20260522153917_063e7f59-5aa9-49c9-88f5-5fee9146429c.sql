
-- ESRP module entry
INSERT INTO public.app_modules (key, name, beschreibung, enabled, sort_order, is_global)
VALUES ('esrp', 'ESRP', 'ERP-Anbindung: Einsätze an externes ERP übertragen', true, 90, false)
ON CONFLICT (key) DO NOTHING;

-- Status enum
DO $$ BEGIN
  CREATE TYPE public.erp_outbox_status AS ENUM ('pending','sent','failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Settings table (one row per domain)
CREATE TABLE IF NOT EXISTS public.erp_settings (
  domain_id UUID PRIMARY KEY,
  api_base TEXT NOT NULL DEFAULT '',
  api_user TEXT NOT NULL DEFAULT '',
  api_token TEXT NOT NULL DEFAULT '',
  endpoint_path TEXT NOT NULL DEFAULT '/azs-av-einsaetze',
  use_api_prefix BOOLEAN NOT NULL DEFAULT false,
  aktiv BOOLEAN NOT NULL DEFAULT false,
  auto_on_abschluss BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID
);

ALTER TABLE public.erp_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "erp_settings_select" ON public.erp_settings FOR SELECT TO authenticated
  USING (is_superadmin() OR domain_id = current_effective_domain_id());
CREATE POLICY "erp_settings_insert" ON public.erp_settings FOR INSERT TO authenticated
  WITH CHECK (is_superadmin() OR (domain_id = current_effective_domain_id() AND is_domain_admin(domain_id)));
CREATE POLICY "erp_settings_update" ON public.erp_settings FOR UPDATE TO authenticated
  USING (is_superadmin() OR (domain_id = current_effective_domain_id() AND is_domain_admin(domain_id)))
  WITH CHECK (is_superadmin() OR (domain_id = current_effective_domain_id() AND is_domain_admin(domain_id)));

CREATE TRIGGER erp_settings_set_updated_at BEFORE UPDATE ON public.erp_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Outbox table
CREATE TABLE IF NOT EXISTS public.erp_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id UUID NOT NULL,
  einsatz_id UUID NOT NULL,
  external_id TEXT NOT NULL,
  payload JSONB NOT NULL,
  status public.erp_outbox_status NOT NULL DEFAULT 'pending',
  tries INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  next_retry_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS erp_outbox_einsatz_idx ON public.erp_outbox(domain_id, einsatz_id, created_at DESC);
CREATE INDEX IF NOT EXISTS erp_outbox_status_idx ON public.erp_outbox(status, next_retry_at);

ALTER TABLE public.erp_outbox ENABLE ROW LEVEL SECURITY;

CREATE POLICY "erp_outbox_select" ON public.erp_outbox FOR SELECT TO authenticated
  USING (is_superadmin() OR domain_id = current_effective_domain_id());
CREATE POLICY "erp_outbox_insert" ON public.erp_outbox FOR INSERT TO authenticated
  WITH CHECK (is_superadmin() OR (domain_id = current_effective_domain_id() AND (is_domain_admin(domain_id) OR has_role(auth.uid(), 'dispatcher'::app_role))));
CREATE POLICY "erp_outbox_update" ON public.erp_outbox FOR UPDATE TO authenticated
  USING (is_superadmin() OR (domain_id = current_effective_domain_id() AND (is_domain_admin(domain_id) OR has_role(auth.uid(), 'dispatcher'::app_role))))
  WITH CHECK (is_superadmin() OR (domain_id = current_effective_domain_id() AND (is_domain_admin(domain_id) OR has_role(auth.uid(), 'dispatcher'::app_role))));
CREATE POLICY "erp_outbox_delete" ON public.erp_outbox FOR DELETE TO authenticated
  USING (is_superadmin() OR (domain_id = current_effective_domain_id() AND is_domain_admin(domain_id)));

CREATE TRIGGER erp_outbox_set_updated_at BEFORE UPDATE ON public.erp_outbox
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

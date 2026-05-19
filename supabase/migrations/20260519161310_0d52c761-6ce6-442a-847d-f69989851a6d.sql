-- 1) Provider-Feld an Einsätzen
ALTER TABLE public.einsaetze
  ADD COLUMN IF NOT EXISTS hausnotruf_provider text;

CREATE INDEX IF NOT EXISTS einsaetze_hausnotruf_provider_idx
  ON public.einsaetze (domain_id, hausnotruf_provider)
  WHERE einsatz_typ = 'hausnotruf';

-- 2) Provider-Einstellungen (Empfänger-E-Mail pro Subprovider)
CREATE TABLE IF NOT EXISTS public.hausnotruf_provider_settings (
  domain_id uuid NOT NULL,
  provider_key text NOT NULL,
  recipient_email text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  PRIMARY KEY (domain_id, provider_key)
);

ALTER TABLE public.hausnotruf_provider_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hps_select"
ON public.hausnotruf_provider_settings
FOR SELECT TO authenticated
USING (public.is_superadmin() OR domain_id = public.current_effective_domain_id());

CREATE POLICY "hps_insert"
ON public.hausnotruf_provider_settings
FOR INSERT TO authenticated
WITH CHECK (
  public.is_superadmin()
  OR (domain_id = public.current_effective_domain_id() AND public.is_domain_admin(domain_id))
);

CREATE POLICY "hps_update"
ON public.hausnotruf_provider_settings
FOR UPDATE TO authenticated
USING (
  public.is_superadmin()
  OR (domain_id = public.current_effective_domain_id() AND public.is_domain_admin(domain_id))
)
WITH CHECK (
  public.is_superadmin()
  OR (domain_id = public.current_effective_domain_id() AND public.is_domain_admin(domain_id))
);

CREATE POLICY "hps_delete"
ON public.hausnotruf_provider_settings
FOR DELETE TO authenticated
USING (
  public.is_superadmin()
  OR (domain_id = public.current_effective_domain_id() AND public.is_domain_admin(domain_id))
);

-- 3) Abrechnungs-Versand-Log
CREATE TABLE IF NOT EXISTS public.hausnotruf_abrechnung_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  domain_id uuid NOT NULL,
  provider_key text NOT NULL,
  period_month date NOT NULL,
  recipient_email text NOT NULL,
  einsatz_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  sent_by uuid,
  sent_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS hal_domain_provider_idx
  ON public.hausnotruf_abrechnung_log (domain_id, provider_key, period_month DESC);

ALTER TABLE public.hausnotruf_abrechnung_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hal_select"
ON public.hausnotruf_abrechnung_log
FOR SELECT TO authenticated
USING (public.is_superadmin() OR domain_id = public.current_effective_domain_id());

CREATE POLICY "hal_insert"
ON public.hausnotruf_abrechnung_log
FOR INSERT TO authenticated
WITH CHECK (
  (public.is_superadmin() OR domain_id = public.current_effective_domain_id())
  AND auth.uid() = sent_by
);
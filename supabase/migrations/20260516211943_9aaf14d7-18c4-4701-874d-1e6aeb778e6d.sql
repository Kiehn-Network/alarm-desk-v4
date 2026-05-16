-- Kunden-E-Mail für Berichte
ALTER TABLE public.einsaetze ADD COLUMN IF NOT EXISTS kunden_email text;

-- Versand-Log
CREATE TABLE IF NOT EXISTS public.einsatz_email_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  einsatz_id uuid NOT NULL,
  recipient_email text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  sent_by uuid,
  sent_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.einsatz_email_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "email_log_select_auth" ON public.einsatz_email_log
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "email_log_insert_auth" ON public.einsatz_email_log
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = sent_by);

CREATE INDEX IF NOT EXISTS idx_email_log_einsatz ON public.einsatz_email_log(einsatz_id);
CREATE INDEX IF NOT EXISTS idx_einsaetze_abgeschlossen_am ON public.einsaetze(abgeschlossen_am);
CREATE INDEX IF NOT EXISTS idx_einsaetze_status ON public.einsaetze(status);
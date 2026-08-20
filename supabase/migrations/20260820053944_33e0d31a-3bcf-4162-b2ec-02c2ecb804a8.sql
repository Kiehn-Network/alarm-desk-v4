UPDATE public.erp_outbox
SET next_retry_at = NULL,
    last_error = CASE
      WHEN last_error IS NULL OR last_error = '' THEN 'ENDGÜLTIG (kein Auto-Retry): Datenfehler – bitte Daten korrigieren und manuell erneut senden.'
      WHEN last_error LIKE 'ENDGÜLTIG%' THEN last_error
      ELSE 'ENDGÜLTIG (kein Auto-Retry): ' || last_error
    END
WHERE status = 'failed'
  AND (last_error LIKE '%HTTP 400%' OR last_error LIKE '%Validierungsfehler%' OR tries >= 10);
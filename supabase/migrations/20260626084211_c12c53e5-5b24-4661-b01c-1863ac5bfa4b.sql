ALTER TABLE public.erp_outbox REPLICA IDENTITY FULL;
DO $$ BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.erp_outbox;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;
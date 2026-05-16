
CREATE TABLE public.datei_historie (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  datei_id uuid NOT NULL REFERENCES public.dateien(id) ON DELETE CASCADE,
  field_name text NOT NULL,
  old_value text,
  new_value text,
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_datei_historie_datei ON public.datei_historie(datei_id, changed_at DESC);

ALTER TABLE public.datei_historie ENABLE ROW LEVEL SECURITY;

CREATE POLICY "historie_select_authenticated"
  ON public.datei_historie FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "historie_insert_authenticated"
  ON public.datei_historie FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = changed_by);

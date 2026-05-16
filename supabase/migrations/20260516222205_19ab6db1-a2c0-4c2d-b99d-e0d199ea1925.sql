-- Add sub-modules for Notdienste so SuperAdmin can toggle each per domain
INSERT INTO public.app_modules (key, name, beschreibung, sort_order, enabled)
VALUES
  ('notdienst_rohrservice', 'Notdienst – Rohrservice', 'Notdienst-Untermodul Rohrservice', 110, true),
  ('notdienst_budeko',      'Notdienst – Budeko',      'Notdienst-Untermodul Budeko',      111, true),
  ('notdienst_lutz',        'Notdienst – Lutz',        'Notdienst-Untermodul Lutz',        112, true)
ON CONFLICT (key) DO NOTHING;

-- Seed enabled=true for every existing domain so nothing disappears unexpectedly
INSERT INTO public.domain_modules (domain_id, module_key, enabled)
SELECT d.id, m.key, true
FROM public.domains d
CROSS JOIN public.app_modules m
WHERE m.key IN ('notdienst_rohrservice','notdienst_budeko','notdienst_lutz')
ON CONFLICT (domain_id, module_key) DO NOTHING;
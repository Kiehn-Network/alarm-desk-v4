ALTER TABLE public.app_modules ADD COLUMN IF NOT EXISTS parent_key text REFERENCES public.app_modules(key) ON UPDATE CASCADE ON DELETE SET NULL;

UPDATE public.app_modules SET parent_key = 'hausnotruf' WHERE key IN ('malteser','johanniter','lgwa');

-- Order: Hausnotruf first, then its submodules right after
UPDATE public.app_modules SET sort_order = 5 WHERE key = 'hausnotruf';
UPDATE public.app_modules SET sort_order = 6 WHERE key = 'malteser';
UPDATE public.app_modules SET sort_order = 7 WHERE key = 'johanniter';
UPDATE public.app_modules SET sort_order = 8 WHERE key = 'lgwa';
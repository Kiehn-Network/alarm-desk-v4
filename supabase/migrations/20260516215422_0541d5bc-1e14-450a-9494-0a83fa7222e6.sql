
-- =============================================================
-- PART 1: Extend role enum
-- =============================================================
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'superadmin';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'user';

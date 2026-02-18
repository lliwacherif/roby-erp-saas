-- ============================================================
-- UPDATE CLIENTS SCHEMA
-- Run this in Supabase SQL Editor
-- ============================================================

ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS cin TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS age INTEGER;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS address TEXT;

-- If you want to enforce CIN is mandatory for NEW records, you can add a CHECK constraint
-- ALTER TABLE public.clients ADD CONSTRAINT check_cin_not_empty CHECK (cin IS NOT NULL AND length(cin) > 0);

-- ============================================================
-- DONE
-- ============================================================

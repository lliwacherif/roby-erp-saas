-- ============================================================
-- Article location min/max pricing support
-- Run manually in Supabase SQL Editor
-- ============================================================

ALTER TABLE public.articles
  ADD COLUMN IF NOT EXISTS prix_location_min NUMERIC,
  ADD COLUMN IF NOT EXISTS prix_location_max NUMERIC;

-- Backfill old rows from purchase price if empty
UPDATE public.articles
SET
  prix_location_min = COALESCE(prix_location_min, prix_achat, 0),
  prix_location_max = COALESCE(prix_location_max, prix_achat, 0)
WHERE prix_location_min IS NULL OR prix_location_max IS NULL;

ALTER TABLE public.articles
  ALTER COLUMN prix_location_min SET DEFAULT 0,
  ALTER COLUMN prix_location_max SET DEFAULT 0,
  ALTER COLUMN prix_location_min SET NOT NULL,
  ALTER COLUMN prix_location_max SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'articles_prix_location_min_nonneg'
  ) THEN
    ALTER TABLE public.articles
      ADD CONSTRAINT articles_prix_location_min_nonneg CHECK (prix_location_min >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'articles_prix_location_max_nonneg'
  ) THEN
    ALTER TABLE public.articles
      ADD CONSTRAINT articles_prix_location_max_nonneg CHECK (prix_location_max >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'articles_prix_location_range_valid'
  ) THEN
    ALTER TABLE public.articles
      ADD CONSTRAINT articles_prix_location_range_valid CHECK (prix_location_max >= prix_location_min);
  END IF;
END $$;

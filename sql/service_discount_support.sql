-- ============================================================
-- Service discount support (remise)
-- Run manually in Supabase SQL Editor
-- ============================================================

ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC;

UPDATE public.services
SET discount_amount = COALESCE(discount_amount, 0)
WHERE discount_amount IS NULL;

ALTER TABLE public.services
  ALTER COLUMN discount_amount SET DEFAULT 0,
  ALTER COLUMN discount_amount SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'services_discount_amount_nonneg'
  ) THEN
    ALTER TABLE public.services
      ADD CONSTRAINT services_discount_amount_nonneg
      CHECK (discount_amount >= 0);
  END IF;
END $$;

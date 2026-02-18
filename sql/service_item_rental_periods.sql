-- ============================================================
-- Per-item rental periods for service_items
-- Run manually in Supabase SQL Editor
-- ============================================================

ALTER TABLE public.service_items
  ADD COLUMN IF NOT EXISTS rental_start DATE,
  ADD COLUMN IF NOT EXISTS rental_end DATE,
  ADD COLUMN IF NOT EXISTS rental_deposit NUMERIC;

-- Backfill existing location service items from parent service dates.
UPDATE public.service_items si
SET
  rental_start = COALESCE(si.rental_start, s.rental_start),
  rental_end = COALESCE(si.rental_end, s.rental_end)
FROM public.services s
WHERE s.id = si.service_id
  AND s.type = 'location'
  AND (si.rental_start IS NULL OR si.rental_end IS NULL);

-- Backfill per-item deposit:
-- - if service has one item, copy service rental_deposit to that item
-- - if service has multiple items, set missing item deposits to 0
WITH item_counts AS (
  SELECT service_id, COUNT(*)::int AS item_count
  FROM public.service_items
  GROUP BY service_id
)
UPDATE public.service_items si
SET rental_deposit = CASE
  WHEN ic.item_count = 1 THEN COALESCE(s.rental_deposit, 0)
  ELSE COALESCE(si.rental_deposit, 0)
END
FROM public.services s
JOIN item_counts ic ON ic.service_id = s.id
WHERE s.id = si.service_id
  AND s.type = 'location'
  AND si.rental_deposit IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'service_items_rental_period_valid'
  ) THEN
    ALTER TABLE public.service_items
      ADD CONSTRAINT service_items_rental_period_valid
      CHECK (
        rental_start IS NULL
        OR rental_end IS NULL
        OR rental_end >= rental_start
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'service_items_rental_deposit_nonneg'
  ) THEN
    ALTER TABLE public.service_items
      ADD CONSTRAINT service_items_rental_deposit_nonneg
      CHECK (rental_deposit IS NULL OR rental_deposit >= 0);
  END IF;
END $$;

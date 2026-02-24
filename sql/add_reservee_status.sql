-- ============================================================
-- Add RESERVEE status to services
-- ============================================================

-- 1. Drop the existing CHECK constraint on the services table
ALTER TABLE public.services DROP CONSTRAINT services_status_check;

-- 2. Add the new CHECK constraint including 'reservee'
ALTER TABLE public.services ADD CONSTRAINT services_status_check 
  CHECK (status IN ('draft', 'reservee', 'confirmed', 'returned', 'cancelled'));

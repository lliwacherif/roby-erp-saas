-- Migration: Add phone column to ouvriers table

ALTER TABLE public.ouvriers ADD COLUMN IF NOT EXISTS phone text;

COMMENT ON COLUMN public.ouvriers.phone IS 'Employee contact phone number';

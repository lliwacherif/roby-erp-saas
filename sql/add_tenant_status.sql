-- Migration: add status column to tenants
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'on_hold'));

-- ============================================================
-- Tenant logo support (column + storage bucket policies)
-- Run manually in Supabase SQL Editor
-- ============================================================

-- 1) Add logo URL field on tenants
ALTER TABLE public.tenants
ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- 2) Create public storage bucket for tenant logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('tenant-logos', 'tenant-logos', true)
ON CONFLICT (id) DO NOTHING;

-- 3) Root-only write access for tenant logos
DROP POLICY IF EXISTS "Root can upload tenant logos" ON storage.objects;
CREATE POLICY "Root can upload tenant logos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'tenant-logos'
  AND public.is_root_user()
);

DROP POLICY IF EXISTS "Root can update tenant logos" ON storage.objects;
CREATE POLICY "Root can update tenant logos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'tenant-logos'
  AND public.is_root_user()
)
WITH CHECK (
  bucket_id = 'tenant-logos'
  AND public.is_root_user()
);

DROP POLICY IF EXISTS "Root can delete tenant logos" ON storage.objects;
CREATE POLICY "Root can delete tenant logos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'tenant-logos'
  AND public.is_root_user()
);

-- 4) Authenticated read for signed users (public bucket URLs also work)
DROP POLICY IF EXISTS "Authenticated can view tenant logos" ON storage.objects;
CREATE POLICY "Authenticated can view tenant logos"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'tenant-logos'
  AND auth.role() = 'authenticated'
);

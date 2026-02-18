-- ============================================================
-- Article photo support (column + storage bucket policies)
-- Run manually in Supabase SQL Editor
-- ============================================================

-- 1) Add photo URL field on articles
ALTER TABLE public.articles
ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- 2) Create public storage bucket for article photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('article-photos', 'article-photos', true)
ON CONFLICT (id) DO NOTHING;

-- 3) Policies
DROP POLICY IF EXISTS "Members can view article photos" ON storage.objects;
CREATE POLICY "Members can view article photos"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'article-photos'
  AND (
    public.is_root_user()
    OR (
      split_part(name, '/', 1) ~* '^[0-9a-f-]{36}$'
      AND public.is_member_of((split_part(name, '/', 1))::uuid)
    )
  )
);

DROP POLICY IF EXISTS "Members can upload article photos" ON storage.objects;
CREATE POLICY "Members can upload article photos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'article-photos'
  AND (
    public.is_root_user()
    OR (
      split_part(name, '/', 1) ~* '^[0-9a-f-]{36}$'
      AND public.is_member_of((split_part(name, '/', 1))::uuid)
    )
  )
);

DROP POLICY IF EXISTS "Members can update article photos" ON storage.objects;
CREATE POLICY "Members can update article photos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'article-photos'
  AND (
    public.is_root_user()
    OR (
      split_part(name, '/', 1) ~* '^[0-9a-f-]{36}$'
      AND public.is_member_of((split_part(name, '/', 1))::uuid)
    )
  )
)
WITH CHECK (
  bucket_id = 'article-photos'
  AND (
    public.is_root_user()
    OR (
      split_part(name, '/', 1) ~* '^[0-9a-f-]{36}$'
      AND public.is_member_of((split_part(name, '/', 1))::uuid)
    )
  )
);

DROP POLICY IF EXISTS "Members can delete article photos" ON storage.objects;
CREATE POLICY "Members can delete article photos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'article-photos'
  AND (
    public.is_root_user()
    OR (
      split_part(name, '/', 1) ~* '^[0-9a-f-]{36}$'
      AND public.is_member_of((split_part(name, '/', 1))::uuid)
    )
  )
);

-- ==============================================================================
-- ADD MISSING DELETE POLICIES
-- ==============================================================================
-- Issue: The `services` table was missing an RLS policy for DELETE operations.
-- Consequently, when deleting a service via the Supabase client, PostgREST 
-- gracefully rejected the deletion (0 rows deleted) without throwing an error, 
-- causing the frontend to silently "succeed" but leave the row intact.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Services Delete Policy
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Delete services" ON public.services;
CREATE POLICY "Delete services" ON public.services 
    FOR DELETE USING (public.is_member_of(tenant_id) OR public.is_root_user());

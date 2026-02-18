-- ============================================================
-- FIX: Infinite recursion in tenant_members RLS
-- Run this in the SQL Editor
-- ============================================================

-- 1. Create a helper function that bypasses RLS to get user's tenant IDs
CREATE OR REPLACE FUNCTION public.get_my_tenant_ids()
RETURNS SETOF UUID AS $$
    SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 2. Drop the recursive policies
DROP POLICY IF EXISTS "Members can view co-members" ON public.tenant_members;
DROP POLICY IF EXISTS "Admins can add members" ON public.tenant_members;
DROP POLICY IF EXISTS "Admins can remove members" ON public.tenant_members;
DROP POLICY IF EXISTS "Members can view their tenants" ON public.tenants;
DROP POLICY IF EXISTS "Admins can update their tenants" ON public.tenants;
DROP POLICY IF EXISTS "Admins can delete their tenants" ON public.tenants;

-- 3. Recreate tenant_members policies using the helper function
CREATE POLICY "Members can view co-members"
    ON public.tenant_members FOR SELECT
    USING (
        tenant_id IN (SELECT public.get_my_tenant_ids())
        OR public.is_root_user()
    );

CREATE POLICY "Admins can add members"
    ON public.tenant_members FOR INSERT
    WITH CHECK (
        tenant_id IN (SELECT tid FROM public.get_my_tenant_ids() tid
                      INTERSECT
                      SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND role = 'admin')
        OR public.is_root_user()
    );

CREATE POLICY "Admins can remove members"
    ON public.tenant_members FOR DELETE
    USING (
        tenant_id IN (SELECT tid FROM public.get_my_tenant_ids() tid
                      INTERSECT
                      SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND role = 'admin')
        OR public.is_root_user()
    );

-- 4. Recreate tenants policies using the helper function
CREATE POLICY "Members can view their tenants"
    ON public.tenants FOR SELECT
    USING (
        id IN (SELECT public.get_my_tenant_ids())
        OR public.is_root_user()
    );

CREATE POLICY "Admins can update their tenants"
    ON public.tenants FOR UPDATE
    USING (
        id IN (SELECT public.get_my_tenant_ids())
        OR public.is_root_user()
    );

CREATE POLICY "Admins can delete their tenants"
    ON public.tenants FOR DELETE
    USING (
        id IN (SELECT public.get_my_tenant_ids())
        OR public.is_root_user()
    );

-- ============================================================
-- DONE
-- ============================================================

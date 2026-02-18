-- ============================================================
-- Root tenant-user onboarding helpers
-- Run manually in Supabase SQL editor
-- ============================================================

-- 1) Keep a default tenant for users when membership is created
CREATE OR REPLACE FUNCTION public.set_default_tenant_on_member_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.user_tenant_settings (user_id, current_tenant_id, updated_at)
  VALUES (NEW.user_id, NEW.tenant_id, now())
  ON CONFLICT (user_id) DO UPDATE
  SET
    current_tenant_id = COALESCE(public.user_tenant_settings.current_tenant_id, EXCLUDED.current_tenant_id),
    updated_at = now();

  RETURN NEW;

END;
$$;

DROP TRIGGER IF EXISTS on_tenant_member_created_set_default_tenant ON public.tenant_members;
CREATE TRIGGER on_tenant_member_created_set_default_tenant
AFTER INSERT ON public.tenant_members
FOR EACH ROW
EXECUTE FUNCTION public.set_default_tenant_on_member_insert();

-- 2) Backfill users that already have memberships but no selected tenant
INSERT INTO public.user_tenant_settings (user_id, current_tenant_id, updated_at)
SELECT first_membership.user_id, first_membership.tenant_id, now()
FROM (
  SELECT DISTINCT ON (tm.user_id) tm.user_id, tm.tenant_id
  FROM public.tenant_members tm
  ORDER BY tm.user_id, tm.created_at ASC, tm.tenant_id ASC
) AS first_membership
LEFT JOIN public.user_tenant_settings uts ON uts.user_id = first_membership.user_id
WHERE uts.user_id IS NULL;

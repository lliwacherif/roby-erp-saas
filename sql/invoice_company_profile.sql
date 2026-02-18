-- ============================================================
-- Invoice company profile per tenant
-- Run manually in Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS public.tenant_company_profiles (
  tenant_id UUID PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  company_name TEXT,
  company_address TEXT,
  company_phone TEXT,
  company_email TEXT,
  company_tax_id TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tenant_company_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view tenant company profile" ON public.tenant_company_profiles;
CREATE POLICY "Members can view tenant company profile"
  ON public.tenant_company_profiles
  FOR SELECT
  USING (public.is_member_of(tenant_id) OR public.is_root_user());

DROP POLICY IF EXISTS "Admins can insert tenant company profile" ON public.tenant_company_profiles;
CREATE POLICY "Admins can insert tenant company profile"
  ON public.tenant_company_profiles
  FOR INSERT
  WITH CHECK (
    public.is_root_user()
    OR tenant_id IN (
      SELECT tenant_id
      FROM public.tenant_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can update tenant company profile" ON public.tenant_company_profiles;
CREATE POLICY "Admins can update tenant company profile"
  ON public.tenant_company_profiles
  FOR UPDATE
  USING (
    public.is_root_user()
    OR tenant_id IN (
      SELECT tenant_id
      FROM public.tenant_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    public.is_root_user()
    OR tenant_id IN (
      SELECT tenant_id
      FROM public.tenant_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

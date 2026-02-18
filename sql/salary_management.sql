-- ==============================================
-- SALARY MANAGEMENT - Run in Supabase SQL Editor
-- ==============================================

-- 1. Add columns to ouvriers
ALTER TABLE public.ouvriers
  ADD COLUMN IF NOT EXISTS joined_at date,
  ADD COLUMN IF NOT EXISTS pay_day integer DEFAULT 1 CHECK (pay_day >= 1 AND pay_day <= 28);

-- 2. Create salary_payments table
CREATE TABLE IF NOT EXISTS public.salary_payments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  ouvrier_id uuid NOT NULL REFERENCES public.ouvriers(id) ON DELETE CASCADE,
  amount numeric NOT NULL DEFAULT 0,
  period text NOT NULL,  -- format: 'YYYY-MM' e.g. '2026-02'
  paid_at timestamptz DEFAULT now(),
  notes text,
  created_at timestamptz DEFAULT now(),

  -- Prevent duplicate payments for same worker/period
  UNIQUE(ouvrier_id, period)
);

-- 3. Enable RLS
ALTER TABLE public.salary_payments ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies (same pattern as other tables)
CREATE POLICY "Users can view salary_payments for their tenants"
  ON public.salary_payments FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()
    )
    OR
    EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND is_root = true)
  );

CREATE POLICY "Users can insert salary_payments for their tenants"
  ON public.salary_payments FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()
    )
    OR
    EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND is_root = true)
  );

CREATE POLICY "Users can delete salary_payments for their tenants"
  ON public.salary_payments FOR DELETE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()
    )
    OR
    EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND is_root = true)
  );

-- 5. Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_salary_payments_ouvrier ON public.salary_payments(ouvrier_id);
CREATE INDEX IF NOT EXISTS idx_salary_payments_tenant ON public.salary_payments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_salary_payments_period ON public.salary_payments(period);

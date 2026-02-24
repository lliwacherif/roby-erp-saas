-- ============================================================
-- Human Resources (HR) Module Redesign
-- Run manually in Supabase SQL Editor
-- ============================================================

-- 1. Expand the ouvriers table with new personal, professional, salary, admin, and security details.
ALTER TABLE public.ouvriers
  -- Personal Information
  ADD COLUMN IF NOT EXISTS cin TEXT,
  ADD COLUMN IF NOT EXISTS date_of_birth DATE,
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS marital_status TEXT, -- Single, Married, Divorced, Widowed
  ADD COLUMN IF NOT EXISTS children_count INTEGER DEFAULT 0,
  
  -- Professional Information
  ADD COLUMN IF NOT EXISTS employee_id TEXT, -- Internal generic code or badge number
  ADD COLUMN IF NOT EXISTS job_title TEXT,
  ADD COLUMN IF NOT EXISTS department TEXT,
  ADD COLUMN IF NOT EXISTS contract_type TEXT, -- CDI, CDD, Internship, Freelance
  ADD COLUMN IF NOT EXISTS hiring_date DATE,
  ADD COLUMN IF NOT EXISTS manager_name TEXT,
  ADD COLUMN IF NOT EXISTS work_location TEXT,

  -- Salary & Payroll 
  -- (Note: base_salary already exists as salary)
  ADD COLUMN IF NOT EXISTS payment_method TEXT, -- Bank Transfer, Cash, Check
  ADD COLUMN IF NOT EXISTS bank_name TEXT,
  ADD COLUMN IF NOT EXISTS rib TEXT,
  ADD COLUMN IF NOT EXISTS payment_day INTEGER, -- e.g., 25 for 25th of each month

  -- Administrative Management
  ADD COLUMN IF NOT EXISTS employment_status TEXT DEFAULT 'Active', -- Active, Suspended, Terminated
  ADD COLUMN IF NOT EXISTS contract_end_date DATE,
  ADD COLUMN IF NOT EXISTS work_schedule TEXT, -- Fixed, Shift, Part-Time
  ADD COLUMN IF NOT EXISTS leave_balance NUMERIC DEFAULT 0,

  -- Security & Control
  ADD COLUMN IF NOT EXISTS cnss_number TEXT,
  ADD COLUMN IF NOT EXISTS emergency_contact TEXT,
  ADD COLUMN IF NOT EXISTS internal_notes TEXT;

-- 2. Create the ouvrier_attendance table for tracking calendar events (Present, Absent, Leave, Late, etc.)
CREATE TABLE IF NOT EXISTS public.ouvrier_attendance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    ouvrier_id UUID NOT NULL REFERENCES public.ouvriers(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('Present', 'Absent', 'Leave', 'Late')),
    overtime_hours NUMERIC DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Ensure an employee has only one attendance record per day
    UNIQUE (tenant_id, ouvrier_id, date)
);

-- Turn on RLS
ALTER TABLE public.ouvrier_attendance ENABLE ROW LEVEL SECURITY;

-- Setup basic RLS Policies tying to tenant_id
CREATE POLICY "Users can view their tenant's attendance"
    ON public.ouvrier_attendance FOR SELECT
    USING (tenant_id IN (
        SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()
    ));

CREATE POLICY "Users can insert into their tenant's attendance"
    ON public.ouvrier_attendance FOR INSERT
    WITH CHECK (tenant_id IN (
        SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()
    ));

CREATE POLICY "Users can update their tenant's attendance"
    ON public.ouvrier_attendance FOR UPDATE
    USING (tenant_id IN (
        SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()
    ));

CREATE POLICY "Users can delete their tenant's attendance"
    ON public.ouvrier_attendance FOR DELETE
    USING (tenant_id IN (
        SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()
    ));

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION public.trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'set_timestamp_ouvrier_attendance'
    ) THEN
        CREATE TRIGGER set_timestamp_ouvrier_attendance
            BEFORE UPDATE ON public.ouvrier_attendance
            FOR EACH ROW
            EXECUTE FUNCTION trigger_set_timestamp();
    END IF;
END $$;

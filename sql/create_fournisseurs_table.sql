-- Create fournisseurs table
CREATE TABLE IF NOT EXISTS fournisseurs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    nom TEXT NOT NULL,
    contact TEXT,
    immatricule_fiscale TEXT,
    telephone TEXT,
    email TEXT,
    adresse TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE fournisseurs ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Users can view their tenant's fournisseurs" ON fournisseurs;
DROP POLICY IF EXISTS "Users can insert their tenant's fournisseurs" ON fournisseurs;
DROP POLICY IF EXISTS "Users can update their tenant's fournisseurs" ON fournisseurs;
DROP POLICY IF EXISTS "Users can delete their tenant's fournisseurs" ON fournisseurs;
DROP POLICY IF EXISTS "Access fournisseurs" ON fournisseurs;
DROP POLICY IF EXISTS "Insert fournisseurs" ON fournisseurs;
DROP POLICY IF EXISTS "Update fournisseurs" ON fournisseurs;
DROP POLICY IF EXISTS "Delete fournisseurs" ON fournisseurs;

CREATE POLICY "Access fournisseurs" ON fournisseurs FOR SELECT USING (public.is_member_of(tenant_id) OR public.is_root_user());
CREATE POLICY "Insert fournisseurs" ON fournisseurs FOR INSERT WITH CHECK (public.is_member_of(tenant_id) OR public.is_root_user());
CREATE POLICY "Update fournisseurs" ON fournisseurs FOR UPDATE USING (public.is_member_of(tenant_id) OR public.is_root_user());
CREATE POLICY "Delete fournisseurs" ON fournisseurs FOR DELETE USING (public.is_member_of(tenant_id) OR public.is_root_user());

-- Function for updated_at (in case it doesn't exist)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_fournisseurs_updated_at ON fournisseurs;
CREATE TRIGGER update_fournisseurs_updated_at
    BEFORE UPDATE ON fournisseurs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- ROBY ERP SaaS — FULL Supabase Database Rebuild Script
-- ============================================================
-- Merged from:  sql/ROBY_DB_V2.sql  +  ALL 25 incremental migrations
-- Run this in:  Supabase > SQL Editor > New Query
-- This is a ONE-SHOT script for a FRESH Supabase project.
-- ============================================================


-- ============================================================
-- 0. EXTENSIONS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;


-- ============================================================
-- 1. PROFILES (linked to auth.users)
-- ============================================================
CREATE TABLE public.profiles (
    user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name  TEXT,
    is_root    BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (user_id, full_name)
    VALUES (NEW.id, NEW.raw_user_meta_data ->> 'full_name');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();


-- ============================================================
-- 2. TENANTS (multi-tenant workspaces)
-- ============================================================
-- Includes: status column (add_tenant_status.sql)
--           logo_url column (tenant_logo_support.sql)
CREATE TABLE public.tenants (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name       TEXT NOT NULL,
    slug       TEXT NOT NULL UNIQUE,
    status     TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'on_hold')),
    logo_url   TEXT,
    created_by UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-add creator as admin when tenant is created
CREATE OR REPLACE FUNCTION public.handle_new_tenant()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.tenant_members (tenant_id, user_id, role)
    VALUES (NEW.id, auth.uid(), 'admin');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_tenant_created
    AFTER INSERT ON public.tenants
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_tenant();


-- ============================================================
-- 3. TENANT MEMBERS (user <-> tenant membership)
-- ============================================================
CREATE TABLE public.tenant_members (
    tenant_id  UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role       TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, user_id)
);


-- ============================================================
-- 4. USER TENANT SETTINGS (last selected tenant)
-- ============================================================
CREATE TABLE public.user_tenant_settings (
    user_id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    current_tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ============================================================
-- 5. TENANT COMPANY PROFILES (invoice_company_profile.sql)
-- ============================================================
CREATE TABLE public.tenant_company_profiles (
    tenant_id     UUID PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
    company_name  TEXT,
    company_address TEXT,
    company_phone TEXT,
    company_email TEXT,
    company_tax_id TEXT,
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ============================================================
-- 6. FOURNISSEURS (suppliers) — create_fournisseurs_table.sql
-- ============================================================
CREATE TABLE public.fournisseurs (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    nom                 TEXT NOT NULL,
    contact             TEXT,
    immatricule_fiscale TEXT,
    telephone           TEXT,
    email               TEXT,
    adresse             TEXT,
    notes               TEXT,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================================
-- 7. FAMILLE ARTICLES (article families/groups)
-- ============================================================
CREATE TABLE public.famille_articles (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id  UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name       TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ============================================================
-- 8. ARTICLE CATEGORIES (sub-categories under families)
-- ============================================================
CREATE TABLE public.article_categories (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id  UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    famille_id UUID NOT NULL REFERENCES public.famille_articles(id) ON DELETE CASCADE,
    name       TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ============================================================
-- 9. ARTICLES (inventory items)
-- ============================================================
-- Includes columns from:
--   add_fournisseur_id_to_articles.sql  (fournisseur_id)
--   article_location_price_rules.sql    (prix_location_min/max)
--   article_photo_support.sql           (photo_url)
--   update_articles_prices.sql          (prix_vente_detail, prix_vente_semi_gros, prix_vente_gros)
CREATE TABLE public.articles (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id         UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    famille_id        UUID NOT NULL REFERENCES public.famille_articles(id) ON DELETE RESTRICT,
    category_id       UUID NOT NULL REFERENCES public.article_categories(id) ON DELETE RESTRICT,
    fournisseur_id    UUID REFERENCES public.fournisseurs(id) ON DELETE SET NULL,
    nom               TEXT NOT NULL,
    couleur           TEXT,
    photo_url         TEXT,
    prix_achat        NUMERIC NOT NULL DEFAULT 0,
    prix_vente_detail DECIMAL(10,2) NOT NULL DEFAULT 0,
    prix_vente_semi_gros DECIMAL(10,2) NOT NULL DEFAULT 0,
    prix_vente_gros   DECIMAL(10,2) NOT NULL DEFAULT 0,
    prix_location_min NUMERIC NOT NULL DEFAULT 0,
    prix_location_max NUMERIC NOT NULL DEFAULT 0,
    qte_on_hand       INTEGER NOT NULL DEFAULT 0,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT articles_prix_location_min_nonneg CHECK (prix_location_min >= 0),
    CONSTRAINT articles_prix_location_max_nonneg CHECK (prix_location_max >= 0),
    CONSTRAINT articles_prix_location_range_valid CHECK (prix_location_max >= prix_location_min)
);


-- ============================================================
-- 10. STOCK MOVEMENTS (audit trail for stock changes)
-- ============================================================
CREATE TABLE public.stock_movements (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id  UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    article_id UUID NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
    qty_delta  INTEGER NOT NULL,
    reason     TEXT NOT NULL,
    ref_table  TEXT,
    ref_id     UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ============================================================
-- 11. CLIENTS
-- ============================================================
-- Includes columns from: update_clients_schema.sql (cin, age, address)
CREATE TABLE public.clients (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id  UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    full_name  TEXT NOT NULL,
    phone      TEXT,
    email      TEXT,
    cin        TEXT,
    age        INTEGER,
    address    TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ============================================================
-- 12. SERVICES (vente / location)
-- ============================================================
-- Includes:
--   add_reservee_status.sql    (status now includes 'reservee')
--   service_discount_support.sql (discount_amount)
CREATE TABLE public.services (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    client_id       UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    type            TEXT NOT NULL CHECK (type IN ('location', 'vente')),
    status          TEXT NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft', 'reservee', 'confirmed', 'returned', 'cancelled')),
    rental_start    DATE,
    rental_end      DATE,
    rental_deposit  NUMERIC DEFAULT 0,
    discount_amount NUMERIC NOT NULL DEFAULT 0,
    total           NUMERIC NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT services_discount_amount_nonneg CHECK (discount_amount >= 0)
);


-- ============================================================
-- 13. SERVICE ITEMS (line items per service)
-- ============================================================
-- Includes: service_item_rental_periods.sql (rental_start/end/deposit per item)
CREATE TABLE public.service_items (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id      UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    service_id     UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
    article_id     UUID NOT NULL REFERENCES public.articles(id) ON DELETE RESTRICT,
    qty            INTEGER NOT NULL,
    unit_price     NUMERIC NOT NULL,
    rental_start   DATE,
    rental_end     DATE,
    rental_deposit NUMERIC,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT service_items_rental_period_valid
        CHECK (rental_start IS NULL OR rental_end IS NULL OR rental_end >= rental_start),
    CONSTRAINT service_items_rental_deposit_nonneg
        CHECK (rental_deposit IS NULL OR rental_deposit >= 0)
);


-- ============================================================
-- 14. DEPENSES (expenses)
-- ============================================================
-- Includes: add_new_expense_types.sql (expanded type CHECK)
CREATE TABLE public.depenses (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    type        TEXT NOT NULL CHECK (type IN (
        'depense_interne', 'voyage', 'retouche_article',
        'equipment', 'utilities', 'marketing', 'maintenance',
        'software', 'insurance', 'taxes', 'office_supplies', 'other'
    )),
    amount      NUMERIC NOT NULL,
    article_id  UUID REFERENCES public.articles(id) ON DELETE SET NULL,
    spent_at    DATE NOT NULL DEFAULT CURRENT_DATE,
    label       TEXT,
    description TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ============================================================
-- 15. OUVRIERS (workers)
-- ============================================================
-- Includes:
--   salary_management.sql     (joined_at, pay_day)
--   add_phone_to_ouvriers.sql (phone)
--   human_resources_redesign.sql (full HR expansion)
CREATE TABLE public.ouvriers (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id         UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name              TEXT NOT NULL,
    cin               TEXT,
    phone             TEXT,
    salaire_base      NUMERIC NOT NULL,
    joined_at         DATE,
    pay_day           INTEGER CHECK (pay_day >= 1 AND pay_day <= 28),

    -- HR Personal Information
    date_of_birth     DATE,
    address           TEXT,
    marital_status    TEXT,
    children_count    INTEGER DEFAULT 0,

    -- HR Professional Information
    employee_id       TEXT,
    job_title         TEXT,
    department        TEXT,
    contract_type     TEXT,
    hiring_date       DATE,
    manager_name      TEXT,
    work_location     TEXT,

    -- HR Salary & Payroll
    payment_method    TEXT,
    bank_name         TEXT,
    rib               TEXT,
    payment_day       INTEGER,

    -- HR Administrative Management
    employment_status TEXT DEFAULT 'Active',
    contract_end_date DATE,
    work_schedule     TEXT,
    leave_balance     NUMERIC DEFAULT 0,

    -- HR Security & Control
    cnss_number       TEXT,
    emergency_contact TEXT,
    internal_notes    TEXT,

    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ============================================================
-- 16. SALARY PAYMENTS (monthly salary tracking)
-- ============================================================
CREATE TABLE public.salary_payments (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    ouvrier_id  UUID NOT NULL REFERENCES public.ouvriers(id) ON DELETE CASCADE,
    amount      NUMERIC NOT NULL DEFAULT 0,
    period      TEXT NOT NULL,    -- format: 'YYYY-MM'
    paid_at     TIMESTAMPTZ DEFAULT now(),
    notes       TEXT,
    created_at  TIMESTAMPTZ DEFAULT now(),
    UNIQUE(ouvrier_id, period)
);


-- ============================================================
-- 17. OUVRIER ATTENDANCE (human_resources_redesign.sql)
-- ============================================================
CREATE TABLE public.ouvrier_attendance (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id      UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    ouvrier_id     UUID NOT NULL REFERENCES public.ouvriers(id) ON DELETE CASCADE,
    date           DATE NOT NULL,
    status         TEXT NOT NULL CHECK (status IN ('Present', 'Absent', 'Leave', 'Late')),
    overtime_hours NUMERIC DEFAULT 0,
    notes          TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (tenant_id, ouvrier_id, date)
);


-- ============================================================
-- VIEWS
-- ============================================================
-- v_stock_overview: final version from fix_stock_logic.sql
-- Real-time stock = initial qte_on_hand + SUM(stock_movements)
CREATE OR REPLACE VIEW public.v_stock_overview AS
SELECT
    a.id,
    a.tenant_id,
    a.nom,
    a.famille_id,
    a.category_id,
    a.fournisseur_id,
    a.couleur,
    ac.name  AS category_name,
    fa.name  AS famille_name,
    a.prix_achat,
    a.prix_vente_detail,
    a.prix_vente_semi_gros,
    a.prix_vente_gros,
    a.prix_location_min,
    a.prix_location_max,
    a.photo_url,
    a.qte_on_hand + COALESCE(SUM(sm.qty_delta), 0) AS qte_on_hand,
    a.created_at,
    a.updated_at
FROM public.articles a
LEFT JOIN public.stock_movements sm ON sm.article_id = a.id
LEFT JOIN public.article_categories ac ON ac.id = a.category_id
LEFT JOIN public.famille_articles fa ON fa.id = a.famille_id
GROUP BY
    a.id,
    a.tenant_id,
    a.nom,
    a.famille_id,
    a.category_id,
    a.fournisseur_id,
    a.couleur,
    ac.name,
    fa.name,
    a.prix_achat,
    a.prix_vente_detail,
    a.prix_vente_semi_gros,
    a.prix_vente_gros,
    a.prix_location_min,
    a.prix_location_max,
    a.photo_url,
    a.qte_on_hand,
    a.created_at,
    a.updated_at;


-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

-- Check if current user is a member of a tenant
CREATE OR REPLACE FUNCTION public.is_member_of(tid UUID)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.tenant_members
        WHERE tenant_id = tid AND user_id = auth.uid()
    );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Check if current user is a root user
CREATE OR REPLACE FUNCTION public.is_root_user()
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE user_id = auth.uid() AND is_root = true
    );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Get current user's tenant IDs (avoids RLS recursion on tenant_members)
-- From: fix_rls_recursion.sql
CREATE OR REPLACE FUNCTION public.get_my_tenant_ids()
RETURNS SETOF UUID AS $$
    SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- updated_at trigger function (shared across tables)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Alias used by human_resources_redesign.sql
CREATE OR REPLACE FUNCTION public.trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ============================================================
-- CASCADE DELETE TRIGGERS (fix_delete_cascades.sql)
-- ============================================================

-- Clean stock_movements when a service is deleted (polymorphic ref_id)
CREATE OR REPLACE FUNCTION public.trg_cascade_delete_stock_movements_from_services()
RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM public.stock_movements WHERE ref_table = 'services' AND ref_id = OLD.id;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_cascade_service_movements
    BEFORE DELETE ON public.services
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_cascade_delete_stock_movements_from_services();

-- Clean stock_movements when a service_item is deleted
CREATE OR REPLACE FUNCTION public.trg_cascade_delete_stock_movements_from_items()
RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM public.stock_movements WHERE ref_table = 'service_items' AND ref_id = OLD.id;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_cascade_item_movements
    BEFORE DELETE ON public.service_items
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_cascade_delete_stock_movements_from_items();


-- ============================================================
-- TENANT MEMBER DEFAULT TENANT TRIGGER (root_tenant_user_setup.sql)
-- ============================================================
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

CREATE TRIGGER on_tenant_member_created_set_default_tenant
    AFTER INSERT ON public.tenant_members
    FOR EACH ROW
    EXECUTE FUNCTION public.set_default_tenant_on_member_insert();


-- ============================================================
-- UPDATED_AT TRIGGERS
-- ============================================================

CREATE TRIGGER update_fournisseurs_updated_at
    BEFORE UPDATE ON public.fournisseurs
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_timestamp_ouvrier_attendance
    BEFORE UPDATE ON public.ouvrier_attendance
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_set_timestamp();


-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

-- Enable RLS on ALL tables
ALTER TABLE public.profiles              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenants               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_members        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_tenant_settings  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_company_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fournisseurs          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.famille_articles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.article_categories    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.articles              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_items         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.depenses              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ouvriers              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salary_payments       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ouvrier_attendance    ENABLE ROW LEVEL SECURITY;


-- ── Profiles ──
CREATE POLICY "Users can view own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Root can view all profiles"
    ON public.profiles FOR SELECT
    USING (public.is_root_user());

CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = user_id);


-- ── Tenants (uses get_my_tenant_ids to avoid recursion) ──
CREATE POLICY "Members can view their tenants"
    ON public.tenants FOR SELECT
    USING (
        id IN (SELECT public.get_my_tenant_ids())
        OR public.is_root_user()
    );

CREATE POLICY "Authenticated users can create tenants"
    ON public.tenants FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

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


-- ── Tenant Members (uses get_my_tenant_ids to avoid recursion) ──
CREATE POLICY "Members can view co-members"
    ON public.tenant_members FOR SELECT
    USING (
        tenant_id IN (SELECT public.get_my_tenant_ids())
        OR public.is_root_user()
    );

CREATE POLICY "Admins can add members"
    ON public.tenant_members FOR INSERT
    WITH CHECK (
        tenant_id IN (
            SELECT tid FROM public.get_my_tenant_ids() tid
            INTERSECT
            SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND role = 'admin'
        )
        OR public.is_root_user()
    );

CREATE POLICY "Admins can remove members"
    ON public.tenant_members FOR DELETE
    USING (
        tenant_id IN (
            SELECT tid FROM public.get_my_tenant_ids() tid
            INTERSECT
            SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND role = 'admin'
        )
        OR public.is_root_user()
    );


-- ── User Tenant Settings ──
CREATE POLICY "Users can manage own settings"
    ON public.user_tenant_settings FOR ALL
    USING (auth.uid() = user_id);


-- ── Tenant Company Profiles ──
CREATE POLICY "Members can view tenant company profile"
    ON public.tenant_company_profiles FOR SELECT
    USING (public.is_member_of(tenant_id) OR public.is_root_user());

CREATE POLICY "Admins can insert tenant company profile"
    ON public.tenant_company_profiles FOR INSERT
    WITH CHECK (
        public.is_root_user()
        OR tenant_id IN (
            SELECT tenant_id FROM public.tenant_members
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Admins can update tenant company profile"
    ON public.tenant_company_profiles FOR UPDATE
    USING (
        public.is_root_user()
        OR tenant_id IN (
            SELECT tenant_id FROM public.tenant_members
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    )
    WITH CHECK (
        public.is_root_user()
        OR tenant_id IN (
            SELECT tenant_id FROM public.tenant_members
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );


-- ── Fournisseurs ──
CREATE POLICY "Access fournisseurs" ON public.fournisseurs FOR SELECT USING (public.is_member_of(tenant_id) OR public.is_root_user());
CREATE POLICY "Insert fournisseurs" ON public.fournisseurs FOR INSERT WITH CHECK (public.is_member_of(tenant_id) OR public.is_root_user());
CREATE POLICY "Update fournisseurs" ON public.fournisseurs FOR UPDATE USING (public.is_member_of(tenant_id) OR public.is_root_user());
CREATE POLICY "Delete fournisseurs" ON public.fournisseurs FOR DELETE USING (public.is_member_of(tenant_id) OR public.is_root_user());


-- ── Famille Articles ──
CREATE POLICY "Access famille_articles" ON public.famille_articles FOR SELECT USING (public.is_member_of(tenant_id) OR public.is_root_user());
CREATE POLICY "Insert famille_articles" ON public.famille_articles FOR INSERT WITH CHECK (public.is_member_of(tenant_id) OR public.is_root_user());
CREATE POLICY "Update famille_articles" ON public.famille_articles FOR UPDATE USING (public.is_member_of(tenant_id) OR public.is_root_user());
CREATE POLICY "Delete famille_articles" ON public.famille_articles FOR DELETE USING (public.is_member_of(tenant_id) OR public.is_root_user());

-- ── Article Categories ──
CREATE POLICY "Access article_categories" ON public.article_categories FOR SELECT USING (public.is_member_of(tenant_id) OR public.is_root_user());
CREATE POLICY "Insert article_categories" ON public.article_categories FOR INSERT WITH CHECK (public.is_member_of(tenant_id) OR public.is_root_user());
CREATE POLICY "Update article_categories" ON public.article_categories FOR UPDATE USING (public.is_member_of(tenant_id) OR public.is_root_user());
CREATE POLICY "Delete article_categories" ON public.article_categories FOR DELETE USING (public.is_member_of(tenant_id) OR public.is_root_user());

-- ── Articles ──
CREATE POLICY "Access articles" ON public.articles FOR SELECT USING (public.is_member_of(tenant_id) OR public.is_root_user());
CREATE POLICY "Insert articles" ON public.articles FOR INSERT WITH CHECK (public.is_member_of(tenant_id) OR public.is_root_user());
CREATE POLICY "Update articles" ON public.articles FOR UPDATE USING (public.is_member_of(tenant_id) OR public.is_root_user());
CREATE POLICY "Delete articles" ON public.articles FOR DELETE USING (public.is_member_of(tenant_id) OR public.is_root_user());

-- ── Stock Movements ──
CREATE POLICY "Access stock_movements" ON public.stock_movements FOR SELECT USING (public.is_member_of(tenant_id) OR public.is_root_user());
CREATE POLICY "Insert stock_movements" ON public.stock_movements FOR INSERT WITH CHECK (public.is_member_of(tenant_id) OR public.is_root_user());

-- ── Clients ──
CREATE POLICY "Access clients" ON public.clients FOR SELECT USING (public.is_member_of(tenant_id) OR public.is_root_user());
CREATE POLICY "Insert clients" ON public.clients FOR INSERT WITH CHECK (public.is_member_of(tenant_id) OR public.is_root_user());
CREATE POLICY "Update clients" ON public.clients FOR UPDATE USING (public.is_member_of(tenant_id) OR public.is_root_user());
CREATE POLICY "Delete clients" ON public.clients FOR DELETE USING (public.is_member_of(tenant_id) OR public.is_root_user());

-- ── Services ──
CREATE POLICY "Access services" ON public.services FOR SELECT USING (public.is_member_of(tenant_id) OR public.is_root_user());
CREATE POLICY "Insert services" ON public.services FOR INSERT WITH CHECK (public.is_member_of(tenant_id) OR public.is_root_user());
CREATE POLICY "Update services" ON public.services FOR UPDATE USING (public.is_member_of(tenant_id) OR public.is_root_user());
CREATE POLICY "Delete services" ON public.services FOR DELETE USING (public.is_member_of(tenant_id) OR public.is_root_user());

-- ── Service Items ──
CREATE POLICY "Access service_items" ON public.service_items FOR SELECT USING (public.is_member_of(tenant_id) OR public.is_root_user());
CREATE POLICY "Insert service_items" ON public.service_items FOR INSERT WITH CHECK (public.is_member_of(tenant_id) OR public.is_root_user());

-- ── Depenses ──
CREATE POLICY "Access depenses" ON public.depenses FOR SELECT USING (public.is_member_of(tenant_id) OR public.is_root_user());
CREATE POLICY "Insert depenses" ON public.depenses FOR INSERT WITH CHECK (public.is_member_of(tenant_id) OR public.is_root_user());
CREATE POLICY "Update depenses" ON public.depenses FOR UPDATE USING (public.is_member_of(tenant_id) OR public.is_root_user());
CREATE POLICY "Delete depenses" ON public.depenses FOR DELETE USING (public.is_member_of(tenant_id) OR public.is_root_user());

-- ── Ouvriers ──
CREATE POLICY "Access ouvriers" ON public.ouvriers FOR SELECT USING (public.is_member_of(tenant_id) OR public.is_root_user());
CREATE POLICY "Insert ouvriers" ON public.ouvriers FOR INSERT WITH CHECK (public.is_member_of(tenant_id) OR public.is_root_user());
CREATE POLICY "Update ouvriers" ON public.ouvriers FOR UPDATE USING (public.is_member_of(tenant_id) OR public.is_root_user());
CREATE POLICY "Delete ouvriers" ON public.ouvriers FOR DELETE USING (public.is_member_of(tenant_id) OR public.is_root_user());

-- ── Salary Payments ──
CREATE POLICY "Access salary_payments" ON public.salary_payments FOR SELECT USING (public.is_member_of(tenant_id) OR public.is_root_user());
CREATE POLICY "Insert salary_payments" ON public.salary_payments FOR INSERT WITH CHECK (public.is_member_of(tenant_id) OR public.is_root_user());
CREATE POLICY "Delete salary_payments" ON public.salary_payments FOR DELETE USING (public.is_member_of(tenant_id) OR public.is_root_user());

-- ── Ouvrier Attendance ──
CREATE POLICY "Access ouvrier_attendance" ON public.ouvrier_attendance FOR SELECT
    USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()));
CREATE POLICY "Insert ouvrier_attendance" ON public.ouvrier_attendance FOR INSERT
    WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()));
CREATE POLICY "Update ouvrier_attendance" ON public.ouvrier_attendance FOR UPDATE
    USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()));
CREATE POLICY "Delete ouvrier_attendance" ON public.ouvrier_attendance FOR DELETE
    USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()));


-- ============================================================
-- STORAGE BUCKETS (article photos + tenant logos)
-- ============================================================

-- Article photos bucket (article_photo_support.sql)
INSERT INTO storage.buckets (id, name, public)
VALUES ('article-photos', 'article-photos', true)
ON CONFLICT (id) DO NOTHING;

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


-- Tenant logos bucket (tenant_logo_support.sql)
INSERT INTO storage.buckets (id, name, public)
VALUES ('tenant-logos', 'tenant-logos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Root can upload tenant logos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'tenant-logos' AND public.is_root_user());

CREATE POLICY "Root can update tenant logos"
ON storage.objects FOR UPDATE
USING (bucket_id = 'tenant-logos' AND public.is_root_user())
WITH CHECK (bucket_id = 'tenant-logos' AND public.is_root_user());

CREATE POLICY "Root can delete tenant logos"
ON storage.objects FOR DELETE
USING (bucket_id = 'tenant-logos' AND public.is_root_user());

CREATE POLICY "Authenticated can view tenant logos"
ON storage.objects FOR SELECT
USING (bucket_id = 'tenant-logos' AND auth.role() = 'authenticated');


-- ============================================================
-- INDEXES (performance)
-- ============================================================
CREATE INDEX idx_tenant_members_user        ON public.tenant_members(user_id);
CREATE INDEX idx_articles_tenant            ON public.articles(tenant_id);
CREATE INDEX idx_articles_famille           ON public.articles(famille_id);
CREATE INDEX idx_articles_category          ON public.articles(category_id);
CREATE INDEX idx_stock_movements_article    ON public.stock_movements(article_id);
CREATE INDEX idx_stock_movements_tenant     ON public.stock_movements(tenant_id);
CREATE INDEX idx_services_tenant            ON public.services(tenant_id);
CREATE INDEX idx_services_client            ON public.services(client_id);
CREATE INDEX idx_service_items_service      ON public.service_items(service_id);
CREATE INDEX idx_depenses_tenant            ON public.depenses(tenant_id);
CREATE INDEX idx_ouvriers_tenant            ON public.ouvriers(tenant_id);
CREATE INDEX idx_clients_tenant             ON public.clients(tenant_id);
CREATE INDEX idx_famille_articles_tenant    ON public.famille_articles(tenant_id);
CREATE INDEX idx_article_categories_tenant  ON public.article_categories(tenant_id);
CREATE INDEX idx_salary_payments_ouvrier    ON public.salary_payments(ouvrier_id);
CREATE INDEX idx_salary_payments_tenant     ON public.salary_payments(tenant_id);
CREATE INDEX idx_salary_payments_period     ON public.salary_payments(period);
CREATE INDEX idx_fournisseurs_tenant        ON public.fournisseurs(tenant_id);
CREATE INDEX idx_ouvrier_attendance_tenant  ON public.ouvrier_attendance(tenant_id);
CREATE INDEX idx_ouvrier_attendance_ouvrier ON public.ouvrier_attendance(ouvrier_id);


-- ============================================================
-- ROOT RPC: create tenant user (root_create_tenant_user_rpc.sql)
-- ============================================================
CREATE OR REPLACE FUNCTION public.root_create_tenant_user(
    p_tenant_id UUID,
    p_email TEXT,
    p_password TEXT,
    p_full_name TEXT DEFAULT NULL,
    p_role TEXT DEFAULT 'user'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_caller UUID := auth.uid();
    v_email TEXT := lower(trim(p_email));
    v_role TEXT := CASE WHEN p_role = 'admin' THEN 'admin' ELSE 'user' END;
    v_user_id UUID := extensions.gen_random_uuid();
BEGIN
    IF v_caller IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE user_id = v_caller AND is_root = true
    ) THEN
        RAISE EXCEPTION 'Forbidden: root access required';
    END IF;

    IF p_tenant_id IS NULL OR v_email = '' OR p_password IS NULL OR p_password = '' THEN
        RAISE EXCEPTION 'Missing required fields';
    END IF;

    IF EXISTS (SELECT 1 FROM auth.users WHERE email = v_email) THEN
        RAISE EXCEPTION 'User with this email already exists';
    END IF;

    INSERT INTO auth.users (
        instance_id, id, aud, role, email, encrypted_password,
        email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at, confirmation_token,
        email_change, email_change_token_new, recovery_token
    )
    VALUES (
        '00000000-0000-0000-0000-000000000000',
        v_user_id, 'authenticated', 'authenticated', v_email,
        extensions.crypt(p_password, extensions.gen_salt('bf')),
        now(),
        jsonb_build_object('provider', 'email', 'providers', ARRAY['email']),
        CASE
            WHEN p_full_name IS NULL OR trim(p_full_name) = '' THEN '{}'::jsonb
            ELSE jsonb_build_object('full_name', trim(p_full_name))
        END,
        now(), now(), '', '', '', ''
    );

    INSERT INTO auth.identities (
        id, user_id, identity_data, provider, provider_id,
        last_sign_in_at, created_at, updated_at
    )
    VALUES (
        extensions.gen_random_uuid(), v_user_id,
        jsonb_build_object('sub', v_user_id::text, 'email', v_email),
        'email', v_user_id::text, now(), now(), now()
    );

    INSERT INTO public.tenant_members (tenant_id, user_id, role)
    VALUES (p_tenant_id, v_user_id, v_role);

    UPDATE public.profiles
    SET full_name = CASE
        WHEN p_full_name IS NULL OR trim(p_full_name) = '' THEN full_name
        ELSE trim(p_full_name)
    END
    WHERE user_id = v_user_id;

    INSERT INTO public.user_tenant_settings (user_id, current_tenant_id, updated_at)
    VALUES (v_user_id, p_tenant_id, now())
    ON CONFLICT (user_id) DO UPDATE
    SET current_tenant_id = EXCLUDED.current_tenant_id, updated_at = now();

    RETURN jsonb_build_object(
        'user_id', v_user_id,
        'email', v_email,
        'tenant_id', p_tenant_id,
        'role', v_role
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.root_create_tenant_user(UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated;


-- ============================================================
-- SEED ROOT USER (seed_root_user.sql)
-- Login: root@roby.com / rootroot
-- ============================================================
DO $$
DECLARE
    new_user_id uuid := gen_random_uuid();
BEGIN
    -- Clean up any previous root user
    DELETE FROM auth.identities WHERE provider_id IN (
        SELECT id::text FROM auth.users WHERE email = 'root@roby.com'
    );
    DELETE FROM public.profiles WHERE user_id IN (
        SELECT id FROM auth.users WHERE email = 'root@roby.com'
    );
    DELETE FROM auth.users WHERE email = 'root@roby.com';

    -- Create root user in auth.users
    INSERT INTO auth.users (
        id, instance_id, aud, role, email, encrypted_password,
        email_confirmed_at, invited_at, confirmation_token, confirmation_sent_at,
        recovery_token, recovery_sent_at, email_change_token_new, email_change,
        email_change_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data,
        is_super_admin, created_at, updated_at, phone, phone_confirmed_at,
        phone_change, phone_change_token, phone_change_sent_at,
        email_change_token_current, email_change_confirm_status,
        banned_until, reauthentication_token, reauthentication_sent_at, is_sso_user
    ) VALUES (
        new_user_id,
        '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'root@roby.com',
        crypt('rootroot', gen_salt('bf')),
        now(), NULL, '', NULL, '', NULL, '', '', NULL, NULL,
        '{"provider": "email", "providers": ["email"]}'::jsonb,
        '{"full_name": "Root Admin"}'::jsonb,
        FALSE, now(), now(), NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, FALSE
    );

    -- Create identity record (required for email login)
    INSERT INTO auth.identities (
        id, user_id, identity_data, provider, provider_id,
        last_sign_in_at, created_at, updated_at
    ) VALUES (
        new_user_id, new_user_id,
        jsonb_build_object('sub', new_user_id::text, 'email', 'root@roby.com', 'email_verified', true),
        'email', new_user_id::text, now(), now(), now()
    );

    -- Set profile as root
    INSERT INTO public.profiles (user_id, full_name, is_root)
    VALUES (new_user_id, 'Root Admin', true)
    ON CONFLICT (user_id) DO UPDATE SET is_root = true, full_name = 'Root Admin';

    RAISE NOTICE 'Root user created with ID: %', new_user_id;
END $$;


-- ============================================================
-- DISABLE CONFIRMATION EMAILS (self-hosted only)
-- ============================================================
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'auth' AND table_name = 'config' AND column_name = 'enable_signup'
    ) THEN
        UPDATE auth.config SET enable_signup = true;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'auth' AND table_name = 'config' AND column_name = 'mailer_autoconfirm'
    ) THEN
        UPDATE auth.config SET mailer_autoconfirm = true;
    END IF;
END $$;


-- ============================================================
-- DONE ✅
-- ============================================================
-- Login with:  root@roby.com / rootroot
--
-- Tables: 17
--   profiles, tenants, tenant_members, user_tenant_settings,
--   tenant_company_profiles, fournisseurs, famille_articles,
--   article_categories, articles, stock_movements, clients,
--   services, service_items, depenses, ouvriers,
--   salary_payments, ouvrier_attendance
--
-- Views: 1
--   v_stock_overview
--
-- Storage Buckets: 2
--   article-photos, tenant-logos
--
-- RPC Functions: 1
--   root_create_tenant_user()
-- ============================================================

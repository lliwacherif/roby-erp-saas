-- ============================================================
-- ROBY ERP — Supabase Schema v2.0 (COMPLETE ONE-SHOT)
-- Run this in: Supabase > SQL Editor > New Query
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. PROFILES (linked to auth.users)
-- ────────────────────────────────────────────────────────────
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

-- ────────────────────────────────────────────────────────────
-- 2. TENANTS (multi-tenant workspaces)
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.tenants (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name       TEXT NOT NULL,
    slug       TEXT NOT NULL UNIQUE,
    created_by UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ────────────────────────────────────────────────────────────
-- 3. TENANT MEMBERS (user ↔ tenant membership)
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.tenant_members (
    tenant_id  UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role       TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, user_id)
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

-- ────────────────────────────────────────────────────────────
-- 4. USER TENANT SETTINGS (last selected tenant)
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.user_tenant_settings (
    user_id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    current_tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ────────────────────────────────────────────────────────────
-- 5. FAMILLE ARTICLES (article families/groups)
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.famille_articles (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id  UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name       TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ────────────────────────────────────────────────────────────
-- 6. ARTICLE CATEGORIES (sub-categories under families)
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.article_categories (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id  UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    famille_id UUID NOT NULL REFERENCES public.famille_articles(id) ON DELETE CASCADE,
    name       TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ────────────────────────────────────────────────────────────
-- 7. ARTICLES (inventory items)
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.articles (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    famille_id  UUID NOT NULL REFERENCES public.famille_articles(id) ON DELETE RESTRICT,
    category_id UUID NOT NULL REFERENCES public.article_categories(id) ON DELETE RESTRICT,
    nom         TEXT NOT NULL,
    couleur     TEXT,
    prix_achat  NUMERIC NOT NULL DEFAULT 0,
    qte_on_hand INTEGER NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ────────────────────────────────────────────────────────────
-- 8. STOCK MOVEMENTS (audit trail for stock changes)
-- ────────────────────────────────────────────────────────────
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

-- ────────────────────────────────────────────────────────────
-- 9. CLIENTS
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.clients (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id  UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    full_name  TEXT NOT NULL,
    phone      TEXT,
    email      TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ────────────────────────────────────────────────────────────
-- 10. SERVICES (vente / location)
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.services (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id      UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    client_id      UUID NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
    type           TEXT NOT NULL CHECK (type IN ('location', 'vente')),
    status         TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'confirmed', 'returned', 'cancelled')),
    rental_start   DATE,
    rental_end     DATE,
    rental_deposit NUMERIC DEFAULT 0,
    total          NUMERIC NOT NULL DEFAULT 0,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ────────────────────────────────────────────────────────────
-- 11. SERVICE ITEMS (line items per service)
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.service_items (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id  UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
    article_id UUID NOT NULL REFERENCES public.articles(id) ON DELETE RESTRICT,
    qty        INTEGER NOT NULL,
    unit_price NUMERIC NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ────────────────────────────────────────────────────────────
-- 12. DEPENSES (expenses)
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.depenses (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    type        TEXT NOT NULL CHECK (type IN ('depense_interne', 'voyage', 'retouche_article')),
    amount      NUMERIC NOT NULL,
    article_id  UUID REFERENCES public.articles(id) ON DELETE SET NULL,
    spent_at    DATE NOT NULL DEFAULT CURRENT_DATE,
    label       TEXT,
    description TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ────────────────────────────────────────────────────────────
-- 13. OUVRIERS (workers) — with salary management fields
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.ouvriers (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id    UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name         TEXT NOT NULL,
    cin          TEXT NOT NULL,
    salaire_base NUMERIC NOT NULL,
    joined_at    DATE,
    pay_day      INTEGER CHECK (pay_day >= 1 AND pay_day <= 28),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ────────────────────────────────────────────────────────────
-- 14. SALARY PAYMENTS (monthly salary tracking)
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.salary_payments (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    ouvrier_id  UUID NOT NULL REFERENCES public.ouvriers(id) ON DELETE CASCADE,
    amount      NUMERIC NOT NULL DEFAULT 0,
    period      TEXT NOT NULL,
    paid_at     TIMESTAMPTZ DEFAULT now(),
    notes       TEXT,
    created_at  TIMESTAMPTZ DEFAULT now(),
    UNIQUE(ouvrier_id, period)
);


-- ============================================================
-- VIEWS
-- ============================================================

CREATE OR REPLACE VIEW public.v_stock_overview AS
SELECT
    a.id,
    a.tenant_id,
    a.nom,
    a.couleur,
    ac.name  AS category_name,
    fa.name  AS famille_name,
    a.prix_achat,
    a.qte_on_hand + COALESCE(SUM(sm.qty_delta), 0) AS qte_on_hand
FROM public.articles a
LEFT JOIN public.stock_movements sm ON sm.article_id = a.id
LEFT JOIN public.article_categories ac ON ac.id = a.category_id
LEFT JOIN public.famille_articles fa ON fa.id = a.famille_id
GROUP BY a.id, a.tenant_id, a.nom, a.couleur, ac.name, fa.name, a.prix_achat, a.qte_on_hand;


-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_member_of(tid UUID)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.tenant_members
        WHERE tenant_id = tid AND user_id = auth.uid()
    );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_root_user()
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE user_id = auth.uid() AND is_root = true
    );
$$ LANGUAGE sql SECURITY DEFINER STABLE;


-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

ALTER TABLE public.profiles             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenants              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_members       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_tenant_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.famille_articles     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.article_categories   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.articles             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_items        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.depenses             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ouvriers             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salary_payments      ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE POLICY "Users can view own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Root can view all profiles"
    ON public.profiles FOR SELECT
    USING (public.is_root_user());

CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = user_id);

-- Tenants
CREATE POLICY "Members can view their tenants"
    ON public.tenants FOR SELECT
    USING (
        id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid())
        OR public.is_root_user()
    );

CREATE POLICY "Authenticated users can create tenants"
    ON public.tenants FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can update their tenants"
    ON public.tenants FOR UPDATE
    USING (
        id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND role = 'admin')
        OR public.is_root_user()
    );

CREATE POLICY "Admins can delete their tenants"
    ON public.tenants FOR DELETE
    USING (
        id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND role = 'admin')
        OR public.is_root_user()
    );

-- Tenant Members
CREATE POLICY "Members can view co-members"
    ON public.tenant_members FOR SELECT
    USING (
        tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid())
        OR public.is_root_user()
    );

CREATE POLICY "Admins can add members"
    ON public.tenant_members FOR INSERT
    WITH CHECK (
        tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND role = 'admin')
        OR public.is_root_user()
    );

CREATE POLICY "Admins can remove members"
    ON public.tenant_members FOR DELETE
    USING (
        tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND role = 'admin')
        OR public.is_root_user()
    );

-- User Tenant Settings
CREATE POLICY "Users can manage own settings"
    ON public.user_tenant_settings FOR ALL
    USING (auth.uid() = user_id);

-- famille_articles
CREATE POLICY "Access famille_articles" ON public.famille_articles FOR SELECT USING (public.is_member_of(tenant_id) OR public.is_root_user());
CREATE POLICY "Insert famille_articles" ON public.famille_articles FOR INSERT WITH CHECK (public.is_member_of(tenant_id) OR public.is_root_user());
CREATE POLICY "Update famille_articles" ON public.famille_articles FOR UPDATE USING (public.is_member_of(tenant_id) OR public.is_root_user());
CREATE POLICY "Delete famille_articles" ON public.famille_articles FOR DELETE USING (public.is_member_of(tenant_id) OR public.is_root_user());

-- article_categories
CREATE POLICY "Access article_categories" ON public.article_categories FOR SELECT USING (public.is_member_of(tenant_id) OR public.is_root_user());
CREATE POLICY "Insert article_categories" ON public.article_categories FOR INSERT WITH CHECK (public.is_member_of(tenant_id) OR public.is_root_user());
CREATE POLICY "Update article_categories" ON public.article_categories FOR UPDATE USING (public.is_member_of(tenant_id) OR public.is_root_user());
CREATE POLICY "Delete article_categories" ON public.article_categories FOR DELETE USING (public.is_member_of(tenant_id) OR public.is_root_user());

-- articles
CREATE POLICY "Access articles" ON public.articles FOR SELECT USING (public.is_member_of(tenant_id) OR public.is_root_user());
CREATE POLICY "Insert articles" ON public.articles FOR INSERT WITH CHECK (public.is_member_of(tenant_id) OR public.is_root_user());
CREATE POLICY "Update articles" ON public.articles FOR UPDATE USING (public.is_member_of(tenant_id) OR public.is_root_user());
CREATE POLICY "Delete articles" ON public.articles FOR DELETE USING (public.is_member_of(tenant_id) OR public.is_root_user());

-- stock_movements
CREATE POLICY "Access stock_movements" ON public.stock_movements FOR SELECT USING (public.is_member_of(tenant_id) OR public.is_root_user());
CREATE POLICY "Insert stock_movements" ON public.stock_movements FOR INSERT WITH CHECK (public.is_member_of(tenant_id) OR public.is_root_user());

-- clients
CREATE POLICY "Access clients" ON public.clients FOR SELECT USING (public.is_member_of(tenant_id) OR public.is_root_user());
CREATE POLICY "Insert clients" ON public.clients FOR INSERT WITH CHECK (public.is_member_of(tenant_id) OR public.is_root_user());
CREATE POLICY "Update clients" ON public.clients FOR UPDATE USING (public.is_member_of(tenant_id) OR public.is_root_user());
CREATE POLICY "Delete clients" ON public.clients FOR DELETE USING (public.is_member_of(tenant_id) OR public.is_root_user());

-- services
CREATE POLICY "Access services" ON public.services FOR SELECT USING (public.is_member_of(tenant_id) OR public.is_root_user());
CREATE POLICY "Insert services" ON public.services FOR INSERT WITH CHECK (public.is_member_of(tenant_id) OR public.is_root_user());
CREATE POLICY "Update services" ON public.services FOR UPDATE USING (public.is_member_of(tenant_id) OR public.is_root_user());

-- service_items
CREATE POLICY "Access service_items" ON public.service_items FOR SELECT USING (public.is_member_of(tenant_id) OR public.is_root_user());
CREATE POLICY "Insert service_items" ON public.service_items FOR INSERT WITH CHECK (public.is_member_of(tenant_id) OR public.is_root_user());

-- depenses
CREATE POLICY "Access depenses" ON public.depenses FOR SELECT USING (public.is_member_of(tenant_id) OR public.is_root_user());
CREATE POLICY "Insert depenses" ON public.depenses FOR INSERT WITH CHECK (public.is_member_of(tenant_id) OR public.is_root_user());
CREATE POLICY "Update depenses" ON public.depenses FOR UPDATE USING (public.is_member_of(tenant_id) OR public.is_root_user());
CREATE POLICY "Delete depenses" ON public.depenses FOR DELETE USING (public.is_member_of(tenant_id) OR public.is_root_user());

-- ouvriers
CREATE POLICY "Access ouvriers" ON public.ouvriers FOR SELECT USING (public.is_member_of(tenant_id) OR public.is_root_user());
CREATE POLICY "Insert ouvriers" ON public.ouvriers FOR INSERT WITH CHECK (public.is_member_of(tenant_id) OR public.is_root_user());
CREATE POLICY "Update ouvriers" ON public.ouvriers FOR UPDATE USING (public.is_member_of(tenant_id) OR public.is_root_user());
CREATE POLICY "Delete ouvriers" ON public.ouvriers FOR DELETE USING (public.is_member_of(tenant_id) OR public.is_root_user());

-- salary_payments
CREATE POLICY "Access salary_payments" ON public.salary_payments FOR SELECT USING (public.is_member_of(tenant_id) OR public.is_root_user());
CREATE POLICY "Insert salary_payments" ON public.salary_payments FOR INSERT WITH CHECK (public.is_member_of(tenant_id) OR public.is_root_user());
CREATE POLICY "Delete salary_payments" ON public.salary_payments FOR DELETE USING (public.is_member_of(tenant_id) OR public.is_root_user());


-- ============================================================
-- INDEXES (performance)
-- ============================================================
CREATE INDEX idx_tenant_members_user       ON public.tenant_members(user_id);
CREATE INDEX idx_articles_tenant           ON public.articles(tenant_id);
CREATE INDEX idx_articles_famille          ON public.articles(famille_id);
CREATE INDEX idx_articles_category         ON public.articles(category_id);
CREATE INDEX idx_stock_movements_article   ON public.stock_movements(article_id);
CREATE INDEX idx_stock_movements_tenant    ON public.stock_movements(tenant_id);
CREATE INDEX idx_services_tenant           ON public.services(tenant_id);
CREATE INDEX idx_services_client           ON public.services(client_id);
CREATE INDEX idx_service_items_service     ON public.service_items(service_id);
CREATE INDEX idx_depenses_tenant           ON public.depenses(tenant_id);
CREATE INDEX idx_ouvriers_tenant           ON public.ouvriers(tenant_id);
CREATE INDEX idx_clients_tenant            ON public.clients(tenant_id);
CREATE INDEX idx_famille_articles_tenant   ON public.famille_articles(tenant_id);
CREATE INDEX idx_article_categories_tenant ON public.article_categories(tenant_id);
CREATE INDEX idx_salary_payments_ouvrier   ON public.salary_payments(ouvrier_id);
CREATE INDEX idx_salary_payments_tenant    ON public.salary_payments(tenant_id);
CREATE INDEX idx_salary_payments_period    ON public.salary_payments(period);

-- ============================================================
-- DONE
-- ============================================================

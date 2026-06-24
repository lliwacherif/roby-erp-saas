-- ============================================================
-- ROBY - Module Achats / Procure-to-Pay
-- Apply after sql/ROBY_FULL_REBUILD.sql on existing databases.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.purchase_orders (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id      UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    fournisseur_id UUID NOT NULL REFERENCES public.fournisseurs(id) ON DELETE RESTRICT,
    status         TEXT NOT NULL DEFAULT 'en_attente_reception'
                   CHECK (status IN ('en_attente_reception', 'partiellement_recu', 'recu', 'annule')),
    total_ht       NUMERIC NOT NULL DEFAULT 0,
    total_ttc      NUMERIC NOT NULL DEFAULT 0,
    notes          TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.purchase_order_items (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id         UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    purchase_order_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
    article_id        UUID NOT NULL REFERENCES public.articles(id) ON DELETE RESTRICT,
    qty_ordered       INTEGER NOT NULL CHECK (qty_ordered > 0),
    unit_price        NUMERIC NOT NULL CHECK (unit_price >= 0),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.purchase_receipts (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id         UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    purchase_order_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE RESTRICT,
    fournisseur_id    UUID NOT NULL REFERENCES public.fournisseurs(id) ON DELETE RESTRICT,
    status            TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'validated', 'cancelled')),
    received_at       DATE NOT NULL DEFAULT CURRENT_DATE,
    notes             TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.purchase_receipt_items (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id              UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    purchase_receipt_id    UUID NOT NULL REFERENCES public.purchase_receipts(id) ON DELETE CASCADE,
    purchase_order_item_id UUID NOT NULL REFERENCES public.purchase_order_items(id) ON DELETE RESTRICT,
    article_id             UUID NOT NULL REFERENCES public.articles(id) ON DELETE RESTRICT,
    qty_received           INTEGER NOT NULL CHECK (qty_received >= 0),
    unit_price             NUMERIC NOT NULL CHECK (unit_price >= 0),
    lot_number             TEXT NOT NULL,
    expiry_date            DATE NOT NULL,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.purchase_invoices (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id         UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    fournisseur_id    UUID NOT NULL REFERENCES public.fournisseurs(id) ON DELETE RESTRICT,
    purchase_order_id UUID REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
    purchase_receipt_id UUID REFERENCES public.purchase_receipts(id) ON DELETE SET NULL,
    purchase_return_id UUID,
    kind              TEXT NOT NULL DEFAULT 'invoice' CHECK (kind IN ('invoice', 'credit_note')),
    invoice_number    TEXT,
    invoice_date      DATE NOT NULL DEFAULT CURRENT_DATE,
    total_ttc         NUMERIC NOT NULL DEFAULT 0,
    document_path     TEXT,
    document_url      TEXT,
    status            TEXT NOT NULL DEFAULT 'recorded' CHECK (status IN ('recorded', 'matched', 'disputed', 'cancelled')),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.purchase_returns (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    purchase_receipt_id UUID NOT NULL REFERENCES public.purchase_receipts(id) ON DELETE RESTRICT,
    fournisseur_id      UUID NOT NULL REFERENCES public.fournisseurs(id) ON DELETE RESTRICT,
    status              TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'validated', 'cancelled')),
    returned_at         DATE NOT NULL DEFAULT CURRENT_DATE,
    reason              TEXT,
    credit_invoice_id   UUID REFERENCES public.purchase_invoices(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.purchase_invoices
    DROP CONSTRAINT IF EXISTS purchase_invoices_purchase_return_id_fkey;

ALTER TABLE public.purchase_invoices
    ADD CONSTRAINT purchase_invoices_purchase_return_id_fkey
    FOREIGN KEY (purchase_return_id) REFERENCES public.purchase_returns(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.purchase_return_items (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    purchase_return_id       UUID NOT NULL REFERENCES public.purchase_returns(id) ON DELETE CASCADE,
    purchase_receipt_item_id UUID NOT NULL REFERENCES public.purchase_receipt_items(id) ON DELETE RESTRICT,
    article_id               UUID NOT NULL REFERENCES public.articles(id) ON DELETE RESTRICT,
    qty_returned             INTEGER NOT NULL CHECK (qty_returned > 0),
    reason                   TEXT,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Receipt validation posts stock movements exactly once.
CREATE OR REPLACE FUNCTION public.trg_purchase_receipt_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    ordered_qty INTEGER;
    received_qty INTEGER;
BEGIN
    IF NEW.status = 'validated' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
        INSERT INTO public.stock_movements (tenant_id, article_id, qty_delta, reason, ref_table, ref_id)
        SELECT
            pri.tenant_id,
            pri.article_id,
            pri.qty_received,
            'purchase_receipt #' || LEFT(NEW.id::text, 8),
            'purchase_receipt_items',
            pri.id
        FROM public.purchase_receipt_items pri
        WHERE pri.purchase_receipt_id = NEW.id
          AND pri.qty_received > 0
          AND NOT EXISTS (
              SELECT 1
              FROM public.stock_movements sm
              WHERE sm.ref_table = 'purchase_receipt_items'
                AND sm.ref_id = pri.id
          );

        SELECT COALESCE(SUM(qty_ordered), 0)
        INTO ordered_qty
        FROM public.purchase_order_items
        WHERE purchase_order_id = NEW.purchase_order_id;

        SELECT COALESCE(SUM(pri.qty_received), 0)
        INTO received_qty
        FROM public.purchase_receipt_items pri
        JOIN public.purchase_receipts pr ON pr.id = pri.purchase_receipt_id
        WHERE pr.purchase_order_id = NEW.purchase_order_id
          AND pr.status = 'validated';

        UPDATE public.purchase_orders
        SET status = CASE
                WHEN ordered_qty > 0 AND received_qty >= ordered_qty THEN 'recu'
                WHEN received_qty > 0 THEN 'partiellement_recu'
                ELSE 'en_attente_reception'
            END,
            updated_at = now()
        WHERE id = NEW.purchase_order_id
          AND status <> 'annule';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_purchase_receipt_stock ON public.purchase_receipts;
CREATE TRIGGER trg_purchase_receipt_stock
AFTER INSERT OR UPDATE OF status ON public.purchase_receipts
FOR EACH ROW
EXECUTE FUNCTION public.trg_purchase_receipt_stock();

-- Return validation deducts stock exactly once.
CREATE OR REPLACE FUNCTION public.trg_purchase_return_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF NEW.status = 'validated' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
        INSERT INTO public.stock_movements (tenant_id, article_id, qty_delta, reason, ref_table, ref_id)
        SELECT
            pri.tenant_id,
            pri.article_id,
            -pri.qty_returned,
            'purchase_return #' || LEFT(NEW.id::text, 8),
            'purchase_return_items',
            pri.id
        FROM public.purchase_return_items pri
        WHERE pri.purchase_return_id = NEW.id
          AND pri.qty_returned > 0
          AND NOT EXISTS (
              SELECT 1
              FROM public.stock_movements sm
              WHERE sm.ref_table = 'purchase_return_items'
                AND sm.ref_id = pri.id
          );
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_purchase_return_stock ON public.purchase_returns;
CREATE TRIGGER trg_purchase_return_stock
AFTER INSERT OR UPDATE OF status ON public.purchase_returns
FOR EACH ROW
EXECUTE FUNCTION public.trg_purchase_return_stock();

DROP TRIGGER IF EXISTS set_timestamp_purchase_orders ON public.purchase_orders;
CREATE TRIGGER set_timestamp_purchase_orders
BEFORE UPDATE ON public.purchase_orders
FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();

DROP TRIGGER IF EXISTS set_timestamp_purchase_receipts ON public.purchase_receipts;
CREATE TRIGGER set_timestamp_purchase_receipts
BEFORE UPDATE ON public.purchase_receipts
FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();

DROP TRIGGER IF EXISTS set_timestamp_purchase_invoices ON public.purchase_invoices;
CREATE TRIGGER set_timestamp_purchase_invoices
BEFORE UPDATE ON public.purchase_invoices
FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();

DROP TRIGGER IF EXISTS set_timestamp_purchase_returns ON public.purchase_returns;
CREATE TRIGGER set_timestamp_purchase_returns
BEFORE UPDATE ON public.purchase_returns
FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();

ALTER TABLE public.purchase_orders        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_items   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_receipts      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_receipt_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_invoices      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_returns       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_return_items  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Access purchase_orders" ON public.purchase_orders;
DROP POLICY IF EXISTS "Insert purchase_orders" ON public.purchase_orders;
DROP POLICY IF EXISTS "Update purchase_orders" ON public.purchase_orders;
DROP POLICY IF EXISTS "Delete purchase_orders" ON public.purchase_orders;
CREATE POLICY "Access purchase_orders" ON public.purchase_orders FOR SELECT USING (public.is_member_of(tenant_id) OR public.is_root_user());
CREATE POLICY "Insert purchase_orders" ON public.purchase_orders FOR INSERT WITH CHECK (public.is_member_of(tenant_id) OR public.is_root_user());
CREATE POLICY "Update purchase_orders" ON public.purchase_orders FOR UPDATE USING (public.is_member_of(tenant_id) OR public.is_root_user());
CREATE POLICY "Delete purchase_orders" ON public.purchase_orders FOR DELETE USING (public.is_member_of(tenant_id) OR public.is_root_user());

DROP POLICY IF EXISTS "Access purchase_order_items" ON public.purchase_order_items;
DROP POLICY IF EXISTS "Insert purchase_order_items" ON public.purchase_order_items;
DROP POLICY IF EXISTS "Update purchase_order_items" ON public.purchase_order_items;
CREATE POLICY "Access purchase_order_items" ON public.purchase_order_items FOR SELECT USING (public.is_member_of(tenant_id) OR public.is_root_user());
CREATE POLICY "Insert purchase_order_items" ON public.purchase_order_items FOR INSERT WITH CHECK (public.is_member_of(tenant_id) OR public.is_root_user());
CREATE POLICY "Update purchase_order_items" ON public.purchase_order_items FOR UPDATE USING (public.is_member_of(tenant_id) OR public.is_root_user());

DROP POLICY IF EXISTS "Access purchase_receipts" ON public.purchase_receipts;
DROP POLICY IF EXISTS "Insert purchase_receipts" ON public.purchase_receipts;
DROP POLICY IF EXISTS "Update purchase_receipts" ON public.purchase_receipts;
CREATE POLICY "Access purchase_receipts" ON public.purchase_receipts FOR SELECT USING (public.is_member_of(tenant_id) OR public.is_root_user());
CREATE POLICY "Insert purchase_receipts" ON public.purchase_receipts FOR INSERT WITH CHECK (public.is_member_of(tenant_id) OR public.is_root_user());
CREATE POLICY "Update purchase_receipts" ON public.purchase_receipts FOR UPDATE USING (public.is_member_of(tenant_id) OR public.is_root_user());

DROP POLICY IF EXISTS "Access purchase_receipt_items" ON public.purchase_receipt_items;
DROP POLICY IF EXISTS "Insert purchase_receipt_items" ON public.purchase_receipt_items;
CREATE POLICY "Access purchase_receipt_items" ON public.purchase_receipt_items FOR SELECT USING (public.is_member_of(tenant_id) OR public.is_root_user());
CREATE POLICY "Insert purchase_receipt_items" ON public.purchase_receipt_items FOR INSERT WITH CHECK (public.is_member_of(tenant_id) OR public.is_root_user());

DROP POLICY IF EXISTS "Access purchase_invoices" ON public.purchase_invoices;
DROP POLICY IF EXISTS "Insert purchase_invoices" ON public.purchase_invoices;
DROP POLICY IF EXISTS "Update purchase_invoices" ON public.purchase_invoices;
CREATE POLICY "Access purchase_invoices" ON public.purchase_invoices FOR SELECT USING (public.is_member_of(tenant_id) OR public.is_root_user());
CREATE POLICY "Insert purchase_invoices" ON public.purchase_invoices FOR INSERT WITH CHECK (public.is_member_of(tenant_id) OR public.is_root_user());
CREATE POLICY "Update purchase_invoices" ON public.purchase_invoices FOR UPDATE USING (public.is_member_of(tenant_id) OR public.is_root_user());

DROP POLICY IF EXISTS "Access purchase_returns" ON public.purchase_returns;
DROP POLICY IF EXISTS "Insert purchase_returns" ON public.purchase_returns;
DROP POLICY IF EXISTS "Update purchase_returns" ON public.purchase_returns;
CREATE POLICY "Access purchase_returns" ON public.purchase_returns FOR SELECT USING (public.is_member_of(tenant_id) OR public.is_root_user());
CREATE POLICY "Insert purchase_returns" ON public.purchase_returns FOR INSERT WITH CHECK (public.is_member_of(tenant_id) OR public.is_root_user());
CREATE POLICY "Update purchase_returns" ON public.purchase_returns FOR UPDATE USING (public.is_member_of(tenant_id) OR public.is_root_user());

DROP POLICY IF EXISTS "Access purchase_return_items" ON public.purchase_return_items;
DROP POLICY IF EXISTS "Insert purchase_return_items" ON public.purchase_return_items;
CREATE POLICY "Access purchase_return_items" ON public.purchase_return_items FOR SELECT USING (public.is_member_of(tenant_id) OR public.is_root_user());
CREATE POLICY "Insert purchase_return_items" ON public.purchase_return_items FOR INSERT WITH CHECK (public.is_member_of(tenant_id) OR public.is_root_user());

INSERT INTO storage.buckets (id, name, public)
VALUES ('purchase-invoices', 'purchase-invoices', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Members can view purchase invoices" ON storage.objects;
DROP POLICY IF EXISTS "Members can upload purchase invoices" ON storage.objects;
DROP POLICY IF EXISTS "Members can update purchase invoices" ON storage.objects;
DROP POLICY IF EXISTS "Members can delete purchase invoices" ON storage.objects;

CREATE POLICY "Members can view purchase invoices"
ON storage.objects FOR SELECT
USING (
    bucket_id = 'purchase-invoices'
    AND (
        public.is_root_user()
        OR (
            split_part(name, '/', 1) ~* '^[0-9a-f-]{36}$'
            AND public.is_member_of((split_part(name, '/', 1))::uuid)
        )
    )
);

CREATE POLICY "Members can upload purchase invoices"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'purchase-invoices'
    AND (
        public.is_root_user()
        OR (
            split_part(name, '/', 1) ~* '^[0-9a-f-]{36}$'
            AND public.is_member_of((split_part(name, '/', 1))::uuid)
        )
    )
);

CREATE POLICY "Members can update purchase invoices"
ON storage.objects FOR UPDATE
USING (
    bucket_id = 'purchase-invoices'
    AND (
        public.is_root_user()
        OR (
            split_part(name, '/', 1) ~* '^[0-9a-f-]{36}$'
            AND public.is_member_of((split_part(name, '/', 1))::uuid)
        )
    )
)
WITH CHECK (
    bucket_id = 'purchase-invoices'
    AND (
        public.is_root_user()
        OR (
            split_part(name, '/', 1) ~* '^[0-9a-f-]{36}$'
            AND public.is_member_of((split_part(name, '/', 1))::uuid)
        )
    )
);

CREATE POLICY "Members can delete purchase invoices"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'purchase-invoices'
    AND (
        public.is_root_user()
        OR (
            split_part(name, '/', 1) ~* '^[0-9a-f-]{36}$'
            AND public.is_member_of((split_part(name, '/', 1))::uuid)
        )
    )
);

CREATE INDEX IF NOT EXISTS idx_purchase_orders_tenant ON public.purchase_orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier ON public.purchase_orders(fournisseur_id);
CREATE INDEX IF NOT EXISTS idx_purchase_order_items_order ON public.purchase_order_items(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_purchase_receipts_tenant ON public.purchase_receipts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_purchase_receipts_order ON public.purchase_receipts(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_purchase_receipt_items_receipt ON public.purchase_receipt_items(purchase_receipt_id);
CREATE INDEX IF NOT EXISTS idx_purchase_invoices_tenant ON public.purchase_invoices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_purchase_returns_tenant ON public.purchase_returns(tenant_id);
CREATE INDEX IF NOT EXISTS idx_purchase_return_items_return ON public.purchase_return_items(purchase_return_id);


-- ============================================================
-- Safe delete helpers used by the Achats UI
-- ============================================================

CREATE OR REPLACE FUNCTION public.purchase_delete_order(p_order_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_tenant_id UUID;
BEGIN
    SELECT tenant_id INTO v_tenant_id
    FROM public.purchase_orders
    WHERE id = p_order_id;

    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'Bon de commande introuvable.';
    END IF;

    IF NOT (public.is_root_user() OR public.is_member_of(v_tenant_id)) THEN
        RAISE EXCEPTION 'Acces refuse.';
    END IF;

    IF EXISTS (SELECT 1 FROM public.purchase_receipts WHERE purchase_order_id = p_order_id) THEN
        RAISE EXCEPTION 'Impossible de supprimer ce BC: un BR est deja lie.';
    END IF;

    DELETE FROM public.purchase_orders WHERE id = p_order_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.purchase_delete_receipt(p_receipt_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_tenant_id UUID;
    v_status TEXT;
BEGIN
    SELECT tenant_id, status INTO v_tenant_id, v_status
    FROM public.purchase_receipts
    WHERE id = p_receipt_id;

    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'Bon de reception introuvable.';
    END IF;

    IF NOT (public.is_root_user() OR public.is_member_of(v_tenant_id)) THEN
        RAISE EXCEPTION 'Acces refuse.';
    END IF;

    IF EXISTS (SELECT 1 FROM public.purchase_returns WHERE purchase_receipt_id = p_receipt_id) THEN
        RAISE EXCEPTION 'Impossible de supprimer ce BR: un avoir/retour est deja lie.';
    END IF;

    IF v_status = 'validated' THEN
        INSERT INTO public.stock_movements (tenant_id, article_id, qty_delta, reason, ref_table, ref_id)
        SELECT
            tenant_id,
            article_id,
            -qty_received,
            'delete_purchase_receipt #' || LEFT(p_receipt_id::text, 8),
            'purchase_receipts',
            p_receipt_id
        FROM public.purchase_receipt_items
        WHERE purchase_receipt_id = p_receipt_id
          AND qty_received > 0;
    END IF;

    DELETE FROM public.purchase_receipts WHERE id = p_receipt_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.purchase_delete_invoice(p_invoice_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_tenant_id UUID;
BEGIN
    SELECT tenant_id INTO v_tenant_id
    FROM public.purchase_invoices
    WHERE id = p_invoice_id;

    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'Facture introuvable.';
    END IF;

    IF NOT (public.is_root_user() OR public.is_member_of(v_tenant_id)) THEN
        RAISE EXCEPTION 'Acces refuse.';
    END IF;

    UPDATE public.purchase_returns
    SET credit_invoice_id = NULL
    WHERE credit_invoice_id = p_invoice_id;

    DELETE FROM public.purchase_invoices WHERE id = p_invoice_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.purchase_delete_return(p_return_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_tenant_id UUID;
    v_status TEXT;
BEGIN
    SELECT tenant_id, status INTO v_tenant_id, v_status
    FROM public.purchase_returns
    WHERE id = p_return_id;

    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'Avoir/retour introuvable.';
    END IF;

    IF NOT (public.is_root_user() OR public.is_member_of(v_tenant_id)) THEN
        RAISE EXCEPTION 'Acces refuse.';
    END IF;

    IF v_status = 'validated' THEN
        INSERT INTO public.stock_movements (tenant_id, article_id, qty_delta, reason, ref_table, ref_id)
        SELECT
            tenant_id,
            article_id,
            qty_returned,
            'delete_purchase_return #' || LEFT(p_return_id::text, 8),
            'purchase_returns',
            p_return_id
        FROM public.purchase_return_items
        WHERE purchase_return_id = p_return_id
          AND qty_returned > 0;
    END IF;

    UPDATE public.purchase_invoices
    SET purchase_return_id = NULL
    WHERE purchase_return_id = p_return_id;

    DELETE FROM public.purchase_returns WHERE id = p_return_id;
END;
$$;

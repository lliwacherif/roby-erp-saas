-- ==============================================================================
-- FIX CASCADING DELETIONS FOR SERVICES & CLIENTS
-- ==============================================================================
-- Issue: Deleting a Client fails if they have Services because of `ON DELETE RESTRICT`.
-- Issue: Deleting a Service fails if it has Service Items because of `ON DELETE RESTRICT` (or missing cascade on some setups).

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Services -> Clients (ON DELETE CASCADE)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.services
    DROP CONSTRAINT IF EXISTS services_client_id_fkey,
    ADD CONSTRAINT services_client_id_fkey
        FOREIGN KEY (client_id)
        REFERENCES public.clients(id)
        ON DELETE CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Service Items -> Services (ON DELETE CASCADE)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.service_items
    DROP CONSTRAINT IF EXISTS service_items_service_id_fkey,
    ADD CONSTRAINT service_items_service_id_fkey
        FOREIGN KEY (service_id)
        REFERENCES public.services(id)
        ON DELETE CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Stock Movements -> Service Items (ON DELETE CASCADE using triggers/fkeys if needed)
-- Note: Stock movements uses a polymorphic relation (ref_id).
-- Instead of a hard foreign key, we can clean them up via a trigger 
-- OR rely on application logic. If left orphaned, they drift.
-- Let's add a trigger to automatically clean stock_movements when a service is deleted.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.trg_cascade_delete_stock_movements_from_services()
RETURNS TRIGGER AS $$
BEGIN
    -- Delete any movement directly tied to the service (legacy)
    DELETE FROM public.stock_movements WHERE ref_table = 'services' AND ref_id = OLD.id;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cascade_service_movements ON public.services;
CREATE TRIGGER trg_cascade_service_movements
    BEFORE DELETE ON public.services
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_cascade_delete_stock_movements_from_services();

-- And for service_items
CREATE OR REPLACE FUNCTION public.trg_cascade_delete_stock_movements_from_items()
RETURNS TRIGGER AS $$
BEGIN
    -- Delete any movement tied to the individual line item (new rental format)
    DELETE FROM public.stock_movements WHERE ref_table = 'service_items' AND ref_id = OLD.id;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cascade_item_movements ON public.service_items;
CREATE TRIGGER trg_cascade_item_movements
    BEFORE DELETE ON public.service_items
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_cascade_delete_stock_movements_from_items();

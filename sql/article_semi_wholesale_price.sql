-- Migration: Add semi-wholesale sale price to articles
-- Run this once in the Supabase SQL editor before deploying the frontend change.

ALTER TABLE public.articles
ADD COLUMN IF NOT EXISTS prix_vente_semi_gros DECIMAL(10, 2) NOT NULL DEFAULT 0;

-- Seed existing articles with a sensible value. You can edit per article later.
UPDATE public.articles
SET prix_vente_semi_gros = prix_vente_gros
WHERE prix_vente_semi_gros = 0
  AND prix_vente_gros IS NOT NULL
  AND prix_vente_gros > 0;

-- Recreate stock overview so article pages can read the new price from the same source.
DROP VIEW IF EXISTS public.v_stock_overview;

CREATE OR REPLACE VIEW public.v_stock_overview AS
SELECT
    a.id,
    a.tenant_id,
    a.nom,
    a.famille_id,
    a.category_id,
    a.fournisseur_id,
    a.couleur,
    ac.name AS category_name,
    fa.name AS famille_name,
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
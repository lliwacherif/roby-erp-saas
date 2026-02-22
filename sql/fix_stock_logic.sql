-- Purpose: Replace the existing v_stock_overview to include ALL fields from the `articles` table so the frontend can use it interchangeably as the main Article source of truth, but with mathematically perfect `qte_on_hand` totals.

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
    ac.name  AS category_name,
    fa.name  AS famille_name,
    a.prix_achat,
    a.prix_vente_detail,
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
    a.prix_vente_gros,
    a.prix_location_min,
    a.prix_location_max,
    a.photo_url,
    a.qte_on_hand,
    a.created_at,
    a.updated_at;

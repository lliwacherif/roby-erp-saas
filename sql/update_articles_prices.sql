-- Migration: Add retail and wholesale prices to articles table
ALTER TABLE articles
ADD COLUMN IF NOT EXISTS prix_vente_detail DECIMAL(10, 2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS prix_vente_gros DECIMAL(10, 2) NOT NULL DEFAULT 0;

-- Also update view if necessary (recreate if view uses SELECT *)
-- Let's explicitly recreate v_stock_overview to include the new fields, if needed.
DROP VIEW IF EXISTS v_stock_overview;
CREATE VIEW v_stock_overview AS
SELECT 
    a.id,
    a.tenant_id,
    a.nom,
    a.couleur,
    c.name as category_name,
    f.name as famille_name,
    a.prix_achat,
    a.prix_vente_detail,
    a.prix_vente_gros,
    a.qte_on_hand
FROM articles a
LEFT JOIN article_categories c ON a.category_id = c.id
LEFT JOIN famille_articles f ON a.famille_id = f.id;

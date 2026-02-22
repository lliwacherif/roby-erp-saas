-- Add fournisseur_id to articles table
ALTER TABLE articles
ADD COLUMN fournisseur_id UUID REFERENCES fournisseurs(id) ON DELETE SET NULL;

-- Enable RLS on the new relationship (if not inherently covered by existing policies)
-- Usually adding a column doesn't break RLS, but just to be sure

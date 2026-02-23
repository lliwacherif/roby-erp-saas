-- Expanding the depenses.type CHECK constraint to include the new generic categories.
-- In Supabase/PostgreSQL, since we might not be using a strict ENUM type, but rather a CHECK constraint on a text column, we need to replace the check constraint.

ALTER TABLE public.depenses DROP CONSTRAINT IF EXISTS depenses_type_check;

ALTER TABLE public.depenses ADD CONSTRAINT depenses_type_check CHECK (
  type IN (
    'depense_interne', 
    'voyage', 
    'retouche_article', 
    'equipment', 
    'utilities', 
    'marketing', 
    'maintenance', 
    'software', 
    'insurance', 
    'taxes', 
    'office_supplies', 
    'other'
  )
);

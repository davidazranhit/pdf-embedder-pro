-- Remove the check constraint that limits category values
ALTER TABLE pdf_templates DROP CONSTRAINT IF EXISTS pdf_templates_category_check;
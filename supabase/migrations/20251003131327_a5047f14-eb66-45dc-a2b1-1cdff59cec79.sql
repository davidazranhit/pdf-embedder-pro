-- Add category column to pdf_templates table
ALTER TABLE public.pdf_templates 
ADD COLUMN category TEXT NOT NULL DEFAULT 'בסיסי נתונים' 
CHECK (category IN ('בסיסי נתונים', 'מונחה עצמים', 'חישוביות וסיבוכיות'));
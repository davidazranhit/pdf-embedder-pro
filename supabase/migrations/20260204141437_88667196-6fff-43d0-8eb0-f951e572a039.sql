-- Update RLS policies so editors ONLY see their own data (not legacy NULL-owner items)
-- Admins can see everything including legacy items

-- pdf_templates policies
DROP POLICY IF EXISTS "Users can view templates" ON public.pdf_templates;
CREATE POLICY "Users can view templates" 
ON public.pdf_templates 
FOR SELECT 
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR (owner_id = auth.uid())
);

-- categories policies
DROP POLICY IF EXISTS "Users can view categories" ON public.categories;
CREATE POLICY "Users can view categories" 
ON public.categories 
FOR SELECT 
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR (owner_id = auth.uid())
);

-- courses policies
DROP POLICY IF EXISTS "Admins and editors can view courses" ON public.courses;
CREATE POLICY "Users can view courses" 
ON public.courses 
FOR SELECT 
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR (owner_id = auth.uid())
);

-- file_requests policies - editors only see requests linked to their courses
DROP POLICY IF EXISTS "Users can view file requests" ON public.file_requests;
CREATE POLICY "Users can view file requests" 
ON public.file_requests 
FOR SELECT 
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR (owner_id = auth.uid())
);
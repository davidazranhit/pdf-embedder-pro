-- Fix courses RLS: public can only see active courses (for form dropdown)
-- Authenticated users see only their own OR admin sees all
DROP POLICY IF EXISTS "Users can view courses" ON public.courses;

-- Policy for public access (unauthenticated) - only active courses for form dropdown
CREATE POLICY "Public can view active courses" 
ON public.courses 
FOR SELECT 
USING (
  is_active = true AND auth.uid() IS NULL
);

-- Policy for authenticated users - admins see all, editors see only their own
CREATE POLICY "Authenticated users can view courses" 
ON public.courses 
FOR SELECT 
USING (
  auth.uid() IS NOT NULL AND (
    has_role(auth.uid(), 'admin'::app_role) 
    OR (owner_id = auth.uid())
  )
);
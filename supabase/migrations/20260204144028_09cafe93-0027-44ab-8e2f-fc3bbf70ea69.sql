-- Fix courses RLS: Allow anyone to see active courses for the public form dropdown
-- But editors in settings only see their own courses
DROP POLICY IF EXISTS "Public can view active courses" ON public.courses;
DROP POLICY IF EXISTS "Authenticated users can view courses" ON public.courses;

-- Single policy that handles all cases:
-- 1. Anyone (public or authenticated) can see active courses for dropdown
-- 2. Admins can see all courses (including inactive)
-- 3. Editors can see all their own courses (including inactive)
CREATE POLICY "Anyone can view courses for form dropdown" 
ON public.courses 
FOR SELECT 
USING (
  is_active = true 
  OR has_role(auth.uid(), 'admin'::app_role) 
  OR owner_id = auth.uid()
);
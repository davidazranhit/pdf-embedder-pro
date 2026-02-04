-- Allow public (unauthenticated) users to see courses for the file request dropdown
-- This is safe as courses only contain name and id
DROP POLICY IF EXISTS "Users can view courses" ON public.courses;
CREATE POLICY "Users can view courses" 
ON public.courses 
FOR SELECT 
USING (
  is_active = true 
  OR has_role(auth.uid(), 'admin'::app_role) 
  OR (owner_id = auth.uid())
);
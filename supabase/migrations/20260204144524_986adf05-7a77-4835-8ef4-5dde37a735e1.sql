-- Allow public (anonymous) users to insert file requests
-- This is needed for the public request form

-- Check if insert policy exists and drop it
DROP POLICY IF EXISTS "Public can insert file requests" ON public.file_requests;
DROP POLICY IF EXISTS "Anyone can create file requests" ON public.file_requests;

-- Create policy to allow anyone (including anonymous) to insert file requests
CREATE POLICY "Anyone can create file requests" 
ON public.file_requests 
FOR INSERT 
WITH CHECK (true);
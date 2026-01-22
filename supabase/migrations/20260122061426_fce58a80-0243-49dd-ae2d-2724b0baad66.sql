-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Admins can view trusted combinations" ON public.trusted_combinations;
DROP POLICY IF EXISTS "Admins can create trusted combinations" ON public.trusted_combinations;
DROP POLICY IF EXISTS "Admins can delete trusted combinations" ON public.trusted_combinations;
DROP POLICY IF EXISTS "Public can check trusted combinations" ON public.trusted_combinations;

-- Create permissive policies matching the project pattern
CREATE POLICY "Anyone can view trusted combinations"
ON public.trusted_combinations
FOR SELECT
USING (true);

CREATE POLICY "Anyone can create trusted combinations"
ON public.trusted_combinations
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Anyone can delete trusted combinations"
ON public.trusted_combinations
FOR DELETE
USING (true);
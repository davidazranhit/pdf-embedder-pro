-- Create trusted_combinations table for automatic file sending
CREATE TABLE public.trusted_combinations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  id_number TEXT NOT NULL,
  course_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID,
  UNIQUE(email, id_number, course_name)
);

-- Enable RLS
ALTER TABLE public.trusted_combinations ENABLE ROW LEVEL SECURITY;

-- Create RLS policies - only admins can manage trusted combinations
CREATE POLICY "Admins can view trusted combinations"
ON public.trusted_combinations
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can create trusted combinations"
ON public.trusted_combinations
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete trusted combinations"
ON public.trusted_combinations
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- Also allow public read for the edge function to check
CREATE POLICY "Public can check trusted combinations"
ON public.trusted_combinations
FOR SELECT
USING (true);
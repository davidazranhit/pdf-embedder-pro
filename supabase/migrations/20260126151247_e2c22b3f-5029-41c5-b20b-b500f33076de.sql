-- Create table for manually marked suspicious combinations
CREATE TABLE public.suspicious_combinations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  id_number TEXT NOT NULL,
  marked_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.suspicious_combinations ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Anyone can view suspicious combinations"
ON public.suspicious_combinations
FOR SELECT
USING (true);

CREATE POLICY "Anyone can create suspicious combinations"
ON public.suspicious_combinations
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Anyone can delete suspicious combinations"
ON public.suspicious_combinations
FOR DELETE
USING (true);

-- Create unique constraint on email/id_number combination
CREATE UNIQUE INDEX suspicious_combinations_email_id_unique 
ON public.suspicious_combinations (LOWER(email), id_number);
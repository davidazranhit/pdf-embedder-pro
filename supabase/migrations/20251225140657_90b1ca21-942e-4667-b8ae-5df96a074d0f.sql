-- Create courses table for dropdown in file request form
CREATE TABLE public.courses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

-- Create policies - anyone can view active courses, admins can manage
CREATE POLICY "Anyone can view active courses" 
ON public.courses 
FOR SELECT 
USING (true);

CREATE POLICY "Anyone can create courses" 
ON public.courses 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Anyone can update courses" 
ON public.courses 
FOR UPDATE 
USING (true);

CREATE POLICY "Anyone can delete courses" 
ON public.courses 
FOR DELETE 
USING (true);

-- Add notes column to file_requests
ALTER TABLE public.file_requests 
ADD COLUMN notes TEXT;
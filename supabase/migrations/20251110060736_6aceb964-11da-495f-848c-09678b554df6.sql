-- Create enum for request status
CREATE TYPE public.request_status AS ENUM ('pending', 'sent');

-- Create file_requests table
CREATE TABLE public.file_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  id_number TEXT NOT NULL,
  submission_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  status request_status NOT NULL DEFAULT 'pending',
  sent_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.file_requests ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert requests (public form)
CREATE POLICY "Anyone can create file requests"
ON public.file_requests
FOR INSERT
WITH CHECK (true);

-- Allow anyone to read all requests (for admin panel)
CREATE POLICY "Anyone can view file requests"
ON public.file_requests
FOR SELECT
USING (true);

-- Allow anyone to update requests (for admin panel)
CREATE POLICY "Anyone can update file requests"
ON public.file_requests
FOR UPDATE
USING (true);

-- Create trigger for updated_at
CREATE TRIGGER update_file_requests_updated_at
BEFORE UPDATE ON public.file_requests
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();
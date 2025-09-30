-- Create storage bucket for PDF files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'pdf-files',
  'pdf-files',
  false,
  52428800, -- 50MB limit
  ARRAY['application/pdf']
);

-- Storage policies for PDF uploads
CREATE POLICY "Anyone can upload PDFs"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'pdf-files');

CREATE POLICY "Anyone can read PDFs"
ON storage.objects
FOR SELECT
USING (bucket_id = 'pdf-files');

CREATE POLICY "Anyone can update PDFs"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'pdf-files');

CREATE POLICY "Anyone can delete PDFs"
ON storage.objects
FOR DELETE
USING (bucket_id = 'pdf-files');

-- Create table for stored PDF templates
CREATE TABLE public.pdf_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on pdf_templates
ALTER TABLE public.pdf_templates ENABLE ROW LEVEL SECURITY;

-- Anyone can read templates
CREATE POLICY "Anyone can view templates"
ON public.pdf_templates
FOR SELECT
USING (true);

-- Anyone can insert templates
CREATE POLICY "Anyone can create templates"
ON public.pdf_templates
FOR INSERT
WITH CHECK (true);

-- Anyone can update templates
CREATE POLICY "Anyone can update templates"
ON public.pdf_templates
FOR UPDATE
USING (true);

-- Anyone can delete templates
CREATE POLICY "Anyone can delete templates"
ON public.pdf_templates
FOR DELETE
USING (true);

-- Function to update timestamps
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger for automatic timestamp updates
CREATE TRIGGER update_pdf_templates_updated_at
BEFORE UPDATE ON public.pdf_templates
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();
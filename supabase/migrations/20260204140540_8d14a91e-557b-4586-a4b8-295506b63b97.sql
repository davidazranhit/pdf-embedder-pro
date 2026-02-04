-- Add owner_id column to courses table
ALTER TABLE public.courses
ADD COLUMN owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Add owner_id column to pdf_templates table
ALTER TABLE public.pdf_templates
ADD COLUMN owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Add owner_id column to categories table
ALTER TABLE public.categories
ADD COLUMN owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Add owner_id column to file_requests table
ALTER TABLE public.file_requests
ADD COLUMN owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Create editor_settings table for per-editor configuration
CREATE TABLE public.editor_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  sender_email text,
  sender_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on editor_settings
ALTER TABLE public.editor_settings ENABLE ROW LEVEL SECURITY;

-- Editor can view and edit their own settings
CREATE POLICY "Users can manage their own editor settings"
ON public.editor_settings FOR ALL
USING (auth.uid() = user_id);

-- Admins can view all editor settings
CREATE POLICY "Admins can view all editor settings"
ON public.editor_settings FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Update RLS policies for courses - editors see only their own, admins see all
DROP POLICY IF EXISTS "Anyone can create courses" ON public.courses;
DROP POLICY IF EXISTS "Anyone can delete courses" ON public.courses;
DROP POLICY IF EXISTS "Anyone can update courses" ON public.courses;
DROP POLICY IF EXISTS "Anyone can view active courses" ON public.courses;

CREATE POLICY "Admins and editors can view courses"
ON public.courses FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR owner_id = auth.uid()
  OR owner_id IS NULL
);

CREATE POLICY "Editors can create their own courses"
ON public.courses FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR (has_role(auth.uid(), 'editor'::app_role) AND owner_id = auth.uid())
);

CREATE POLICY "Editors can update their own courses"
ON public.courses FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR owner_id = auth.uid()
);

CREATE POLICY "Editors can delete their own courses"
ON public.courses FOR DELETE
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR owner_id = auth.uid()
);

-- Update RLS policies for categories
DROP POLICY IF EXISTS "Anyone can create categories" ON public.categories;
DROP POLICY IF EXISTS "Anyone can delete categories" ON public.categories;
DROP POLICY IF EXISTS "Anyone can update categories" ON public.categories;
DROP POLICY IF EXISTS "Anyone can view categories" ON public.categories;

CREATE POLICY "Users can view categories"
ON public.categories FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR owner_id = auth.uid()
  OR owner_id IS NULL
);

CREATE POLICY "Users can create categories"
ON public.categories FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR (has_role(auth.uid(), 'editor'::app_role) AND owner_id = auth.uid())
);

CREATE POLICY "Users can update their categories"
ON public.categories FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR owner_id = auth.uid()
);

CREATE POLICY "Users can delete their categories"
ON public.categories FOR DELETE
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR owner_id = auth.uid()
);

-- Update RLS policies for pdf_templates
DROP POLICY IF EXISTS "Anyone can create templates" ON public.pdf_templates;
DROP POLICY IF EXISTS "Anyone can delete templates" ON public.pdf_templates;
DROP POLICY IF EXISTS "Anyone can update templates" ON public.pdf_templates;
DROP POLICY IF EXISTS "Anyone can view templates" ON public.pdf_templates;

CREATE POLICY "Users can view templates"
ON public.pdf_templates FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR owner_id = auth.uid()
  OR owner_id IS NULL
);

CREATE POLICY "Users can create templates"
ON public.pdf_templates FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR (has_role(auth.uid(), 'editor'::app_role) AND owner_id = auth.uid())
);

CREATE POLICY "Users can update their templates"
ON public.pdf_templates FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR owner_id = auth.uid()
);

CREATE POLICY "Users can delete their templates"
ON public.pdf_templates FOR DELETE
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR owner_id = auth.uid()
);

-- Update RLS policies for file_requests
DROP POLICY IF EXISTS "Anyone can create file requests" ON public.file_requests;
DROP POLICY IF EXISTS "Anyone can update file requests" ON public.file_requests;
DROP POLICY IF EXISTS "Anyone can view file requests" ON public.file_requests;
DROP POLICY IF EXISTS "Admins can delete file requests" ON public.file_requests;

-- Public can create requests (for the public form)
CREATE POLICY "Anyone can create file requests"
ON public.file_requests FOR INSERT
WITH CHECK (true);

-- Admins and owners can view requests
CREATE POLICY "Users can view file requests"
ON public.file_requests FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR owner_id = auth.uid()
  OR owner_id IS NULL
);

-- Admins and owners can update requests
CREATE POLICY "Users can update file requests"
ON public.file_requests FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR owner_id = auth.uid()
);

-- Admins and owners can delete requests
CREATE POLICY "Users can delete file requests"
ON public.file_requests FOR DELETE
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR owner_id = auth.uid()
);

-- Add trigger for updated_at on editor_settings
CREATE TRIGGER handle_editor_settings_updated_at
BEFORE UPDATE ON public.editor_settings
FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
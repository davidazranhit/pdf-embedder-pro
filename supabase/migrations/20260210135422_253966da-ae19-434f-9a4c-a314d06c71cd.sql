
-- Create download_logs table to track file downloads
CREATE TABLE public.download_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email text NOT NULL,
  file_name text NOT NULL,
  file_path text NOT NULL,
  downloaded_at timestamp with time zone NOT NULL DEFAULT now(),
  ip_address text,
  user_agent text
);

-- Enable RLS
ALTER TABLE public.download_logs ENABLE ROW LEVEL SECURITY;

-- Only admins and editors can view download logs
CREATE POLICY "Admins can view download logs"
  ON public.download_logs
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Edge function (service role) can insert logs
CREATE POLICY "Service can insert download logs"
  ON public.download_logs
  FOR INSERT
  WITH CHECK (true);

-- Create index for faster lookups
CREATE INDEX idx_download_logs_email ON public.download_logs(email);
CREATE INDEX idx_download_logs_downloaded_at ON public.download_logs(downloaded_at DESC);


CREATE TABLE public.cs24_auto_send_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  email text,
  id_number text,
  course_name text,
  request_id uuid,
  duration_ms integer,
  api_status integer,
  outcome text NOT NULL,
  reason text,
  matched_student jsonb,
  error_message text
);

CREATE INDEX idx_cs24_logs_created_at ON public.cs24_auto_send_logs (created_at DESC);

GRANT SELECT, INSERT ON public.cs24_auto_send_logs TO authenticated;
GRANT ALL ON public.cs24_auto_send_logs TO service_role;

ALTER TABLE public.cs24_auto_send_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view cs24 logs"
ON public.cs24_auto_send_logs
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service can insert cs24 logs"
ON public.cs24_auto_send_logs
FOR INSERT
TO authenticated, anon
WITH CHECK (true);

ALTER TABLE public.file_requests
  ADD COLUMN IF NOT EXISTS referrer text,
  ADD COLUMN IF NOT EXISTS landing_url text,
  ADD COLUMN IF NOT EXISTS utm_source text,
  ADD COLUMN IF NOT EXISTS utm_medium text,
  ADD COLUMN IF NOT EXISTS utm_campaign text,
  ADD COLUMN IF NOT EXISTS utm_content text,
  ADD COLUMN IF NOT EXISTS utm_term text,
  ADD COLUMN IF NOT EXISTS traffic_source text;

CREATE INDEX IF NOT EXISTS idx_file_requests_utm_source ON public.file_requests(utm_source);
CREATE INDEX IF NOT EXISTS idx_file_requests_traffic_source ON public.file_requests(traffic_source);
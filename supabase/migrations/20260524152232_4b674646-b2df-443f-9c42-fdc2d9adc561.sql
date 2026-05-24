
CREATE TABLE IF NOT EXISTS public.external_api_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL UNIQUE,
  api_key text,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.external_api_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage external api settings"
ON public.external_api_settings
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER set_external_api_settings_updated_at
BEFORE UPDATE ON public.external_api_settings
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

INSERT INTO public.external_api_settings (provider, config)
VALUES ('cs24', '{"tutor_id": "1", "base_url": "https://api.cs24.co.il/tutor/students/export"}'::jsonb)
ON CONFLICT (provider) DO NOTHING;

ALTER TABLE public.file_requests
ADD COLUMN IF NOT EXISTS auto_sent boolean NOT NULL DEFAULT false;

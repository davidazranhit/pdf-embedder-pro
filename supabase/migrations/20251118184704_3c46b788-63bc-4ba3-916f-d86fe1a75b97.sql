-- Create watermark_settings table
CREATE TABLE IF NOT EXISTS public.watermark_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  positions jsonb NOT NULL DEFAULT '[
    {"type": "top-right", "enabled": true},
    {"type": "top-left", "enabled": false},
    {"type": "bottom-right", "enabled": true},
    {"type": "bottom-left", "enabled": true},
    {"type": "center", "enabled": true}
  ]'::jsonb,
  font_size integer NOT NULL DEFAULT 10,
  opacity numeric NOT NULL DEFAULT 0.4,
  center_rotation integer NOT NULL DEFAULT 45,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.watermark_settings ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read settings (admins need to read them for processing)
CREATE POLICY "Anyone can view watermark settings"
  ON public.watermark_settings
  FOR SELECT
  USING (true);

-- Allow anyone to insert/update settings (since we only have admin users)
CREATE POLICY "Anyone can manage watermark settings"
  ON public.watermark_settings
  FOR ALL
  USING (true);

-- Add trigger for updated_at
CREATE TRIGGER update_watermark_settings_updated_at
  BEFORE UPDATE ON public.watermark_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Insert default settings
INSERT INTO public.watermark_settings (id, positions, font_size, opacity, center_rotation)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  '[
    {"type": "top-right", "enabled": true},
    {"type": "top-left", "enabled": false},
    {"type": "bottom-right", "enabled": true},
    {"type": "bottom-left", "enabled": true},
    {"type": "center", "enabled": true}
  ]'::jsonb,
  10,
  0.4,
  45
)
ON CONFLICT (id) DO NOTHING;
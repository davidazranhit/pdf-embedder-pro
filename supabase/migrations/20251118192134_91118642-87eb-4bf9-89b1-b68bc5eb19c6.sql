-- Add hidden watermark settings to watermark_settings table
ALTER TABLE watermark_settings
ADD COLUMN IF NOT EXISTS hidden_watermark_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS hidden_watermark_font_size integer DEFAULT 24,
ADD COLUMN IF NOT EXISTS hidden_watermark_opacity numeric DEFAULT 0.12,
ADD COLUMN IF NOT EXISTS hidden_watermark_row_spacing integer DEFAULT 15,
ADD COLUMN IF NOT EXISTS hidden_watermark_col_spacing integer DEFAULT 10;

-- Update existing row with default values
UPDATE watermark_settings
SET 
  hidden_watermark_enabled = true,
  hidden_watermark_font_size = 24,
  hidden_watermark_opacity = 0.12,
  hidden_watermark_row_spacing = 15,
  hidden_watermark_col_spacing = 10
WHERE id = '00000000-0000-0000-0000-000000000001';
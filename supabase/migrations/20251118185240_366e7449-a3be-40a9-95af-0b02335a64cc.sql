-- Add per-position settings to watermark_settings table
ALTER TABLE watermark_settings
ADD COLUMN position_settings JSONB DEFAULT '[
  {"type": "top-right", "enabled": true, "fontSize": 10, "opacity": 0.4, "rotation": 0},
  {"type": "top-left", "enabled": false, "fontSize": 10, "opacity": 0.4, "rotation": 0},
  {"type": "bottom-right", "enabled": true, "fontSize": 10, "opacity": 0.4, "rotation": 0},
  {"type": "bottom-left", "enabled": true, "fontSize": 10, "opacity": 0.4, "rotation": 0},
  {"type": "center", "enabled": true, "fontSize": 10, "opacity": 0.4, "rotation": 45}
]'::jsonb;

-- Add hidden watermark settings
ALTER TABLE watermark_settings
ADD COLUMN hidden_watermark_enabled BOOLEAN DEFAULT true,
ADD COLUMN hidden_watermark_font_size INTEGER DEFAULT 4,
ADD COLUMN hidden_watermark_opacity NUMERIC DEFAULT 0.02,
ADD COLUMN hidden_watermark_row_spacing INTEGER DEFAULT 100,
ADD COLUMN hidden_watermark_col_spacing INTEGER DEFAULT 150;

-- Update existing record with new fields
UPDATE watermark_settings
SET 
  position_settings = '[
    {"type": "top-right", "enabled": true, "fontSize": 10, "opacity": 0.4, "rotation": 0},
    {"type": "top-left", "enabled": false, "fontSize": 10, "opacity": 0.4, "rotation": 0},
    {"type": "bottom-right", "enabled": true, "fontSize": 10, "opacity": 0.4, "rotation": 0},
    {"type": "bottom-left", "enabled": true, "fontSize": 10, "opacity": 0.4, "rotation": 0},
    {"type": "center", "enabled": true, "fontSize": 10, "opacity": 0.4, "rotation": 45}
  ]'::jsonb,
  hidden_watermark_enabled = true,
  hidden_watermark_font_size = 4,
  hidden_watermark_opacity = 0.02,
  hidden_watermark_row_spacing = 100,
  hidden_watermark_col_spacing = 150
WHERE id = '00000000-0000-0000-0000-000000000001';
-- Add admin email to watermark_settings
ALTER TABLE public.watermark_settings
ADD COLUMN admin_email text DEFAULT 'davidazran014@gmail.com';

-- Add pending threshold setting
ALTER TABLE public.watermark_settings
ADD COLUMN pending_alert_threshold integer DEFAULT 5;
-- Add cover page customization fields to watermark_settings
ALTER TABLE public.watermark_settings 
ADD COLUMN IF NOT EXISTS cover_email_label text DEFAULT 'אימייל' NOT NULL,
ADD COLUMN IF NOT EXISTS cover_id_label text DEFAULT 'תעודת זהות' NOT NULL,
ADD COLUMN IF NOT EXISTS cover_success_text text DEFAULT 'בהצלחה!' NOT NULL;
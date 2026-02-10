
-- Add reminder tracking to file_requests
ALTER TABLE public.file_requests 
  ADD COLUMN reminder_sent_at timestamp with time zone DEFAULT NULL;

-- Add reminder settings to watermark_settings
ALTER TABLE public.watermark_settings 
  ADD COLUMN download_reminder_days integer DEFAULT 2,
  ADD COLUMN download_reminder_enabled boolean DEFAULT false,
  ADD COLUMN download_reminder_subject text DEFAULT 'תזכורת: הקבצים שלך ממתינים להורדה',
  ADD COLUMN download_reminder_body text DEFAULT 'שלום,

שלחנו לך קבצים לפני מספר ימים, אך שמנו לב שטרם הורדת אותם.

הקבצים זמינים להורדה למשך 3 ימים בלבד מרגע השליחה, אז מומלץ להוריד אותם בהקדם.

אם כבר הורדת את הקבצים, ניתן להתעלם מהודעה זו.';

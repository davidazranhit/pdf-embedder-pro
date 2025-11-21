-- Add email template settings to watermark_settings table
ALTER TABLE watermark_settings
ADD COLUMN IF NOT EXISTS email_subject text DEFAULT 'הקבצים המבוקשים שלך',
ADD COLUMN IF NOT EXISTS email_body text DEFAULT 'שלום,

מצורפים הקבצים שלך לקורס.

הקבצים מותאמים אישית עבורך – עם הפרטים שלך – והם נועדו לשימוש אישי בלבד.

חשוב לדעת: כל שיתוף או העתקה של הקבצים נחשבים להפרה חמורה של זכויות יוצרים, ויגררו השלכות בהתאם.';

-- Update existing row with default values
UPDATE watermark_settings
SET 
  email_subject = 'הקבצים המבוקשים שלך',
  email_body = 'שלום,

מצורפים הקבצים שלך לקורס.

הקבצים מותאמים אישית עבורך – עם הפרטים שלך – והם נועדו לשימוש אישי בלבד.

חשוב לדעת: כל שיתוף או העתקה של הקבצים נחשבים להפרה חמורה של זכויות יוצרים, ויגררו השלכות בהתאם.'
WHERE id = '00000000-0000-0000-0000-000000000001';
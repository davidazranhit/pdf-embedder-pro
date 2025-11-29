-- Add columns for file request form text customization
ALTER TABLE watermark_settings 
ADD COLUMN IF NOT EXISTS form_title text DEFAULT 'בקשת קבצים',
ADD COLUMN IF NOT EXISTS form_instructions text DEFAULT 'הוראות למילוי:

עליך להזין מייל ותעודת זהות וקורס מבוקש.

לאחר שליחת הבקשה הפרטים יועברו לבדיקה ולאחר אישור (אין טעם לעדכן ששלחתם את הבקשה, היא תטופל בהקדם) יישלחו הקבצים המבוקשים ישירות למייל עם הפרטים האישיים מוטמעים על הקבצים למניעת שיתוף והפצה.',
ADD COLUMN IF NOT EXISTS form_warning text DEFAULT 'כל ניסיון שיתוף או הפצת הקבצים מהווה הפרה חמורה של זכויות יוצרים ויטופל בהתאם';
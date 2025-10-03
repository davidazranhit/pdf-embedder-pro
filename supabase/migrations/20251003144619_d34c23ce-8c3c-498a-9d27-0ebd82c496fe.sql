-- Set lifecycle policy to automatically delete files after 3 days
UPDATE storage.buckets 
SET file_size_limit = NULL,
    allowed_mime_types = NULL,
    avif_autodetection = false
WHERE id = 'pdf-files';

-- Note: Supabase Storage doesn't support automatic file deletion via SQL.
-- Instead, we need to create a scheduled Edge Function to clean up old files.
-- The signed URLs will expire after 3 days as configured in the code.
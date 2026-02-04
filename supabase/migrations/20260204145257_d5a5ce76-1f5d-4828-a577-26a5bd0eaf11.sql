-- Tighten public INSERT policy for file_requests (avoid permissive WITH CHECK (true))
DROP POLICY IF EXISTS "Anyone can create file requests" ON public.file_requests;

CREATE POLICY "Anyone can create file requests"
ON public.file_requests
FOR INSERT
WITH CHECK (
  owner_id IS NOT NULL
  AND btrim(email) <> ''
  AND position('@' in email) > 1
  AND btrim(course_name) <> ''
  AND id_number ~ '^[0-9]{5,9}$'
);
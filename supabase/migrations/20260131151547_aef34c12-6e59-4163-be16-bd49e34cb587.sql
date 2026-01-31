-- Allow admins to delete file requests
CREATE POLICY "Admins can delete file requests"
ON public.file_requests
FOR DELETE
USING (true);
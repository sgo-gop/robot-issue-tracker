-- Add delete policy for issues
CREATE POLICY "Anyone can delete issues"
ON public.issues
FOR DELETE
TO public
USING (true);

-- Add delete policy for issue attachments
CREATE POLICY "Anyone can delete attachments"
ON public.issue_attachments
FOR DELETE
TO public
USING (true);
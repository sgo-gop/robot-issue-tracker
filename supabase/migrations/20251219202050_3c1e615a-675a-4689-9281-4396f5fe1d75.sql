-- Drop the existing restrictive upload policy
DROP POLICY IF EXISTS "Authenticated users can upload attachments" ON storage.objects;

-- Create a permissive policy allowing anyone to upload to issue-attachments bucket
CREATE POLICY "Anyone can upload attachments"
ON storage.objects
FOR INSERT
TO public
WITH CHECK (bucket_id = 'issue-attachments');
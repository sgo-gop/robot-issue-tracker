-- Drop the restrictive developer-only policy
DROP POLICY IF EXISTS "Developers can manage software versions" ON public.software_versions;

-- Create policies allowing any authenticated user to manage software versions
CREATE POLICY "Authenticated users can insert software versions" 
ON public.software_versions 
FOR INSERT 
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update software versions" 
ON public.software_versions 
FOR UPDATE 
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete software versions" 
ON public.software_versions 
FOR DELETE 
TO authenticated
USING (true);
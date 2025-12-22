-- Drop the restrictive policy
DROP POLICY IF EXISTS "Developers can manage stations" ON public.stations;

-- Create policies allowing anyone to manage stations
CREATE POLICY "Anyone can insert stations" 
ON public.stations 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Anyone can update stations" 
ON public.stations 
FOR UPDATE 
USING (true);

CREATE POLICY "Anyone can delete stations" 
ON public.stations 
FOR DELETE 
USING (true);
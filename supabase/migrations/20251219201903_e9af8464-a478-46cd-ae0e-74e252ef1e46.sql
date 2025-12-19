-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Anyone can view stations" ON public.stations;

-- Create it as a permissive policy (default)
CREATE POLICY "Anyone can view stations"
ON public.stations
FOR SELECT
TO public
USING (true);
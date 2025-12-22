-- Create software_versions table
CREATE TABLE public.software_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  version TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.software_versions ENABLE ROW LEVEL SECURITY;

-- Anyone can view versions
CREATE POLICY "Anyone can view software versions"
ON public.software_versions
FOR SELECT
USING (true);

-- Developers can manage versions
CREATE POLICY "Developers can manage software versions"
ON public.software_versions
FOR ALL
USING (has_role(auth.uid(), 'developer'::app_role));

-- Add software_version_id to issues table
ALTER TABLE public.issues 
ADD COLUMN software_version_id UUID REFERENCES public.software_versions(id);
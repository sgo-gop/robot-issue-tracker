DROP POLICY IF EXISTS "Authenticated users can insert software versions" ON public.software_versions;
DROP POLICY IF EXISTS "Authenticated users can update software versions" ON public.software_versions;
DROP POLICY IF EXISTS "Authenticated users can delete software versions" ON public.software_versions;

CREATE POLICY "Anyone can insert software versions" ON public.software_versions FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Anyone can update software versions" ON public.software_versions FOR UPDATE TO public USING (true);
CREATE POLICY "Anyone can delete software versions" ON public.software_versions FOR DELETE TO public USING (true);

-- Normalize existing values: strip everything except digits/dots, keep first 3 numeric groups
UPDATE public.software_versions
SET version = (
  SELECT string_agg(part, '.')
  FROM (
    SELECT (regexp_matches(version, '[0-9]+', 'g'))[1] AS part
    LIMIT 3
  ) s
)
WHERE version !~ '^[0-9]+\.[0-9]+\.[0-9]+$';

-- For any still not matching (e.g. fewer than 3 groups), pad with .0
UPDATE public.software_versions
SET version = version || '.0'
WHERE version ~ '^[0-9]+\.[0-9]+$';

UPDATE public.software_versions
SET version = version || '.0.0'
WHERE version ~ '^[0-9]+$';

ALTER TABLE public.software_versions DROP CONSTRAINT IF EXISTS software_versions_format_check;
ALTER TABLE public.software_versions ADD CONSTRAINT software_versions_format_check CHECK (version ~ '^[0-9]+\.[0-9]+\.[0-9]+$');
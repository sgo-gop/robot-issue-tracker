-- Add version_type to software_versions
ALTER TABLE public.software_versions
  ADD COLUMN IF NOT EXISTS version_type text NOT NULL DEFAULT 'software';

ALTER TABLE public.software_versions
  DROP CONSTRAINT IF EXISTS software_versions_type_check;
ALTER TABLE public.software_versions
  ADD CONSTRAINT software_versions_type_check CHECK (version_type IN ('software','gui','ai'));

-- Unique per (version, version_type)
DROP INDEX IF EXISTS software_versions_version_type_unique;
CREATE UNIQUE INDEX software_versions_version_type_unique
  ON public.software_versions (version_type, version);

-- Add GUI and AI version refs to issues
ALTER TABLE public.issues
  ADD COLUMN IF NOT EXISTS gui_version_id uuid,
  ADD COLUMN IF NOT EXISTS ai_version_id uuid;
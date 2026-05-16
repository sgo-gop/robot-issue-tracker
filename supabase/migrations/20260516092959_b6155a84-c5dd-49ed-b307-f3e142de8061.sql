-- Allow additional version types
ALTER TABLE public.software_versions DROP CONSTRAINT IF EXISTS software_versions_version_type_check;
ALTER TABLE public.software_versions ADD CONSTRAINT software_versions_version_type_check
  CHECK (version_type IN ('software', 'gui', 'ai', 'drive_firmware', 'safety_logic', 'safety_firmware'));

-- New optional version references on issues
ALTER TABLE public.issues
  ADD COLUMN IF NOT EXISTS drive_firmware_version_id uuid,
  ADD COLUMN IF NOT EXISTS safety_logic_version_id uuid,
  ADD COLUMN IF NOT EXISTS safety_firmware_version_id uuid,
  ADD COLUMN IF NOT EXISTS other_equipment text;
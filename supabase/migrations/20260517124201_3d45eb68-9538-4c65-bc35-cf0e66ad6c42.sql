UPDATE public.issues
SET steps_to_reproduce = CASE
  WHEN steps_to_reproduce IS NULL OR btrim(steps_to_reproduce) = '' THEN description
  WHEN description IS NULL OR btrim(description) = '' THEN steps_to_reproduce
  ELSE description || E'\n\n--- Steps to Reproduce ---\n\n' || steps_to_reproduce
END;

ALTER TABLE public.issues DROP COLUMN description;
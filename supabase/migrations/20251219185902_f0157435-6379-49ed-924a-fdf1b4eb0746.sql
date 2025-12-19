-- Fix search_path for generate_issue_number function
CREATE OR REPLACE FUNCTION public.generate_issue_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.issue_number := 'ISS-' || LPAD(nextval('public.issue_number_seq')::TEXT, 4, '0');
  RETURN NEW;
END;
$$;

-- Fix search_path for update_updated_at_column function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
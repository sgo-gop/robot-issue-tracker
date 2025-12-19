-- Update RLS policies to allow public access for issues
DROP POLICY IF EXISTS "Authenticated users can view all issues" ON public.issues;
DROP POLICY IF EXISTS "Testers can create issues" ON public.issues;
DROP POLICY IF EXISTS "Developers can update issues" ON public.issues;
DROP POLICY IF EXISTS "Reporters can update their own issues" ON public.issues;

CREATE POLICY "Anyone can view issues" ON public.issues FOR SELECT USING (true);
CREATE POLICY "Anyone can create issues" ON public.issues FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update issues" ON public.issues FOR UPDATE USING (true);

-- Update RLS for attachments
DROP POLICY IF EXISTS "Authenticated users can view attachments" ON public.issue_attachments;
DROP POLICY IF EXISTS "Users can add attachments to issues" ON public.issue_attachments;

CREATE POLICY "Anyone can view attachments" ON public.issue_attachments FOR SELECT USING (true);
CREATE POLICY "Anyone can add attachments" ON public.issue_attachments FOR INSERT WITH CHECK (true);

-- Drop user_roles table policies since we won't use them
DROP POLICY IF EXISTS "Developers can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
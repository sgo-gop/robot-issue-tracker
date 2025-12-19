-- Create enum for issue priority
CREATE TYPE public.issue_priority AS ENUM ('low', 'medium', 'high', 'critical');

-- Create enum for issue status
CREATE TYPE public.issue_status AS ENUM ('open', 'closed');

-- Create enum for issue category
CREATE TYPE public.issue_category AS ENUM ('hardware', 'software', 'mechanical', 'electrical', 'other');

-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('tester', 'developer');

-- Create stations table
CREATE TABLE public.stations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT,
  full_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create issues table
CREATE TABLE public.issues (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  issue_number TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  priority issue_priority NOT NULL DEFAULT 'medium',
  status issue_status NOT NULL DEFAULT 'open',
  category issue_category NOT NULL DEFAULT 'other',
  station_id UUID REFERENCES public.stations(id) ON DELETE SET NULL,
  steps_to_reproduce TEXT,
  expected_behavior TEXT,
  actual_behavior TEXT,
  reporter_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  closed_at TIMESTAMP WITH TIME ZONE
);

-- Create issue_attachments table for photos
CREATE TABLE public.issue_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  issue_id UUID NOT NULL REFERENCES public.issues(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create sequence for issue numbers
CREATE SEQUENCE public.issue_number_seq START 1;

-- Function to generate issue number
CREATE OR REPLACE FUNCTION public.generate_issue_number()
RETURNS TRIGGER AS $$
BEGIN
  NEW.issue_number := 'ISS-' || LPAD(nextval('public.issue_number_seq')::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate issue number
CREATE TRIGGER set_issue_number
  BEFORE INSERT ON public.issues
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_issue_number();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for issues updated_at
CREATE TRIGGER update_issues_updated_at
  BEFORE UPDATE ON public.issues
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (new.id, new.email, new.raw_user_meta_data ->> 'full_name');
  RETURN new;
END;
$$;

-- Trigger for new user
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Security definer function for role checking
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Enable RLS on all tables
ALTER TABLE public.stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.issue_attachments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for stations (everyone can read)
CREATE POLICY "Anyone can view stations" ON public.stations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Developers can manage stations" ON public.stations FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'developer'));

-- RLS Policies for user_roles
CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Developers can view all roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'developer'));

-- RLS Policies for profiles
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());

-- RLS Policies for issues
CREATE POLICY "Authenticated users can view all issues" ON public.issues FOR SELECT TO authenticated USING (true);
CREATE POLICY "Testers can create issues" ON public.issues FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'tester') OR public.has_role(auth.uid(), 'developer'));
CREATE POLICY "Developers can update issues" ON public.issues FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'developer'));
CREATE POLICY "Reporters can update their own issues" ON public.issues FOR UPDATE TO authenticated USING (reporter_id = auth.uid());

-- RLS Policies for issue_attachments
CREATE POLICY "Authenticated users can view attachments" ON public.issue_attachments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can add attachments to issues" ON public.issue_attachments FOR INSERT TO authenticated WITH CHECK (true);

-- Insert default stations
INSERT INTO public.stations (name) VALUES ('Station Alpha'), ('Station Beta');

-- Create storage bucket for issue attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('issue-attachments', 'issue-attachments', true);

-- Storage policies
CREATE POLICY "Authenticated users can upload attachments"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'issue-attachments');

CREATE POLICY "Anyone can view attachments"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'issue-attachments');
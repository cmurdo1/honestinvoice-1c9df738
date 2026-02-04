-- Create enum for roles
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create SECURITY DEFINER function to check roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Create function for frontend to check admin access
CREATE OR REPLACE FUNCTION public.check_admin_access()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'admin')
$$;

-- Drop existing permissive RLS policies on webhook_logs
DROP POLICY IF EXISTS "Authenticated users can view webhook logs" ON public.webhook_logs;

-- Drop existing permissive RLS policies on job_leads
DROP POLICY IF EXISTS "Authenticated users can view job leads" ON public.job_leads;
DROP POLICY IF EXISTS "Authenticated users can update job leads" ON public.job_leads;

-- Create admin-only policy for webhook_logs
CREATE POLICY "Admins can view webhook logs" ON public.webhook_logs
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Create admin-only policies for job_leads
CREATE POLICY "Admins can view job leads" ON public.job_leads
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update job leads" ON public.job_leads
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to view the user_roles table (needed for admin panels)
CREATE POLICY "Admins can view all roles" ON public.user_roles
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Allow users to view their own roles
CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());
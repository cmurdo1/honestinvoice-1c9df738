-- Fix RLS Security Issues (Clean Version)

-- 1. Profiles: Add DELETE policy for GDPR compliance
CREATE POLICY "Users can delete their own profile"
ON public.profiles
FOR DELETE
TO authenticated
USING (auth.uid() = id);


-- 2. job_leads: Add DELETE policy for admins
CREATE POLICY "Admins can delete job leads"
ON public.job_leads
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));


-- 3. Create a secure view for profiles that hides sensitive payment data
DROP VIEW IF EXISTS public.profiles_safe;

CREATE VIEW public.profiles_safe
WITH (security_invoker = on)
AS
SELECT 
  id,
  business_name,
  logo_url,
  email,
  address,
  phone,
  tax_rate,
  brand_color,
  created_at,
  updated_at,
  subscription_status,
  subscription_end
FROM public.profiles;

-- Grant access to the safe view
GRANT SELECT ON public.profiles_safe TO authenticated;
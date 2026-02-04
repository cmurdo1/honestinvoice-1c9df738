-- Fix profiles_safe view - need to enable RLS and add policies
-- Views don't have RLS directly, but we can grant limited access

-- Drop the view first
DROP VIEW IF EXISTS public.profiles_safe;

-- Recreate with proper security
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
FROM public.profiles
WHERE auth.uid() = id;
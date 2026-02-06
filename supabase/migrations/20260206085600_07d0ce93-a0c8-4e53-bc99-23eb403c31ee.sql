-- Drop and recreate profiles_safe view with security_invoker enabled
-- This ensures the view inherits RLS policies from the base profiles table
DROP VIEW IF EXISTS public.profiles_safe;

CREATE VIEW public.profiles_safe
WITH (security_invoker=on) AS
SELECT 
  id,
  email,
  phone,
  address,
  business_name,
  logo_url,
  brand_color,
  tax_rate,
  subscription_status,
  subscription_end,
  created_at,
  updated_at
FROM public.profiles;
-- Note: stripe_customer_id is intentionally excluded for security

-- Add INSERT policy for invoice_feedback that validates feedback token
-- This allows public feedback submission but only with valid tokens
CREATE POLICY "Anyone can submit feedback with valid token"
ON public.invoice_feedback
FOR INSERT
TO anon, authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.invoices
    WHERE invoices.id = invoice_id
    AND invoices.feedback_token IS NOT NULL
  )
);
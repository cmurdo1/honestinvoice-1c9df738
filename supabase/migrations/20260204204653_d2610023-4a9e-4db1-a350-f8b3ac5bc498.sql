-- Add extra security layer: check_admin_access now also verifies email
CREATE OR REPLACE FUNCTION public.check_admin_access()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.user_roles ur
    JOIN auth.users au ON ur.user_id = au.id
    WHERE ur.user_id = auth.uid() 
      AND ur.role = 'admin'
      AND au.email = 'crowmeista@gmail.com'
  )
$$;

-- Create trigger to prevent anyone except crowmeista@gmail.com from getting admin role
CREATE OR REPLACE FUNCTION public.enforce_admin_email_restriction()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_email TEXT;
BEGIN
  -- Only check for admin role
  IF NEW.role = 'admin' THEN
    SELECT email INTO user_email FROM auth.users WHERE id = NEW.user_id;
    
    IF user_email IS NULL OR user_email != 'crowmeista@gmail.com' THEN
      RAISE EXCEPTION 'Admin role can only be assigned to authorized accounts';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on INSERT and UPDATE
DROP TRIGGER IF EXISTS enforce_admin_restriction_trigger ON public.user_roles;
CREATE TRIGGER enforce_admin_restriction_trigger
  BEFORE INSERT OR UPDATE ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_admin_email_restriction();
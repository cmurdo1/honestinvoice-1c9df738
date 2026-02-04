-- Get all users with their profile and subscription info (admin only)
CREATE OR REPLACE FUNCTION public.get_all_users()
RETURNS TABLE (
  id uuid,
  email text,
  business_name text,
  subscription_status text,
  subscription_end timestamptz,
  created_at timestamptz,
  invoice_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    au.id,
    au.email,
    p.business_name,
    p.subscription_status,
    p.subscription_end::timestamptz,
    au.created_at,
    (SELECT COUNT(*) FROM public.invoices i WHERE i.user_id = au.id) as invoice_count
  FROM auth.users au
  LEFT JOIN public.profiles p ON p.id = au.id
  WHERE public.check_admin_access()
  ORDER BY au.created_at DESC
  LIMIT 100
$$;

-- Get system-wide statistics (admin only)
CREATE OR REPLACE FUNCTION public.get_system_stats()
RETURNS TABLE (
  total_users bigint,
  total_invoices bigint,
  total_clients bigint,
  total_revenue numeric,
  active_subscriptions bigint,
  invoices_this_month bigint,
  users_this_month bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (SELECT COUNT(*) FROM auth.users) as total_users,
    (SELECT COUNT(*) FROM public.invoices) as total_invoices,
    (SELECT COUNT(*) FROM public.clients) as total_clients,
    (SELECT COALESCE(SUM(total_amount), 0) FROM public.invoices WHERE status = 'paid') as total_revenue,
    (SELECT COUNT(*) FROM public.profiles WHERE subscription_status = 'active') as active_subscriptions,
    (SELECT COUNT(*) FROM public.invoices WHERE created_at >= date_trunc('month', now())) as invoices_this_month,
    (SELECT COUNT(*) FROM auth.users WHERE created_at >= date_trunc('month', now())) as users_this_month
  WHERE public.check_admin_access()
$$;

-- Get all feedback across all users (admin only)
CREATE OR REPLACE FUNCTION public.get_all_feedback()
RETURNS TABLE (
  id uuid,
  invoice_id uuid,
  rating integer,
  comment text,
  client_name text,
  created_at timestamptz,
  invoice_number text,
  user_email text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    f.id,
    f.invoice_id,
    f.rating,
    f.comment,
    f.client_name,
    f.created_at,
    i.invoice_number,
    au.email as user_email
  FROM public.invoice_feedback f
  JOIN public.invoices i ON i.id = f.invoice_id
  JOIN auth.users au ON au.id = i.user_id
  WHERE public.check_admin_access()
  ORDER BY f.created_at DESC
  LIMIT 100
$$;

-- Get subscription breakdown (admin only)
CREATE OR REPLACE FUNCTION public.get_subscription_stats()
RETURNS TABLE (
  status text,
  count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    COALESCE(subscription_status, 'none') as status,
    COUNT(*) as count
  FROM public.profiles
  WHERE public.check_admin_access()
  GROUP BY subscription_status
  ORDER BY count DESC
$$;
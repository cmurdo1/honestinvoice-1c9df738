-- Create helper functions for the new tables (since they're not in the auto-generated types yet)

-- Function to get webhook logs
CREATE OR REPLACE FUNCTION public.get_webhook_logs()
RETURNS SETOF public.webhook_logs
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.webhook_logs
  ORDER BY created_at DESC
  LIMIT 50
$$;

-- Function to get job leads  
CREATE OR REPLACE FUNCTION public.get_job_leads()
RETURNS SETOF public.job_leads
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.job_leads
  ORDER BY created_at DESC
  LIMIT 20
$$;

-- Function to update job lead status
CREATE OR REPLACE FUNCTION public.update_job_lead_status(lead_id UUID, new_status TEXT)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.job_leads 
  SET status = new_status, updated_at = now()
  WHERE id = lead_id
$$;
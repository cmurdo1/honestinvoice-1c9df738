-- Create webhook_logs table
CREATE TABLE public.webhook_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL DEFAULT 'unknown',
  source TEXT NOT NULL DEFAULT 'unknown',
  payload JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'received',
  response JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create job_leads table
CREATE TABLE public.job_leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  location TEXT NOT NULL,
  contact_email TEXT,
  contact_phone TEXT,
  budget_range TEXT,
  source TEXT NOT NULL DEFAULT 'manual',
  status TEXT NOT NULL DEFAULT 'new',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on both tables
ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_leads ENABLE ROW LEVEL SECURITY;

-- webhook_logs: Only service role can write (from edge functions), admins can read
-- For now, authenticated users can read webhook logs
CREATE POLICY "Authenticated users can view webhook logs"
ON public.webhook_logs
FOR SELECT
USING (auth.role() = 'authenticated');

-- job_leads: Authenticated users can manage
CREATE POLICY "Authenticated users can view job leads"
ON public.job_leads
FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update job leads"
ON public.job_leads
FOR UPDATE
USING (auth.role() = 'authenticated');

-- Add updated_at trigger to job_leads
CREATE TRIGGER update_job_leads_updated_at
BEFORE UPDATE ON public.job_leads
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
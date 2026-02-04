import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { RefreshCw, Webhook, Settings2 } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface WebhookLog {
  id: string;
  type: string;
  source: string;
  payload: Record<string, unknown>;
  status: string;
  response: Record<string, unknown> | null;
  created_at: string;
}

interface JobLead {
  id: string;
  title: string;
  description: string;
  location: string;
  contact_email: string | null;
  contact_phone: string | null;
  budget_range: string | null;
  source: string;
  status: string;
  created_at: string;
}

export function WebhookSection() {
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [leads, setLeads] = useState<JobLead[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [logsRes, leadsRes] = await Promise.all([
        supabase.rpc('get_webhook_logs'),
        supabase.rpc('get_job_leads'),
      ]);

      if (!logsRes.error && logsRes.data) {
        setLogs(logsRes.data as WebhookLog[]);
      }
      if (!leadsRes.error && leadsRes.data) {
        setLeads(leadsRes.data as JobLead[]);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to fetch webhook data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const generateBid = async (lead: JobLead) => {
    toast.info('Generating bid for lead...');
    
    try {
      const { data, error } = await supabase.functions.invoke('extract-line-items', {
        body: {
          job_description: `${lead.title}\n\nLocation: ${lead.location}\n\n${lead.description}`,
        },
      });

      if (error) throw error;

      await supabase.rpc('update_job_lead_status', { lead_id: lead.id, new_status: 'bid_generated' });

      toast.success('Bid generated!');
      fetchData();
    } catch (error) {
      console.error('Bid generation error:', error);
      toast.error('Failed to generate bid');
    }
  };

  return (
    <div className="space-y-6">
      {/* Webhook Endpoint Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Webhook Endpoint
          </CardTitle>
          <CardDescription>
            Use this endpoint to receive notifications from external services
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-3 bg-muted rounded-lg font-mono text-sm break-all">
            POST {import.meta.env.VITE_SUPABASE_URL}/functions/v1/ops-webhook
          </div>
          <div className="text-sm text-muted-foreground">
            <p className="font-medium mb-2">Required Headers:</p>
            <code className="block p-2 bg-muted rounded">
              x-webhook-secret: [your-webhook-secret]
            </code>
          </div>
        </CardContent>
      </Card>

      {/* Job Leads */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Job Leads</CardTitle>
            <CardDescription>Incoming job leads from webhooks</CardDescription>
          </div>
          <Button onClick={fetchData} variant="outline" size="sm" disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-24" />
              ))}
            </div>
          ) : leads.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No job leads yet</p>
          ) : (
            <div className="space-y-4">
              {leads.map((lead) => (
                <div key={lead.id} className="p-4 border rounded-lg space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-medium">{lead.title}</h4>
                      <p className="text-sm text-muted-foreground">{lead.location}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={lead.status === 'new' ? 'default' : 'secondary'}>
                        {lead.status}
                      </Badge>
                      <Badge variant="outline">{lead.source}</Badge>
                    </div>
                  </div>
                  <p className="text-sm">{lead.description}</p>
                  {lead.status === 'new' && (
                    <Button size="sm" onClick={() => generateBid(lead)}>
                      Generate Bid
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Webhook Logs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Webhook className="h-5 w-5" />
            Webhook Logs
          </CardTitle>
          <CardDescription>Recent webhook activity</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          ) : logs.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No webhook logs yet</p>
          ) : (
            <div className="space-y-2">
              {logs.map((log) => (
                <div key={log.id} className="p-3 border rounded-lg text-sm">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{log.type}</Badge>
                      <span className="text-muted-foreground">{log.source}</span>
                    </div>
                    <Badge variant={log.status === 'processed' ? 'default' : 'secondary'}>
                      {log.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(log.created_at), 'PPp')}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

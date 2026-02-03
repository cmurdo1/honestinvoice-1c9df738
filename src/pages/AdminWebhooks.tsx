import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { RefreshCw, Send, Webhook, Settings2, Brain, Shield } from 'lucide-react';
import { format } from 'date-fns';

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

// Your admin email - change this to your actual email
const ADMIN_EMAIL = 'admin@honestinvoice.app';

export default function AdminWebhooks() {
  const { user, session } = useAuth();
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [leads, setLeads] = useState<JobLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiProvider, setAiProvider] = useState<'lovable' | 'openrouter'>('lovable');
  const [aiModel, setAiModel] = useState('');
  const [testJobDescription, setTestJobDescription] = useState('');
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  // Simple admin check - you can customize this
  const isAdmin = user?.email === ADMIN_EMAIL || user?.email?.endsWith('@honestinvoice.app');

  useEffect(() => {
    if (isAdmin && session?.access_token) {
      fetchData();
    }
  }, [isAdmin, session?.access_token]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch webhook logs
      const { data: logsData } = await supabase
        .from('webhook_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      setLogs(logsData || []);

      // Fetch job leads
      const { data: leadsData } = await supabase
        .from('job_leads')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      setLeads(leadsData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const testAI = async () => {
    if (!testJobDescription.trim()) {
      toast.error('Enter a job description to test');
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('extract-line-items', {
        body: {
          job_description: testJobDescription,
          provider: aiProvider,
          model: aiModel || undefined,
        },
      });

      if (error) throw error;

      setTestResult(JSON.stringify(data, null, 2));
      toast.success(`AI test completed using ${data.provider_used}`);
    } catch (error) {
      console.error('AI test error:', error);
      toast.error('AI test failed');
      setTestResult(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }, null, 2));
    } finally {
      setTesting(false);
    }
  };

  const generateBid = async (lead: JobLead) => {
    toast.info('Generating bid for lead...');
    
    try {
      const { data, error } = await supabase.functions.invoke('extract-line-items', {
        body: {
          job_description: `${lead.title}\n\nLocation: ${lead.location}\n\n${lead.description}`,
          provider: aiProvider,
          model: aiModel || undefined,
        },
      });

      if (error) throw error;

      // Update lead status
      await supabase
        .from('job_leads')
        .update({ status: 'bid_generated' })
        .eq('id', lead.id);

      toast.success('Bid generated! Check the results.');
      setTestResult(JSON.stringify(data, null, 2));
      fetchData();
    } catch (error) {
      console.error('Bid generation error:', error);
      toast.error('Failed to generate bid');
    }
  };

  // Redirect non-admins
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <AppLayout>
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">Admin Dashboard</h1>
              <p className="text-muted-foreground">Webhook management & AI configuration</p>
            </div>
          </div>
          <Button onClick={fetchData} variant="outline" disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* AI Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5" />
              AI Configuration
            </CardTitle>
            <CardDescription>
              Configure AI provider and test pricing extraction
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>AI Provider</Label>
                <Select value={aiProvider} onValueChange={(v) => setAiProvider(v as 'lovable' | 'openrouter')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lovable">Lovable AI (Free Gemini)</SelectItem>
                    <SelectItem value="openrouter">OpenRouter (Custom Models)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Model (optional)</Label>
                <Input
                  placeholder={aiProvider === 'lovable' ? 'google/gemini-2.5-flash' : 'google/gemini-2.0-flash-exp:free'}
                  value={aiModel}
                  onChange={(e) => setAiModel(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Test Job Description</Label>
              <Textarea
                placeholder="Enter a job description to test AI pricing extraction..."
                value={testJobDescription}
                onChange={(e) => setTestJobDescription(e.target.value)}
                rows={4}
              />
            </div>

            <Button onClick={testAI} disabled={testing}>
              {testing ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Test AI Extraction
            </Button>

            {testResult && (
              <div className="mt-4 p-4 bg-muted rounded-lg overflow-auto max-h-96">
                <pre className="text-sm whitespace-pre-wrap">{testResult}</pre>
              </div>
            )}
          </CardContent>
        </Card>

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
              POST {import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-webhook
            </div>
            <div className="text-sm text-muted-foreground">
              <p className="font-medium mb-2">Required Headers:</p>
              <code className="block p-2 bg-muted rounded">
                x-webhook-secret: [your-webhook-secret]
              </code>
            </div>
            <div className="text-sm text-muted-foreground">
              <p className="font-medium mb-2">Example Payload:</p>
              <pre className="p-2 bg-muted rounded text-xs overflow-auto">
{`{
  "type": "job_lead",
  "source": "thumbtack",
  "data": {
    "title": "Mobile Mechanic Needed",
    "description": "Car won't start...",
    "location": "Austin, TX",
    "contact_email": "customer@email.com"
  }
}`}
              </pre>
            </div>
          </CardContent>
        </Card>

        {/* Job Leads */}
        <Card>
          <CardHeader>
            <CardTitle>Job Leads</CardTitle>
            <CardDescription>
              Incoming job leads from webhooks
            </CardDescription>
          </CardHeader>
          <CardContent>
            {leads.length === 0 ? (
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
            <CardDescription>
              Recent webhook activity
            </CardDescription>
          </CardHeader>
          <CardContent>
            {logs.length === 0 ? (
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
    </AppLayout>
  );
}

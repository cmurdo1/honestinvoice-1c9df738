import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
};

interface WebhookPayload {
  type: string;
  source: string;
  data: Record<string, unknown>;
  timestamp?: string;
}

interface JobLead {
  title: string;
  description: string;
  location: string;
  contact_email?: string;
  contact_phone?: string;
  budget_range?: string;
  source: string;
}

// Secret for webhook authentication from automated systems
const WEBHOOK_SECRET = Deno.env.get('WEBHOOK_SECRET') || 'change-this-secret';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Verify authentication
    const webhookSecret = req.headers.get('x-webhook-secret');
    const authHeader = req.headers.get('authorization');
    
    let isAuthenticated = false;
    let userId: string | null = null;

    // Check webhook secret first (for automated systems like Thumbtack, etc.)
    if (webhookSecret === WEBHOOK_SECRET) {
      isAuthenticated = true;
    }
    // Then check JWT with server-side admin role verification
    else if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '');
      
      // Create client with user's token to verify and get claims
      const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } }
      });
      
      const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getUser(token);
      
      if (!claimsError && claimsData?.user) {
        userId = claimsData.user.id;
        
        // Server-side admin check using service role client
        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
        
        const { data: hasRole, error: roleError } = await supabaseAdmin.rpc('has_role', {
          _user_id: userId,
          _role: 'admin'
        });
        
        if (!roleError && hasRole === true) {
          isAuthenticated = true;
        }
      }
    }

    if (!isAuthenticated) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use service role for data operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Handle different HTTP methods
    if (req.method === 'GET') {
      // Return recent webhook logs (for ops panel UI)
      const { data: logs, error } = await supabase
        .from('webhook_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Error fetching logs:', error);
        return new Response(
          JSON.stringify({ error: 'Failed to fetch logs', logs: [] }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ logs: logs || [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (req.method === 'POST') {
      const payload: WebhookPayload = await req.json();
      
      console.log('Received webhook:', JSON.stringify(payload));

      // Log the webhook
      const { error: logError } = await supabase
        .from('webhook_logs')
        .insert({
          type: payload.type || 'unknown',
          source: payload.source || 'unknown',
          payload: payload.data || payload,
          status: 'received',
        });

      if (logError) {
        console.error('Error logging webhook:', logError);
      }

      // Process based on type
      let response: Record<string, unknown> = { received: true };

      if (payload.type === 'job_lead') {
        // Process job lead
        const jobData = payload.data as unknown as JobLead;
        
        // Store the job lead
        const { data: lead, error: leadError } = await supabase
          .from('job_leads')
          .insert({
            title: jobData.title,
            description: jobData.description,
            location: jobData.location,
            contact_email: jobData.contact_email,
            contact_phone: jobData.contact_phone,
            budget_range: jobData.budget_range,
            source: payload.source,
            status: 'new',
          })
          .select()
          .single();

        if (leadError) {
          console.error('Error storing lead:', leadError);
          response = { ...response, lead_stored: false, error: leadError.message };
        } else {
          response = { ...response, lead_stored: true, lead_id: lead?.id };
        }
      }

      // Update log status
      await supabase
        .from('webhook_logs')
        .update({ status: 'processed', response })
        .eq('type', payload.type)
        .order('created_at', { ascending: false })
        .limit(1);

      return new Response(
        JSON.stringify(response),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Webhook error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

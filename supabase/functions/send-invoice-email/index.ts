import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[SEND-INVOICE-EMAIL] ${step}${detailsStr}`);
};

interface InvoiceEmailRequest {
  invoice_id: string;
  client_email: string;
  client_name: string;
  invoice_number: string;
  total_amount: number;
  due_date: string | null;
  business_name: string;
  job_description: string | null;
}

interface InvoiceItem {
  description: string;
  quantity: number;
  unit_price: number;
  total: number | null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) throw new Error("RESEND_API_KEY is not set");
    logStep("Resend key verified");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    
    const user = userData.user;
    if (!user) throw new Error("User not authenticated");
    logStep("User authenticated", { userId: user.id });

    // Check subscription status from database
    const { data: profile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("subscription_status, subscription_end, email")
      .eq("id", user.id)
      .single();

    if (profileError) throw new Error(`Profile fetch error: ${profileError.message}`);

    const isPro = profile?.subscription_status === 'pro' && 
      (!profile.subscription_end || new Date(profile.subscription_end) > new Date());

    if (!isPro) {
      return new Response(JSON.stringify({ 
        error: "Email sending is a Pro feature. Please upgrade to send invoices via email." 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 403,
      });
    }
    logStep("Pro subscription verified");

    const { 
      invoice_id,
      client_email, 
      client_name, 
      invoice_number,
      total_amount,
      due_date,
      business_name,
      job_description
    }: InvoiceEmailRequest = await req.json();

    if (!client_email || !invoice_number || !invoice_id) {
      throw new Error("Missing required fields: client_email, invoice_number, and invoice_id are required");
    }
    logStep("Request data validated", { invoice_number, client_email, invoice_id });

    // Fetch invoice with feedback token
    const { data: invoice, error: invoiceError } = await supabaseClient
      .from("invoices")
      .select("feedback_token")
      .eq("id", invoice_id)
      .single();

    if (invoiceError) {
      logStep("Warning: Could not fetch invoice feedback token", { error: invoiceError.message });
    }
    const feedbackToken = invoice?.feedback_token;

    // Fetch invoice line items for itemized breakdown
    const { data: lineItems, error: itemsError } = await supabaseClient
      .from("invoice_items")
      .select("description, quantity, unit_price, total")
      .eq("invoice_id", invoice_id)
      .order("sort_order", { ascending: true });

    if (itemsError) {
      logStep("Warning: Could not fetch line items", { error: itemsError.message });
    }
    logStep("Line items fetched", { count: lineItems?.length || 0 });

    const resend = new Resend(resendKey);

    const dueDateText = due_date 
      ? new Date(due_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
      : 'Upon Receipt';

    // Calculate subtotal from line items
    const subtotal = lineItems?.reduce(
      (sum, item) => sum + (item.quantity * item.unit_price),
      0
    ) || total_amount;

    // Build the itemized line items HTML - mobile optimized with stacked layout
    const lineItemsHtml = lineItems && lineItems.length > 0 
      ? lineItems.map((item: InvoiceItem) => `
          <tr>
            <td style="padding: 10px 8px; border-bottom: 1px solid #eee; color: #333; font-size: 14px; word-wrap: break-word; max-width: 150px;">${item.description}</td>
            <td style="padding: 10px 4px; border-bottom: 1px solid #eee; text-align: center; color: #666; font-size: 13px; white-space: nowrap;">${item.quantity}</td>
            <td style="padding: 10px 4px; border-bottom: 1px solid #eee; text-align: right; color: #666; font-size: 13px; white-space: nowrap;">$${item.unit_price.toFixed(2)}</td>
            <td style="padding: 10px 8px; border-bottom: 1px solid #eee; text-align: right; font-weight: 600; color: #333; font-size: 14px; white-space: nowrap;">$${(item.quantity * item.unit_price).toFixed(2)}</td>
          </tr>
        `).join('')
      : '';

    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Invoice ${invoice_number}</title>
          <style>
            @media only screen and (max-width: 480px) {
              .invoice-table th, .invoice-table td { padding: 8px 4px !important; font-size: 12px !important; }
              .invoice-container { padding: 20px 12px !important; }
              .invoice-card { padding: 20px !important; }
              .invoice-header h2 { font-size: 18px !important; }
              .invoice-header .amount { font-size: 26px !important; }
            }
          </style>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; -webkit-text-size-adjust: 100%;">
          <div class="invoice-container" style="max-width: 600px; margin: 0 auto; padding: 20px 10px;">
            <div class="invoice-card" style="background-color: white; border-radius: 12px; padding: 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
              <div style="text-align: center; margin-bottom: 20px;">
                <h1 style="color: #228B22; margin: 0; font-size: 24px;">${business_name || 'HonestInvoice'}</h1>
                <p style="color: #666; margin: 8px 0 0 0; font-size: 14px;">Professional Invoice</p>
              </div>
              
              <div class="invoice-header" style="background: linear-gradient(135deg, #228B22 0%, #1e7a1e 100%); color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                <h2 style="margin: 0 0 8px 0; font-size: 18px;">Invoice ${invoice_number}</h2>
                <p class="amount" style="margin: 0; font-size: 28px; font-weight: bold;">$${total_amount.toFixed(2)}</p>
                <p style="margin: 6px 0 0 0; font-size: 13px; opacity: 0.9;">Due: ${dueDateText}</p>
              </div>
              
              <p style="color: #333; font-size: 15px; line-height: 1.5; margin: 0 0 12px 0;">
                Hello ${client_name || 'there'},
              </p>
              
              <p style="color: #333; font-size: 15px; line-height: 1.5; margin: 0 0 16px 0;">
                Please find your invoice from <strong>${business_name || 'HonestInvoice'}</strong> below.
              </p>
              
              ${job_description ? `
                <div style="background-color: #f9f9f9; padding: 12px; border-radius: 8px; margin: 16px 0; border-left: 3px solid #228B22;">
                  <strong style="color: #333; font-size: 13px;">Job Summary:</strong>
                  <p style="color: #666; margin: 6px 0 0 0; font-size: 13px;">${job_description}</p>
                </div>
              ` : ''}
              
              ${lineItems && lineItems.length > 0 ? `
                <div style="margin: 20px 0; overflow-x: auto; -webkit-overflow-scrolling: touch;">
                  <h3 style="color: #333; margin: 0 0 12px 0; font-size: 16px;">Itemized Breakdown</h3>
                  <table class="invoice-table" style="width: 100%; border-collapse: collapse; border: 1px solid #eee; font-size: 13px; table-layout: fixed;">
                    <thead>
                      <tr style="background-color: #f9f9f9;">
                        <th style="padding: 10px 8px; text-align: left; font-weight: 600; color: #333; border-bottom: 2px solid #228B22; width: 45%;">Item</th>
                        <th style="padding: 10px 4px; text-align: center; font-weight: 600; color: #333; border-bottom: 2px solid #228B22; width: 12%;">Qty</th>
                        <th style="padding: 10px 4px; text-align: right; font-weight: 600; color: #333; border-bottom: 2px solid #228B22; width: 20%;">Rate</th>
                        <th style="padding: 10px 8px; text-align: right; font-weight: 600; color: #333; border-bottom: 2px solid #228B22; width: 23%;">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${lineItemsHtml}
                    </tbody>
                    <tfoot>
                      <tr style="background-color: #f9f9f9;">
                        <td colspan="3" style="padding: 10px 8px; text-align: right; font-weight: 600; color: #333; font-size: 13px;">Subtotal:</td>
                        <td style="padding: 10px 8px; text-align: right; font-weight: 600; color: #333; font-size: 13px;">$${subtotal.toFixed(2)}</td>
                      </tr>
                      ${total_amount !== subtotal ? `
                        <tr style="background-color: #f9f9f9;">
                          <td colspan="3" style="padding: 10px 8px; text-align: right; font-weight: 600; color: #666; font-size: 13px;">Tax:</td>
                          <td style="padding: 10px 8px; text-align: right; font-weight: 600; color: #666; font-size: 13px;">$${(total_amount - subtotal).toFixed(2)}</td>
                        </tr>
                      ` : ''}
                      <tr style="background-color: #228B22;">
                        <td colspan="3" style="padding: 12px 8px; text-align: right; font-weight: 700; color: white; font-size: 14px;">Total Due:</td>
                        <td style="padding: 12px 8px; text-align: right; font-weight: 700; color: white; font-size: 15px;">$${total_amount.toFixed(2)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              ` : `
                <table style="width: 100%; border-collapse: collapse; margin: 25px 0;">
                  <tr>
                    <td style="padding: 12px 0; border-bottom: 1px solid #eee; color: #666;">Invoice Number:</td>
                    <td style="padding: 12px 0; border-bottom: 1px solid #eee; text-align: right; font-weight: 600; color: #333;">${invoice_number}</td>
                  </tr>
                  <tr>
                    <td style="padding: 12px 0; border-bottom: 1px solid #eee; color: #666;">Amount Due:</td>
                    <td style="padding: 12px 0; border-bottom: 1px solid #eee; text-align: right; font-weight: 600; color: #228B22;">$${total_amount.toFixed(2)}</td>
                  </tr>
                  <tr>
                    <td style="padding: 12px 0; color: #666;">Due Date:</td>
                    <td style="padding: 12px 0; text-align: right; font-weight: 600; color: #333;">${dueDateText}</td>
                  </tr>
                </table>
              `}
              
              <p style="color: #666; font-size: 14px; line-height: 1.6; margin-top: 20px;">
                Thank you for your business! If you have any questions about this invoice, please don't hesitate to reach out.
              </p>
              
              ${feedbackToken ? `
                <div style="text-align: center; margin-top: 25px; padding: 20px; background-color: #f9f9f9; border-radius: 8px;">
                  <p style="color: #333; font-size: 14px; margin: 0 0 15px 0;">How was your experience?</p>
                  <a href="https://honestinvoice.com/feedback?invoice=${invoice_id}&token=${feedbackToken}" style="display: inline-block; background-color: #228B22; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600;">Leave Feedback</a>
                </div>
              ` : ''}
              
              <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
                <p style="color: #999; font-size: 12px; margin: 0 0 8px 0;">
                  Powered by <strong>HonestInvoice</strong> - Transparent invoicing made simple
                </p>
                <p style="color: #999; font-size: 11px; margin: 0;">
                  <a href="https://honestinvoice.com" style="color: #228B22; text-decoration: none;">Visit Website</a>
                  &nbsp;|&nbsp;
                  <a href="mailto:support@honestinvoice.com" style="color: #228B22; text-decoration: none;">Contact Support</a>
                  &nbsp;|&nbsp;
                  <a href="https://honestinvoice.com/privacy" style="color: #228B22; text-decoration: none;">Privacy Policy</a>
                </p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;

    // Send from HonestInvoice domain with user's business name for personalization
    const fromName = business_name ? `${business_name} via HonestInvoice` : 'HonestInvoice';
    const emailResponse = await resend.emails.send({
      from: `${fromName} <invoices@honestinvoice.com>`,
      to: [client_email],
      reply_to: profile?.email || undefined,
      subject: `Invoice ${invoice_number} from ${business_name || 'HonestInvoice'} - $${total_amount.toFixed(2)}`,
      html: emailHtml,
    });

    logStep("Email sent successfully", { emailId: emailResponse.data?.id });

    return new Response(JSON.stringify({ 
      success: true, 
      message: "Invoice email sent successfully",
      email_id: emailResponse.data?.id
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

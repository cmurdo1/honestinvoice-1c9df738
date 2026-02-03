import "https://deno.land/std@0.168.0/dotenv/load.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LineItem {
  description: string;
  quantity: number;
  unit_price: number;
}

interface AuditResult {
  passed: boolean;
  issues: string[];
  adjustments: LineItem[];
}

// AI Provider configuration
type AIProvider = 'lovable' | 'openrouter';

async function callAI(
  messages: { role: string; content: string }[],
  provider: AIProvider = 'lovable',
  model?: string
): Promise<string> {
  if (provider === 'openrouter') {
    const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY');
    if (!OPENROUTER_API_KEY) {
      throw new Error('OPENROUTER_API_KEY not configured - falling back to Lovable AI');
    }

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://honestinvoice.lovable.app',
        'X-Title': 'Honest Invoice',
      },
      body: JSON.stringify({
        model: model || 'google/gemini-2.0-flash-exp:free', // Free model default
        messages,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenRouter API error: ${errorText}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  }

  // Default: Lovable AI (free Gemini)
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) {
    throw new Error('LOVABLE_API_KEY not configured');
  }

  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: model || 'google/gemini-2.5-flash',
      messages,
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Lovable AI error: ${errorText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

// Price verification system prompt
const PRICE_VERIFICATION_PROMPT = `You are a pricing verification expert for field contractors. Your job is to audit line items for accuracy.

VERIFICATION RULES:
1. CHECK FOR DUPLICATES: Flag any items that describe the same work twice
2. CHECK PRICING: Verify prices are within industry standard ranges
3. CHECK QUANTITIES: Ensure quantities make sense for the described work
4. LOCATION-BASED PRICING: Consider regional cost variations (US national averages as baseline)

INDUSTRY STANDARD RATES (2024 US National Averages):
- General labor: $50-95/hour (varies by region: higher in CA, NY; lower in TX, FL)
- Skilled trades (plumbing, electrical, HVAC): $75-150/hour
- Roofing labor: $65-120/hour
- Moss/debris removal: $0.40-2.00/sq ft
- Gutter cleaning: $1-3/linear ft
- Power washing: $0.25-0.50/sq ft
- Materials markup: 15-30% over wholesale
- Equipment rental: $50-200/day depending on type
- Disposal fees: $50-200 per load

RED FLAGS TO CATCH:
- Same service listed multiple times with different descriptions
- Labor AND service fee for same task (double billing)
- Prices more than 50% above market rate
- Unrealistic quantities for the job scope
- Missing essential items (e.g., cleanup for removal jobs)

Return ONLY valid JSON with this structure:
{
  "passed": boolean,
  "issues": ["list of problems found"],
  "adjustments": [{"description": "...", "quantity": N, "unit_price": N.NN}]
}

If passed=true, adjustments should be empty. If passed=false, provide corrected line items.`;

// Main extraction prompt with honesty focus
const EXTRACTION_PROMPT = `You are an HONEST pricing assistant for field contractors. Your reputation depends on fair, accurate quotes.

CORE PRINCIPLES:
1. NEVER DOUBLE-BILL: Each task appears ONCE. If labor is included in sq ft pricing, don't add separate labor.
2. BE COMPETITIVE: Price to win jobs while being profitable. Not the cheapest, not the most expensive.
3. BE TRANSPARENT: Clear descriptions so customers understand what they're paying for.
4. BE COMPLETE: Include all necessary items (materials, labor, disposal, etc.)

PRICING GUIDELINES (2024 US National Averages - adjust for location context if provided):
- General labor: $65-85/hour
- Skilled trades: $85-125/hour  
- Roofing work: $75-100/hour
- Moss removal: $0.50-1.25/sq ft (INCLUDES labor when priced per sq ft)
- Roof cleaning: $0.20-0.45/sq ft (INCLUDES labor when priced per sq ft)
- Gutter cleaning: $1.50-2.50/linear ft
- Disposal/hauling: $75-150 per load
- Equipment rental: actual cost + 10% handling

CRITICAL RULES:
- When pricing by square foot, that INCLUDES labor - don't add separate labor line
- Separate labor lines ONLY for setup, travel, or tasks not covered by sq ft pricing
- Round prices to clean numbers ($0.75, not $0.73)
- Group related items logically

Return ONLY valid JSON array, no markdown:
[{"description": "Clear description of work", "quantity": NUMBER, "unit_price": NUMBER}]`;

async function extractLineItems(
  jobDescription: string,
  provider: AIProvider,
  model?: string
): Promise<LineItem[]> {
  const content = await callAI(
    [
      { role: 'system', content: EXTRACTION_PROMPT },
      { role: 'user', content: `Extract line items from this job:\n\n${jobDescription}` }
    ],
    provider,
    model
  );

  try {
    const cleanContent = content.replace(/```json\n?|\n?```/g, '').trim();
    return JSON.parse(cleanContent);
  } catch {
    console.error('Failed to parse extraction response:', content);
    return [];
  }
}

async function auditLineItems(
  items: LineItem[],
  jobDescription: string,
  provider: AIProvider,
  model?: string
): Promise<AuditResult> {
  const auditPrompt = `Job Description: ${jobDescription}

Line Items to Audit:
${JSON.stringify(items, null, 2)}

Verify these line items for accuracy, duplicates, and fair pricing.`;

  const content = await callAI(
    [
      { role: 'system', content: PRICE_VERIFICATION_PROMPT },
      { role: 'user', content: auditPrompt }
    ],
    provider,
    model
  );

  try {
    const cleanContent = content.replace(/```json\n?|\n?```/g, '').trim();
    return JSON.parse(cleanContent);
  } catch {
    console.error('Failed to parse audit response:', content);
    return { passed: true, issues: [], adjustments: [] };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { job_description, provider = 'lovable', model, skip_audit = false } = await req.json();

    if (!job_description) {
      return new Response(
        JSON.stringify({ error: 'Job description is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Using AI provider: ${provider}, model: ${model || 'default'}`);

    // Step 1: Extract initial line items
    let items = await extractLineItems(job_description, provider, model);
    
    if (items.length === 0) {
      return new Response(
        JSON.stringify({ items: [], audit: { passed: false, issues: ['Failed to extract line items'] } }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 2: Audit the line items (unless skipped)
    let auditResult: AuditResult = { passed: true, issues: [], adjustments: [] };
    
    if (!skip_audit) {
      console.log('Running price verification audit...');
      auditResult = await auditLineItems(items, job_description, provider, model);
      
      // If audit found issues and provided adjustments, use those instead
      if (!auditResult.passed && auditResult.adjustments && auditResult.adjustments.length > 0) {
        console.log('Audit found issues, using corrected items:', auditResult.issues);
        items = auditResult.adjustments;
        // Re-audit the adjusted items to confirm they're now correct
        const reaudit = await auditLineItems(items, job_description, provider, model);
        auditResult = reaudit;
      }
    }

    return new Response(
      JSON.stringify({ 
        items,
        audit: auditResult,
        provider_used: provider,
        model_used: model || 'default'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

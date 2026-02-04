import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RefreshCw, Send, Brain } from 'lucide-react';
import { toast } from 'sonner';

export function AITestingSection() {
  const [aiProvider, setAiProvider] = useState<'lovable' | 'openrouter'>('lovable');
  const [aiModel, setAiModel] = useState('');
  const [testJobDescription, setTestJobDescription] = useState('');
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5" />
          AI Configuration & Testing
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
  );
}

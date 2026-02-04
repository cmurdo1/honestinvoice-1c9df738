import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Shield, BarChart3, Users, CreditCard, MessageSquare, Webhook } from 'lucide-react';

// Admin components
import { SystemAnalytics } from '@/components/ops/SystemAnalytics';
import { UserManagement } from '@/components/ops/UserManagement';
import { SubscriptionOverview } from '@/components/ops/SubscriptionOverview';
import { FeedbackManagement } from '@/components/ops/FeedbackManagement';
import { WebhookSection } from '@/components/ops/WebhookSection';
import { AITestingSection } from '@/components/ops/AITestingSection';

export default function OpsPanel() {
  const { user, session } = useAuth();
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);

  // Server-side admin check using SECURITY DEFINER function
  useEffect(() => {
    const checkAccess = async () => {
      if (!session?.access_token) {
        setCheckingAccess(false);
        setHasAccess(false);
        return;
      }

      try {
        const { data, error } = await supabase.rpc('check_admin_access');
        
        if (error) {
          console.error('Access check error:', error);
          setHasAccess(false);
        } else {
          setHasAccess(data === true);
        }
      } catch (err) {
        console.error('Access check failed:', err);
        setHasAccess(false);
      } finally {
        setCheckingAccess(false);
      }
    };

    checkAccess();
  }, [session?.access_token]);

  // Redirect if not logged in
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Show loading while checking access
  if (checkingAccess) {
    return (
      <AppLayout>
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  // Redirect if no access (silently redirect to dashboard)
  if (!hasAccess) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <AppLayout>
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex items-center gap-3">
          <Shield className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Operations Panel</h1>
            <p className="text-muted-foreground">System administration & monitoring</p>
          </div>
        </div>

        <Tabs defaultValue="analytics" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 lg:grid-cols-6">
            <TabsTrigger value="analytics" className="gap-2">
              <BarChart3 className="h-4 w-4 hidden sm:block" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="users" className="gap-2">
              <Users className="h-4 w-4 hidden sm:block" />
              Users
            </TabsTrigger>
            <TabsTrigger value="subscriptions" className="gap-2">
              <CreditCard className="h-4 w-4 hidden sm:block" />
              Subscriptions
            </TabsTrigger>
            <TabsTrigger value="feedback" className="gap-2">
              <MessageSquare className="h-4 w-4 hidden sm:block" />
              Feedback
            </TabsTrigger>
            <TabsTrigger value="webhooks" className="gap-2">
              <Webhook className="h-4 w-4 hidden sm:block" />
              Webhooks
            </TabsTrigger>
            <TabsTrigger value="ai" className="gap-2">
              AI Testing
            </TabsTrigger>
          </TabsList>

          <TabsContent value="analytics">
            <SystemAnalytics />
          </TabsContent>

          <TabsContent value="users">
            <UserManagement />
          </TabsContent>

          <TabsContent value="subscriptions">
            <SubscriptionOverview />
          </TabsContent>

          <TabsContent value="feedback">
            <FeedbackManagement />
          </TabsContent>

          <TabsContent value="webhooks">
            <WebhookSection />
          </TabsContent>

          <TabsContent value="ai">
            <AITestingSection />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

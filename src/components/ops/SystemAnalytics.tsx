import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, FileText, Building2, DollarSign, CreditCard, TrendingUp } from 'lucide-react';

interface SystemStats {
  total_users: number;
  total_invoices: number;
  total_clients: number;
  total_revenue: number;
  active_subscriptions: number;
  invoices_this_month: number;
  users_this_month: number;
}

export function SystemAnalytics() {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      const { data, error } = await supabase.rpc('get_system_stats');
      if (!error && data && data.length > 0) {
        setStats(data[0] as SystemStats);
      }
      setLoading(false);
    };
    fetchStats();
  }, []);

  const statCards = [
    { label: 'Total Users', value: stats?.total_users ?? 0, icon: Users, color: 'text-blue-500' },
    { label: 'Total Invoices', value: stats?.total_invoices ?? 0, icon: FileText, color: 'text-green-500' },
    { label: 'Total Clients', value: stats?.total_clients ?? 0, icon: Building2, color: 'text-purple-500' },
    { label: 'Total Revenue', value: `$${(stats?.total_revenue ?? 0).toLocaleString()}`, icon: DollarSign, color: 'text-amber-500' },
    { label: 'Active Subscriptions', value: stats?.active_subscriptions ?? 0, icon: CreditCard, color: 'text-emerald-500' },
    { label: 'Invoices This Month', value: stats?.invoices_this_month ?? 0, icon: TrendingUp, color: 'text-cyan-500' },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          System Analytics
        </CardTitle>
        <CardDescription>Platform-wide statistics and metrics</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {statCards.map((stat) => (
              <div
                key={stat.label}
                className="flex items-center gap-4 p-4 border rounded-lg bg-muted/30"
              >
                <stat.icon className={`h-8 w-8 ${stat.color}`} />
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="text-2xl font-bold">{stat.value}</p>
                </div>
              </div>
            ))}
          </div>
        )}
        {stats && (
          <div className="mt-4 p-3 bg-muted/50 rounded-lg text-sm text-muted-foreground">
            <span className="font-medium">{stats.users_this_month}</span> new users this month
          </div>
        )}
      </CardContent>
    </Card>
  );
}

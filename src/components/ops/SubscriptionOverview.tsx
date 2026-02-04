import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { CreditCard } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

interface SubscriptionStat {
  status: string;
  count: number;
}

const COLORS = ['#10b981', '#f59e0b', '#ef4444', '#6b7280'];

export function SubscriptionOverview() {
  const [stats, setStats] = useState<SubscriptionStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      const { data, error } = await supabase.rpc('get_subscription_stats');
      if (!error && data) {
        setStats(data as SubscriptionStat[]);
      }
      setLoading(false);
    };
    fetchStats();
  }, []);

  const chartData = stats.map((s) => ({
    name: s.status === 'none' ? 'Free' : s.status.charAt(0).toUpperCase() + s.status.slice(1),
    value: Number(s.count),
  }));

  const total = chartData.reduce((acc, cur) => acc + cur.value, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Subscription Overview
        </CardTitle>
        <CardDescription>Breakdown of user subscription statuses</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-64" />
        ) : stats.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">No subscription data</p>
        ) : (
          <div className="grid md:grid-cols-2 gap-6">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {chartData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-3">
              {chartData.map((item, index) => (
                <div
                  key={item.name}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <span className="font-medium">{item.name}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold">{item.value}</span>
                    <span className="text-muted-foreground text-sm ml-2">
                      ({total > 0 ? Math.round((item.value / total) * 100) : 0}%)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

import { Link } from 'react-router-dom';
import { useInvoices, useDeleteInvoice, useUpdateInvoice } from '@/hooks/useInvoices';
import { useFeedback, useAverageRating } from '@/hooks/useFeedback';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Plus, 
  DollarSign, 
  FileText, 
  Clock,
  Loader2,
  Star,
  MessageSquare
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { cn } from '@/lib/utils';
import { InvoiceStatus } from '@/types/database';
import { SwipeableInvoiceItem } from '@/components/invoice/SwipeableInvoiceItem';
import { PullToRefreshIndicator } from '@/components/ui/pull-to-refresh-indicator';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { toast } from 'sonner';

const statusColors: Record<InvoiceStatus, string> = {
  draft: 'bg-muted text-muted-foreground',
  sent: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  paid: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  overdue: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

export default function Dashboard() {
  const { data: invoices, isLoading, refetch } = useInvoices();
  const { data: feedback, isLoading: feedbackLoading } = useFeedback();
  const averageRating = useAverageRating();
  const deleteInvoice = useDeleteInvoice();

  // Pull to refresh
  const handleRefresh = async () => {
    await refetch();
  };

  const { containerRef, isRefreshing, pullDistance } = usePullToRefresh({
    onRefresh: handleRefresh,
  });

  // Handle delete
  const handleDelete = async (id: string) => {
    try {
      await deleteInvoice.mutateAsync(id);
    } catch (error) {
      // Error toast handled by hook
    }
  };

  // Calculate monthly stats
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  const monthlyInvoices = invoices?.filter((inv) =>
    isWithinInterval(new Date(inv.created_at), { start: monthStart, end: monthEnd })
  ) || [];

  const monthlyRevenue = monthlyInvoices
    .filter((inv) => inv.status === 'paid')
    .reduce((sum, inv) => sum + Number(inv.total_amount), 0);

  const pendingAmount = invoices
    ?.filter((inv) => inv.status === 'sent')
    .reduce((sum, inv) => sum + Number(inv.total_amount), 0) || 0;

  const draftCount = invoices?.filter((inv) => inv.status === 'draft').length || 0;

  return (
    <AppLayout>
      <div ref={containerRef} className="space-y-8 overflow-auto">
        {/* Pull to refresh indicator */}
        <PullToRefreshIndicator 
          pullDistance={pullDistance} 
          isRefreshing={isRefreshing} 
        />

        {/* Header - Sticky on mobile */}
        <div className="sticky-header -mx-4 px-4 py-4 lg:static lg:mx-0 lg:px-0 lg:py-0">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Dashboard</h1>
              <p className="text-muted-foreground text-sm sm:text-base">
                {format(now, 'EEEE, MMMM d, yyyy')}
              </p>
            </div>
            {/* Hide on mobile - FAB replaces this */}
            <Button asChild size="lg" className="gap-2 hidden lg:flex">
              <Link to="/create">
                <Plus className="h-5 w-5" />
                New Invoice
              </Link>
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
          <Card className="touch-target">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Revenue This Month
              </CardTitle>
              <DollarSign className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-2xl font-bold">
                ${monthlyRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-muted-foreground">
                {monthlyInvoices.filter((i) => i.status === 'paid').length} paid invoices
              </p>
            </CardContent>
          </Card>

          <Card className="touch-target">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Pending Payments
              </CardTitle>
              <Clock className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-2xl font-bold">
                ${pendingAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-muted-foreground">
                {invoices?.filter((i) => i.status === 'sent').length || 0} awaiting payment
              </p>
            </CardContent>
          </Card>

          <Card className="touch-target">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Drafts
              </CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-2xl font-bold">{draftCount}</div>
              <p className="text-xs text-muted-foreground">
                Ready to complete
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Invoices List */}
        <Card>
          <CardHeader className="sticky-header rounded-t-lg">
            <CardTitle>Recent Invoices</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : invoices?.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <FileText className="mb-4 h-12 w-12 text-muted-foreground/50" />
                <h3 className="mb-2 text-lg font-semibold">No invoices yet</h3>
                <p className="mb-4 text-sm text-muted-foreground">
                  Create your first invoice to get started
                </p>
                <Button asChild className="min-h-[44px]">
                  <Link to="/create">
                    <Plus className="mr-2 h-4 w-4" />
                    Create Invoice
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground mb-3 lg:hidden">
                  Swipe left to delete
                </p>
                {invoices?.slice(0, 10).map((invoice) => (
                  <SwipeableInvoiceItem
                    key={invoice.id}
                    invoice={invoice}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Client Feedback */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between sticky-header rounded-t-lg">
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              Client Feedback
            </CardTitle>
            {averageRating !== null && (
              <div className="flex items-center gap-1 text-sm">
                <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                <span className="font-medium">{averageRating.toFixed(1)}</span>
                <span className="text-muted-foreground">avg</span>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {feedbackLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : !feedback || feedback.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Star className="mb-4 h-12 w-12 text-muted-foreground/50" />
                <h3 className="mb-2 text-lg font-semibold">No feedback yet</h3>
                <p className="text-sm text-muted-foreground">
                  Feedback will appear here when clients rate your invoices
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {feedback.slice(0, 5).map((fb) => (
                  <div key={fb.id} className="rounded-lg border p-4 min-h-[72px]">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium">
                            {fb.client_name || fb.client_business_name || 'Anonymous'}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            on {fb.invoice_number || 'Invoice'}
                          </span>
                        </div>
                        {fb.comment && (
                          <p className="text-sm text-muted-foreground">{fb.comment}</p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(fb.created_at), 'MMM d, yyyy')}
                        </p>
                      </div>
                      {fb.rating && (
                        <div className="flex items-center gap-0.5">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={star}
                              className={cn(
                                'h-4 w-4',
                                star <= fb.rating!
                                  ? 'fill-yellow-400 text-yellow-400'
                                  : 'text-muted-foreground/30'
                              )}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {feedback.length > 5 && (
                  <p className="text-center text-sm text-muted-foreground">
                    +{feedback.length - 5} more feedback entries
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

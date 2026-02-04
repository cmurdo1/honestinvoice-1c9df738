import { useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Trash2, Archive } from 'lucide-react';
import { useSwipeGesture } from '@/hooks/useSwipeGesture';
import { warningHaptic } from '@/lib/haptics';
import { InvoiceStatus } from '@/types/database';

interface Invoice {
  id: string;
  invoice_number: string | null;
  status: InvoiceStatus;
  total_amount: number;
  created_at: string;
  client?: { name: string } | null;
}

interface SwipeableInvoiceItemProps {
  invoice: Invoice;
  onDelete?: (id: string) => void;
  onArchive?: (id: string) => void;
}

const statusColors: Record<InvoiceStatus, string> = {
  draft: 'bg-muted text-muted-foreground',
  sent: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  paid: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  overdue: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

export function SwipeableInvoiceItem({ 
  invoice, 
  onDelete, 
  onArchive 
}: SwipeableInvoiceItemProps) {
  const [showActions, setShowActions] = useState<'left' | 'right' | null>(null);
  
  const handleSwipeLeft = useCallback(() => {
    warningHaptic();
    setShowActions('left');
    // Auto-hide after 3 seconds
    setTimeout(() => setShowActions(null), 3000);
  }, []);

  const handleSwipeRight = useCallback(() => {
    setShowActions('right');
    setTimeout(() => setShowActions(null), 3000);
  }, []);

  const { elementRef, swipeDistance, isSwiping } = useSwipeGesture({
    onSwipeLeft: onDelete ? handleSwipeLeft : undefined,
    onSwipeRight: onArchive ? handleSwipeRight : undefined,
    threshold: 80,
  });

  const handleDelete = () => {
    if (onDelete) {
      warningHaptic();
      onDelete(invoice.id);
    }
    setShowActions(null);
  };

  const handleArchive = () => {
    if (onArchive) {
      onArchive(invoice.id);
    }
    setShowActions(null);
  };

  return (
    <div className="relative overflow-hidden rounded-lg">
      {/* Background actions */}
      {onDelete && (
        <div className="absolute inset-y-0 right-0 flex items-center bg-destructive px-4">
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-transparent"
            onClick={handleDelete}
          >
            <Trash2 className="h-5 w-5" />
          </Button>
        </div>
      )}
      {onArchive && (
        <div className="absolute inset-y-0 left-0 flex items-center bg-primary px-4">
          <Button
            variant="ghost"
            size="icon"
            className="text-primary-foreground hover:bg-transparent"
            onClick={handleArchive}
          >
            <Archive className="h-5 w-5" />
          </Button>
        </div>
      )}

      {/* Main content */}
      <div
        ref={elementRef}
        style={{
          transform: isSwiping ? `translateX(${swipeDistance}px)` : 
            showActions === 'left' ? 'translateX(-64px)' :
            showActions === 'right' ? 'translateX(64px)' : 'translateX(0)',
          transition: isSwiping ? 'none' : 'transform 0.2s ease-out',
        }}
        className="relative bg-background"
      >
        <Link
          to={`/invoice/${invoice.id}`}
          className={cn(
            'flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-accent',
            'min-h-[72px] touch-target'
          )}
          onClick={(e) => {
            if (showActions) {
              e.preventDefault();
              setShowActions(null);
            }
          }}
        >
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="font-medium">
                {invoice.invoice_number || 'Draft'}
              </span>
              <Badge
                variant="secondary"
                className={cn('capitalize', statusColors[invoice.status])}
              >
                {invoice.status}
              </Badge>
            </div>
            <span className="text-sm text-muted-foreground">
              {invoice.client?.name || 'No client'} • {format(new Date(invoice.created_at), 'MMM d, yyyy')}
            </span>
          </div>
          <div className="text-right">
            <div className="font-semibold">
              ${Number(invoice.total_amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}

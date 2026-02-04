import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PullToRefreshIndicatorProps {
  pullDistance: number;
  isRefreshing: boolean;
  threshold?: number;
}

export function PullToRefreshIndicator({ 
  pullDistance, 
  isRefreshing,
  threshold = 80 
}: PullToRefreshIndicatorProps) {
  const progress = Math.min(pullDistance / threshold, 1);
  const shouldShow = pullDistance > 10 || isRefreshing;

  if (!shouldShow) return null;

  return (
    <div 
      className="flex items-center justify-center py-4 pull-indicator"
      style={{
        opacity: isRefreshing ? 1 : progress,
        transform: `translateY(${isRefreshing ? 0 : -20 + (20 * progress)}px)`,
      }}
    >
      <div className={cn(
        'flex items-center gap-2 px-4 py-2 rounded-full bg-muted',
        isRefreshing && 'animate-pulse'
      )}>
        <Loader2 
          className={cn(
            'h-4 w-4 text-primary',
            isRefreshing ? 'animate-spin' : ''
          )} 
          style={{
            transform: isRefreshing ? 'none' : `rotate(${progress * 360}deg)`,
          }}
        />
        <span className="text-sm text-muted-foreground">
          {isRefreshing ? 'Refreshing...' : progress >= 1 ? 'Release to refresh' : 'Pull to refresh'}
        </span>
      </div>
    </div>
  );
}

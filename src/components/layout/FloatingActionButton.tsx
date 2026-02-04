import { Link, useLocation } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { selectionHaptic } from '@/lib/haptics';

export function FloatingActionButton() {
  const location = useLocation();
  
  // Hide on create page and settings
  const hiddenRoutes = ['/create', '/settings'];
  if (hiddenRoutes.includes(location.pathname)) {
    return null;
  }

  const handleClick = () => {
    selectionHaptic();
  };

  return (
    <Button
      asChild
      size="lg"
      onClick={handleClick}
      className={cn(
        'fixed bottom-20 right-4 z-40 h-14 w-14 rounded-full shadow-lg lg:hidden',
        'bg-primary hover:bg-primary/90 text-primary-foreground',
        'transition-transform active:scale-95'
      )}
    >
      <Link to="/create">
        <Plus className="h-6 w-6" />
        <span className="sr-only">Create Invoice</span>
      </Link>
    </Button>
  );
}

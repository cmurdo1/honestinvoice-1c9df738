import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Wand2, Users, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { selectionHaptic } from '@/lib/haptics';

const navItems = [
  { href: '/dashboard', label: 'Home', icon: LayoutDashboard },
  { href: '/create', label: 'Create', icon: Wand2 },
  { href: '/clients', label: 'Clients', icon: Users },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function BottomNav() {
  const location = useLocation();

  const handleNavClick = () => {
    selectionHaptic();
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur-lg supports-[backdrop-filter]:bg-background/80 lg:hidden">
      <div className="flex h-16 items-center justify-around px-2 pb-safe">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.href;
          
          return (
            <Link
              key={item.href}
              to={item.href}
              onClick={handleNavClick}
              className={cn(
                'flex min-h-[44px] min-w-[64px] flex-col items-center justify-center gap-1 rounded-lg px-3 py-2 transition-colors touch-target',
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className={cn('h-5 w-5', isActive && 'scale-110')} />
              <span className={cn(
                'text-[10px] font-medium',
                isActive && 'font-semibold'
              )}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

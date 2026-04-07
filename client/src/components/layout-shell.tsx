import { ReactNode } from 'react';
import { useHashLocation } from 'wouter/use-hash-location';
import { cn } from '@/lib/utils';
import { Download, HardDrive, Settings, Heart, ArrowRightLeft } from 'lucide-react';

interface LayoutShellProps {
  children: ReactNode;
}

export function LayoutShell({ children }: LayoutShellProps) {
  const [location, navigate] = useHashLocation();

  const navItems = [
    { href: '/', label: 'Downloader', icon: Download },
    { href: '/queue', label: 'Queue & History', icon: HardDrive },
    { href: '/settings', label: 'Settings', icon: Settings },
    { href: '/support', label: 'Support', icon: Heart },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground font-sans">
      {/* Sidebar — fixed, never moves */}
      <aside className="w-64 min-w-64 h-screen flex-shrink-0 overflow-hidden sticky top-0 border-r border-border bg-card p-4 flex flex-col gap-6 z-50">
        <div className="flex items-center gap-3 px-2 mt-2">
          <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center text-primary-foreground shadow-sm overflow-hidden">
            <img
              src="./icon.png"
              alt="Internet Download Hub"
              className="w-6 h-6 object-contain"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
          <div className="min-w-0">
            <span className="font-bold text-base tracking-tight text-foreground block leading-none truncate">
              Internet Download Hub
            </span>
            <span className="text-xs text-muted-foreground/70">v1.1.2</span>
          </div>
        </div>

        <nav className="flex-1 space-y-1 mt-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === '/'
                ? location === '/' || location === ''
                : location.startsWith(item.href);

            return (
              <button
                key={item.href}
                onClick={() => navigate(item.href)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 font-medium cursor-pointer text-left group relative',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-primary rounded-r-full" />
                )}
                <Icon className={cn('w-5 h-5 transition-transform duration-200 group-hover:scale-110', isActive ? 'text-primary' : '')} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Sidebar footer */}
        <div className="pt-4 border-t border-border/50 space-y-2">
          <button
            onClick={() => window.location.href = 'https://internet-download-hub.onrender.com/'}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm
                       text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-200"
          >
            <ArrowRightLeft className="w-4 h-4" />
            <span className="truncate">Try Web Version</span>
          </button>
          <p className="text-[10px] text-muted-foreground/50 px-3 leading-tight">
            © {new Date().getFullYear()} Isaac Onyango
          </p>
        </div>
      </aside>

      {/* Only this scrolls */}
      <main className="flex-1 h-screen overflow-y-auto overflow-x-hidden">
        <div className="w-full h-full p-4 md:p-8 max-w-5xl mx-auto">{children}</div>
      </main>
    </div>
  );
}

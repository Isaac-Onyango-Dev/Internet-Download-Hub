import { ReactNode, useEffect, useState } from 'react';
import { useHashLocation } from 'wouter/use-hash-location';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Download, HardDrive, Settings, Heart, ArrowRightLeft, Globe } from 'lucide-react';

interface LayoutShellProps {
  children: ReactNode;
}

/*
 * Below 1000 CSS px (so after zoom) the sidebar folds to an icon rail. A
 * 256px sidebar in an 820px window left the page about 500px, and layouts
 * tuned for more than that clipped. It is done in CSS (`max-[999px]:`) rather
 * than state so the fold lands on the same frame as the resize. The classes
 * are written out in full because Tailwind only generates what it finds as
 * literal text.
 */

/** Labels a rail icon. The tooltip only shows while the rail is folded. */
function RailTip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Tooltip delayDuration={150}>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="right" className="min-[1000px]:hidden">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * The brand lockup, matching the wordmark on the download site: an all-caps
 * kicker above a gradient-filled name whose "o" is a play-button notch. The
 * decorative spelling is hidden from assistive tech and the real name is
 * exposed alongside it.
 */
function Wordmark({ version }: { version: string }) {
  return (
    <div
      className={cn('flex items-center gap-2.5 px-2 pt-1', 'max-[999px]:justify-center max-[999px]:px-0')}
    >
      <img
        src="./mark.svg"
        alt=""
        aria-hidden="true"
        className="h-8 w-8 shrink-0 drop-shadow-[0_6px_16px_rgba(139,47,224,0.45)]"
      />
      <div className={cn('min-w-0', 'max-[999px]:hidden')}>
        <span className="wordmark" aria-hidden="true">
          <span className="wordmark-kicker">Internet</span>
          <span className="wordmark-name">
            D<i className="wordmark-o" />
            wnload Hub
          </span>
        </span>
        <span className="sr-only">Internet Download Hub</span>
        {/* Rendered only once the main process has reported the real version.
            A hardcoded placeholder here went stale the moment it was written. */}
        {version && (
          <span className="mt-1 block text-[10px] font-medium tracking-wide text-muted-foreground/70">
            {version}
          </span>
        )}
      </div>
    </div>
  );
}

export function LayoutShell({ children }: LayoutShellProps) {
  const [location, navigate] = useHashLocation();
  // Empty until the main process answers. package.json is the only source of
  // truth for the version, so nothing here should guess at it.
  const [appVersion, setAppVersion] = useState('');

  useEffect(() => {
    if (!window.electronAPI) return;
    window.electronAPI
      .getAppVersion?.()
      .then((versionInfo: { version: string }) => {
        setAppVersion(`v${versionInfo.version}`);
      })
      .catch(() => {});
  }, []);

  const navItems = [
    { href: '/', label: 'Downloader', icon: Download },
    { href: '/queue', label: 'Queue & History', icon: HardDrive },
    { href: '/supported-sites', label: 'Supported Sites', icon: Globe },
    { href: '/settings', label: 'Settings', icon: Settings },
    { href: '/support', label: 'Support', icon: Heart },
  ];

  return (
    <div className="flex h-dvh overflow-hidden bg-background font-sans text-foreground">
      {/* Sidebar — fixed, never moves */}
      <aside
        className={cn(
          'sticky top-0 z-50 flex h-dvh w-56 shrink-0 flex-col gap-4 overflow-hidden',
          'border-r border-border bg-sidebar p-3',
          'max-[999px]:w-16 max-[999px]:px-2',
        )}
      >
        <Wordmark version={appVersion} />

        <nav className="mt-1 flex-1 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            // Use exact matching for routes with common prefixes
            const isActive =
              item.href === '/' ? location === '/' || location === '' : location === item.href;

            return (
              <RailTip key={item.href} label={item.label}>
                <button
                  onClick={() => navigate(item.href)}
                  aria-label={item.label}
                  aria-current={isActive ? 'page' : undefined}
                  className={cn(
                    'group relative flex w-full cursor-pointer items-center gap-3 rounded-md px-3 py-2',
                    'max-[999px]:justify-center max-[999px]:px-0',
                    'text-left text-sm font-medium',
                    'transition-[color,background-color,transform] duration-200 ease-bounce',
                    isActive
                      ? 'bg-accent/15 text-foreground'
                      : 'text-muted-foreground hover:translate-x-0.5 hover:bg-muted hover:text-foreground',
                  )}
                >
                  {/* Active rail carries the prism, the way the site marks its
                    current release and section headings. */}
                  {isActive && (
                    <span className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-full bg-prism" />
                  )}
                  <Icon
                    className={cn(
                      'h-[18px] w-[18px] transition-transform duration-200 ease-bounce group-hover:scale-110',
                      isActive && 'text-accent',
                    )}
                  />
                  <span className="max-[999px]:hidden">{item.label}</span>
                </button>
              </RailTip>
            );
          })}
        </nav>

        {/* Sidebar footer */}
        <div className="space-y-2 border-t border-border/60 pt-3">
          <RailTip label="Try Web Version">
            <button
              onClick={() => (window.location.href = 'https://internet-download-hub.onrender.com/')}
              aria-label="Try Web Version"
              className={cn(
                'flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm',
                'text-muted-foreground transition-[color,background-color,transform] duration-200',
                'ease-bounce hover:translate-x-0.5 hover:bg-muted hover:text-foreground',
                'max-[999px]:justify-center max-[999px]:px-0',
              )}
            >
              <ArrowRightLeft className="h-4 w-4 shrink-0" />
              <span className={cn('truncate', 'max-[999px]:hidden')}>Try Web Version</span>
            </button>
          </RailTip>
          <p
            className={cn(
              'px-3 text-[10px] leading-tight text-muted-foreground/50',
              'max-[999px]:hidden',
            )}
          >
            © {new Date().getFullYear()} Isaac Onyango
          </p>
        </div>
      </aside>

      {/* Only this scrolls. `@container` lets pages lay out by the space
          beside the sidebar rather than by the window. */}
      <main className="brand-ambient h-dvh min-w-0 flex-1 overflow-y-auto overflow-x-hidden">
        <div className="@container mx-auto h-full w-full max-w-6xl px-6 py-5">{children}</div>
      </main>
    </div>
  );
}

import { ReactNode, useEffect, useState } from 'react';
import { useHashLocation } from 'wouter/use-hash-location';
import { cn } from '@/lib/utils';
import { Download, HardDrive, Settings, Heart, ArrowRightLeft, Globe } from 'lucide-react';

interface LayoutShellProps {
  children: ReactNode;
}

/**
 * The brand lockup, matching the wordmark on the download site: an all-caps
 * kicker above a gradient-filled name whose "o" is a play-button notch. The
 * decorative spelling is hidden from assistive tech and the real name is
 * exposed alongside it.
 */
function Wordmark({ version }: { version: string }) {
  return (
    <div className="flex items-center gap-2.5 px-2 pt-1">
      <img
        src="./mark.svg"
        alt=""
        aria-hidden="true"
        className="h-9 w-9 shrink-0 drop-shadow-[0_6px_16px_rgba(139,47,224,0.45)]"
      />
      <div className="min-w-0">
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
    window.electronAPI.getAppVersion?.()
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
    <div className="flex h-screen overflow-hidden bg-background text-foreground font-sans">
      {/* Sidebar — fixed, never moves */}
      <aside
        className="z-50 flex h-screen w-64 min-w-64 shrink-0 flex-col gap-6 overflow-hidden
                   sticky top-0 border-r border-border bg-sidebar p-4"
      >
        <Wordmark version={appVersion} />

        <nav className="mt-2 flex-1 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            // Use exact matching for routes with common prefixes
            const isActive =
              item.href === '/'
                ? location === '/' || location === ''
                : location === item.href;

            return (
              <button
                key={item.href}
                onClick={() => navigate(item.href)}
                className={cn(
                  'group relative flex w-full cursor-pointer items-center gap-3 rounded-md px-3 py-2.5',
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
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Sidebar footer */}
        <div className="space-y-2 border-t border-border/60 pt-4">
          <button
            onClick={() => window.location.href = 'https://internet-download-hub.onrender.com/'}
            className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm
                       text-muted-foreground transition-[color,background-color,transform] duration-200
                       ease-bounce hover:translate-x-0.5 hover:bg-muted hover:text-foreground"
          >
            <ArrowRightLeft className="h-4 w-4" />
            <span className="truncate">Try Web Version</span>
          </button>
          <p className="px-3 text-[10px] leading-tight text-muted-foreground/50">
            © {new Date().getFullYear()} Isaac Onyango
          </p>
        </div>
      </aside>

      {/* Only this scrolls */}
      <main className="brand-ambient h-screen flex-1 overflow-y-auto overflow-x-hidden">
        <div className="mx-auto h-full w-full max-w-5xl p-4 md:p-8">{children}</div>
      </main>
    </div>
  );
}

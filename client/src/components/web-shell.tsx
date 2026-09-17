import { ReactNode } from 'react';
import { Link } from 'wouter';
import { Badge } from '@/components/ui/badge';

/**
 * Every "get the desktop app" link points here rather than at GitHub Releases.
 * The releases page redirects to a tag page where the installer is one row of
 * several behind a collapsed "Assets" disclosure, which is a dead end for
 * anyone who does not already know what a release asset is. This page offers
 * the installer as its primary button.
 */
export const DOWNLOAD_PAGE_URL = 'https://isaac-onyango-dev.github.io/Internet-Download-Hub/';

/** The web version's frame: the desktop sidebar links to pages the web version doesn't have. */
export function WebShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      {/* ── Top Bar ─────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-lg">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
          {/* Same brand lockup as the desktop shell and the download site; it leads home. */}
          <Link href="/" className="flex min-w-0 items-center gap-2.5">
            <img src="./mark.svg" alt="" aria-hidden="true" className="h-7 w-7 shrink-0" />
            <span className="wordmark" aria-hidden="true">
              {/* The kicker is the first thing to go when space is tight. */}
              <span className="wordmark-kicker hidden sm:block">Internet</span>
              <span className="wordmark-name">
                D<i className="wordmark-o" />
                wnload Hub
              </span>
            </span>
            <span className="sr-only">Internet Download Hub</span>
            <Badge variant="secondary" className="hidden text-xs sm:inline-flex">Web</Badge>
          </Link>
          <div className="flex shrink-0 items-center gap-3">
            <Link
              href="/supported-sites"
              className="hidden whitespace-nowrap text-sm text-muted-foreground transition-colors hover:text-foreground sm:inline"
            >
              Supported Sites
            </Link>
            <a
              href={DOWNLOAD_PAGE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="whitespace-nowrap text-sm font-medium text-primary hover:underline"
            >
              Get Desktop App
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-6 py-12">{children}</main>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className="border-t border-border py-6">
        <div className="mx-auto max-w-5xl px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} Isaac Onyango · MIT License</span>
          <div className="flex gap-4">
            <a href="https://github.com/Isaac-Onyango-Dev/Internet-Download-Hub" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">
              GitHub
            </a>
            <a href="https://github.com/Isaac-Onyango-Dev/Internet-Download-Hub/issues" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">
              Report a Bug
            </a>
            <Link href="/supported-sites" className="hover:text-foreground transition-colors">
              Supported Sites
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

/**
 * Supported Sites Page
 * Displays all supported download sites organized by category with engine information
 */

import { Card, CardContent } from '@/components/ui/card';
import { SUPPORTED_SITES, WEB_SUPPORTED_SITES } from '@/lib/supported-sites';
import { cn } from '@/lib/utils';
import { isElectron } from '@/lib/utils/env';
import { Search, Globe } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useState, useMemo } from 'react';
import { LayoutShell } from '@/components/layout-shell';
import { WebShell, DOWNLOAD_PAGE_URL } from '@/components/web-shell';

export default function SupportedSites() {
  const [searchQuery, setSearchQuery] = useState('');
  const isDesktop = isElectron();
  const Shell = isDesktop ? LayoutShell : WebShell;
  // The web server cannot reach every site the desktop app can, so it lists only the ones it can.
  const categories = isDesktop ? SUPPORTED_SITES : WEB_SUPPORTED_SITES;
  const totalSites = categories.reduce((sum, cat) => sum + cat.sites.length, 0);

  const filteredCategories = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return categories;

    return categories
      .map((category) => ({
        ...category,
        sites: category.sites.filter(
          (site) => site.name.toLowerCase().includes(query) || site.url.toLowerCase().includes(query),
        ),
      }))
      .filter((category) => category.sites.length > 0);
  }, [searchQuery, categories]);

  return (
    <Shell>
      <div className="space-y-6 animate-in fade-in duration-300">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Supported Sites</h1>
          {isDesktop ? (
            <p className="text-muted-foreground">
              Download videos, images, and audio from {totalSites}+ websites using multiple download engines.
            </p>
          ) : (
            <p className="text-muted-foreground">
              These {totalSites} sites work in the web version. YouTube and other sites that block shared
              servers need the{' '}
              <a
                href={DOWNLOAD_PAGE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-primary hover:underline"
              >
                desktop app
              </a>
              , which downloads over your own connection.
            </p>
          )}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search sites by name or URL..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
          {searchQuery && (
            <p className="text-sm text-muted-foreground mt-2">
              Showing {filteredCategories.reduce((sum, cat) => sum + cat.sites.length, 0)} of{' '}
              {totalSites} sites
            </p>
          )}
        </div>

        {/* Engine Legend: the web server runs yt-dlp alone */}
        {isDesktop && (
          <Card className="border-border/50 bg-card/50">
            <CardContent className="pt-6">
              <h3 className="text-sm font-medium mb-3">Download Engines</h3>
              <div className="flex flex-wrap gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-info" />
                  <span className="text-sm">
                    <strong>yt-dlp</strong> - 1000+ video sites
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-success" />
                  <span className="text-sm">
                    <strong>streamlink</strong> - Live streams
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-accent" />
                  <span className="text-sm">
                    <strong>gallery-dl</strong> - Image galleries
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-primary" />
                  <span className="text-sm">
                    <strong>N_m3u8DL-RE</strong> - HLS/M3U8 streams
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Categories with Accordions */}
        {filteredCategories.length === 0 ? (
          <div className="text-center py-12 space-y-3">
            <Globe className="w-12 h-12 mx-auto text-muted-foreground/50" />
            <h3 className="text-lg font-medium">No sites found</h3>
            <p className="text-sm text-muted-foreground">
              Try a different search term or clear the search
            </p>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="text-sm text-primary hover:underline"
              >
                Clear search
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredCategories.map((category) => (
              <details
                key={category.category}
                className="group border border-border rounded-lg overflow-hidden bg-card"
                open
              >
                <summary className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 bg-muted/30 transition-colors list-none">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{category.icon}</span>
                    <h4 className="font-medium">{category.category}</h4>
                    <span className="text-xs text-muted-foreground bg-background px-2 py-0.5 rounded-full">
                      {category.sites.length}
                    </span>
                  </div>
                  <svg
                    className="w-5 h-5 text-muted-foreground transition-transform group-open:rotate-180"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </summary>
                <div className="divide-y divide-border/50">
                  {category.sites.map((site) => (
                    <div
                      key={site.name}
                      className="p-4 hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <h5 className="font-medium text-sm">{site.name}</h5>
                          <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                            {site.url}
                          </p>
                          {site.notes && (
                            <p className="text-xs text-muted-foreground mt-1 italic">
                              {site.notes}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-1.5 shrink-0 flex-wrap">
                          {site.engines.map((engine) => {
                            const engineColors: Record<string, string> = {
                              'yt-dlp': 'bg-info/15 text-info border-info/30',
                              'streamlink': 'bg-success/15 text-success border-success/30',
                              'gallery-dl': 'bg-accent/15 text-accent border-accent/30',
                              'N_m3u8DL-RE': 'bg-primary/15 text-primary border-primary/30',
                            };
                            return (
                              <span
                                key={engine}
                                className={cn(
                                  'text-xs px-2 py-0.5 rounded-full border',
                                  engineColors[engine],
                                )}
                              >
                                {engine}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            ))}
          </div>
        )}
      </div>
    </Shell>
  );
}

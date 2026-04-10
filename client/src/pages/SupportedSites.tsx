/**
 * Supported Sites Page
 * Displays all supported download sites organized by category with engine information
 */

import { Card, CardContent } from '@/components/ui/card';
import { SUPPORTED_SITES, TOTAL_SUPPORTED_SITES, searchSites } from '@/lib/supported-sites';
import { cn } from '@/lib/utils';
import { Search, Globe } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useState, useMemo } from 'react';
import { LayoutShell } from '@/components/layout-shell';

export default function SupportedSites() {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return SUPPORTED_SITES;

    const query = searchQuery.toLowerCase();
    return SUPPORTED_SITES.map((category) => ({
      ...category,
      sites: searchSites(query).filter((site) =>
        category.sites.some((s) => s.name === site.name)
      ),
    })).filter((category) => category.sites.length > 0);
  }, [searchQuery]);

  return (
    <LayoutShell>
      <div className="space-y-6 animate-in fade-in duration-300">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Supported Sites</h1>
          <p className="text-muted-foreground">
            Download videos, images, and audio from {TOTAL_SUPPORTED_SITES}+ websites using multiple download engines.
          </p>
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
              {TOTAL_SUPPORTED_SITES} sites
            </p>
          )}
        </div>

        {/* Engine Legend */}
        <Card className="border-border/50 bg-card/50">
          <CardContent className="pt-6">
            <h3 className="text-sm font-medium mb-3">Download Engines</h3>
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500" />
                <span className="text-sm">
                  <strong>yt-dlp</strong> - 1000+ video sites
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span className="text-sm">
                  <strong>streamlink</strong> - Live streams
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-purple-500" />
                <span className="text-sm">
                  <strong>gallery-dl</strong> - Image galleries
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-orange-500" />
                <span className="text-sm">
                  <strong>N_m3u8DL-RE</strong> - HLS/M3U8 streams
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

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
                              'yt-dlp': 'bg-blue-500/15 text-blue-500 border-blue-500/30',
                              'streamlink': 'bg-green-500/15 text-green-500 border-green-500/30',
                              'gallery-dl': 'bg-purple-500/15 text-purple-500 border-purple-500/30',
                              'N_m3u8DL-RE': 'bg-orange-500/15 text-orange-500 border-orange-500/30',
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
    </LayoutShell>
  );
}

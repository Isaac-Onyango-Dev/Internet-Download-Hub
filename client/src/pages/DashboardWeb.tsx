import { useState, useCallback, useEffect } from 'react';
import * as React from 'react';
import { Link } from 'wouter';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  AlertCircle,
  Download,
  ExternalLink,
  Clock,
  Loader2,
  Trash2,
  Globe,
  Video,
  Shield,
  Zap,
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────

interface VideoFormat {
  formatId: string;
  label: string;
  quality: string;
  ext: string;
  filesize?: number | null;
}

interface VideoInfo {
  url: string;
  title: string;
  thumbnail?: string;
  duration?: number;
  uploader?: string;
  formats: VideoFormat[];
}

interface DownloadRecord {
  id: string;
  title: string;
  url: string;
  quality: string;
  timestamp: number;
}

const WEB_DOWNLOADS_KEY = 'idh_web_downloads_v2';

// ── Helpers ──────────────────────────────────────────────────────────────────

function isValidUrl(str: string): boolean {
  try {
    const url = new URL(str.trim());
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatBytes(bytes: number): string {
  if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(1)} GB`;
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(0)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}

function loadRecentDownloads(): DownloadRecord[] {
  try {
    return JSON.parse(localStorage.getItem(WEB_DOWNLOADS_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveRecentDownloads(records: DownloadRecord[]) {
  localStorage.setItem(WEB_DOWNLOADS_KEY, JSON.stringify(records.slice(0, 10)));
}

// ── Component ────────────────────────────────────────────────────────────────

export default function DashboardWeb() {
  const [urlInput, setUrlInput] = useState('');
  const [selectedFormat, setSelectedFormat] = useState('');
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [recentDownloads, setRecentDownloads] = useState<DownloadRecord[]>(loadRecentDownloads);

  // Focus URL input on mount
  const urlInputRef = React.useRef<HTMLInputElement>(null);
  useEffect(() => {
    urlInputRef.current?.focus();
  }, []);

  // ── Fetch video info ────────────────────────────────────────────────────
  const handleFetchInfo = useCallback(async () => {
    const trimmed = urlInput.trim();
    if (!trimmed) {
      setError('Please paste a video URL.');
      return;
    }
    if (!isValidUrl(trimmed)) {
      setError("That doesn't look like a valid URL. Paste a link starting with http:// or https://");
      return;
    }

    setIsLoading(true);
    setError(null);
    setVideoInfo(null);
    setSelectedFormat('');

    try {
      const response = await api.fetchVideoInfo(trimmed);
      if (!response?.success) {
        throw new Error(response?.error || 'Could not fetch video information.');
      }
      const data = response.data as VideoInfo;
      if (!data?.formats || data.formats.length === 0) {
        throw new Error('No downloadable formats found for this video.');
      }
      setVideoInfo(data);
      setSelectedFormat(data.formats[0].formatId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setVideoInfo(null);
    } finally {
      setIsLoading(false);
    }
  }, [urlInput]);

  // ── Download ─────────────────────────────────────────────────────────────
  const handleDownload = useCallback(async () => {
    if (!videoInfo || !selectedFormat) return;

    setIsDownloading(true);
    setError(null);

    try {
      const fmt = videoInfo.formats.find(f => f.formatId === selectedFormat);
      const ext = fmt?.ext || 'mp4';
      const cleanTitle = videoInfo.title.replace(/[^a-z0-9]/gi, '_').slice(0, 60);
      const filename = `${cleanTitle}.${ext}`;

      await api.startDownload({
        url: videoInfo.url,
        filename,
        formatId: selectedFormat,
      });

      // Record in recent downloads
      const record: DownloadRecord = {
        id: Date.now().toString(),
        title: videoInfo.title,
        url: videoInfo.url,
        quality: fmt?.label || selectedFormat,
        timestamp: Date.now(),
      };
      const updated = [record, ...recentDownloads];
      setRecentDownloads(updated);
      saveRecentDownloads(updated);

      // Reset
      setUrlInput('');
      setVideoInfo(null);
      setSelectedFormat('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Download failed: ${msg}`);
    } finally {
      setIsDownloading(false);
    }
  }, [videoInfo, selectedFormat, recentDownloads]);

  // ── Clear history ───────────────────────────────────────────────────────
  const handleClearHistory = useCallback(() => {
    setRecentDownloads([]);
    localStorage.removeItem(WEB_DOWNLOADS_KEY);
  }, []);

  // ── Enter key ───────────────────────────────────────────────────────────
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isLoading && !videoInfo) handleFetchInfo();
  };

  const fmt = videoInfo?.formats.find(f => f.formatId === selectedFormat);

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background">
      {/* ── Top Bar ─────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-lg">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <Globe className="h-5 w-5 text-primary" />
            <span className="font-bold text-foreground">Internet Download Hub</span>
            <Badge variant="secondary" className="text-xs">Web</Badge>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/supported-sites">
              <a className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                Supported Sites
              </a>
            </Link>
            <a
              href="https://github.com/Isaac-Onyango-Dev/Internet-Download-Hub/releases/latest"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-primary hover:underline"
            >
              Get Desktop App
            </a>
          </div>
        </div>
      </header>

      {/* ── Main Content ────────────────────────────────────────────────── */}
      <main className="mx-auto max-w-2xl px-6 py-12 space-y-8">

        {/* ── Hero ────────────────────────────────────────────────────── */}
        <div className="text-center space-y-4">
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
            Download any video, <span className="text-primary">instantly</span>
          </h1>
          <p className="text-muted-foreground text-lg max-w-md mx-auto">
            Paste a link. Pick your quality. The file downloads to your browser.
          </p>
        </div>

        {/* ── URL Input ───────────────────────────────────────────────── */}
        <div className="space-y-3">
          <div className="flex gap-2">
            <Input
              ref={urlInputRef}
              placeholder="Paste YouTube, TikTok, Twitter, Instagram, or any video link…"
              value={urlInput}
              onChange={e => setUrlInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading || isDownloading}
              className="h-12 text-base flex-1"
            />
            <Button
              onClick={handleFetchInfo}
              disabled={isLoading || !urlInput.trim()}
              className="h-12 px-6 min-w-28"
              size="lg"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Fetching…
                </>
              ) : (
                'Get Info'
              )}
            </Button>
          </div>
        </div>

        {/* ── Error ───────────────────────────────────────────────────── */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* ── Video Info Card ─────────────────────────────────────────── */}
        {videoInfo && (
          <div className="space-y-5 rounded-xl border border-border bg-card p-6 shadow-sm">
            {/* Thumbnail */}
            {videoInfo.thumbnail && (
              <div className="overflow-hidden rounded-lg bg-muted">
                <img
                  src={videoInfo.thumbnail}
                  alt=""
                  className="w-full aspect-video object-cover"
                  loading="lazy"
                />
              </div>
            )}

            {/* Title + meta */}
            <div>
              <h2 className="text-lg font-semibold leading-snug line-clamp-2">{videoInfo.title}</h2>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                {videoInfo.duration ? (
                  <span className="flex items-center gap-1">
                    <Video className="h-3.5 w-3.5" />
                    {formatDuration(videoInfo.duration)}
                  </span>
                ) : null}
                {videoInfo.uploader ? <span>{videoInfo.uploader}</span> : null}
              </div>
            </div>

            {/* Quality selector */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Quality</label>
              <Select value={selectedFormat} onValueChange={setSelectedFormat}>
                <SelectTrigger className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {videoInfo.formats.map(f => (
                    <SelectItem key={f.formatId} value={f.formatId}>
                      {f.label}{f.filesize ? ` — ${formatBytes(f.filesize)}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Download button */}
            <Button
              onClick={handleDownload}
              disabled={isDownloading || !selectedFormat}
              size="lg"
              className="w-full h-12 text-base"
            >
              {isDownloading ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Starting download…
                </>
              ) : (
                <>
                  <Download className="h-5 w-5 mr-2" />
                  Download {fmt ? fmt.label : 'File'}
                </>
              )}
            </Button>

            <p className="text-center text-xs text-muted-foreground">
              File saves to your browser&apos;s Downloads folder
            </p>
          </div>
        )}

        {/* ── Recent Downloads ────────────────────────────────────────── */}
        {recentDownloads.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold text-foreground">Recent Downloads</h3>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearHistory}
                className="h-8 text-xs text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                Clear
              </Button>
            </div>
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {recentDownloads.map(r => (
                <div
                  key={r.id}
                  className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-2.5 text-sm"
                >
                  <Download className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{r.title}</p>
                    <p className="text-xs text-muted-foreground">{r.quality}</p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    {new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Trust bar ───────────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-4 py-4">
          {[
            { icon: <Zap className="h-5 w-5" />, label: '1000+ sites' },
            { icon: <Shield className="h-5 w-5" />, label: 'No ads, no tracking' },
            { icon: <Globe className="h-5 w-5" />, label: 'Works in any browser' },
          ].map(item => (
            <div key={item.label} className="flex flex-col items-center gap-1.5 text-center">
              <span className="text-primary">{item.icon}</span>
              <span className="text-xs font-medium text-muted-foreground">{item.label}</span>
            </div>
          ))}
        </div>

        {/* ── Desktop CTA ─────────────────────────────────────────────── */}
        <div className="rounded-xl border border-border bg-card/50 p-6 text-center space-y-3">
          <h3 className="font-semibold text-foreground">Need more power?</h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            The desktop app adds playlist downloads, parallel queues, MP3 extraction, and 1,000+ sites.
          </p>
          <Button variant="outline" size="sm" asChild>
            <a
              href="https://github.com/Isaac-Onyango-Dev/Internet-Download-Hub/releases/latest"
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Download for Windows
            </a>
          </Button>
        </div>
      </main>

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
            <Link href="/supported-sites">
              <a className="hover:text-foreground transition-colors">Supported Sites</a>
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

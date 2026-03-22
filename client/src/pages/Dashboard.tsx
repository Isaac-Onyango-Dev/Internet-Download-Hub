import { useState, useEffect, useCallback, useRef } from "react";
import { LayoutShell } from "@/components/layout-shell";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useDownloads, usePauseDownload, useResumeDownload } from "@/hooks/use-downloads";
import { useVideoDetect, type DetectedVideo, type PlaylistData } from "@/hooks/use-video-detect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Download, Image as ImageIcon, Settings, Loader2, Music, User, Trash2,
  List, AlertCircle, PlayCircle, FolderOpen, Zap, RotateCcw, FileVideo,
  ExternalLink, RefreshCw, CheckCircle2, XCircle, Pause, Play, Clock, X, ShieldCheck
} from "lucide-react";
import { useDownloadProgress } from "@/hooks/use-ws-progress";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import React from "react";

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <Alert variant="destructive" className="m-8">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Component Crashed</AlertTitle>
          <AlertDescription className="mt-2 font-mono text-xs">{this.state.error?.message}</AlertDescription>
        </Alert>
      );
    }
    return this.props.children;
  }
}

// Validate whether a string looks like a real URL
function isValidUrl(str: string): boolean {
  try {
    const url = new URL(str.trim());
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export default function Dashboard() {
  const [location, setLocation] = useLocation();
  const [globalError, setGlobalError] = useState<{ message: string } | null>(null);
  const [renderedTabs, setRenderedTabs] = useState<Set<string>>(new Set(['downloader']));
  const urlInputRef = useRef<HTMLInputElement>(null);

  // Binary updates state
  const [binaryUpdates, setBinaryUpdates] = useState<Array<{
    name: string;
    installedVersion: string;
    latestVersion: string;
    needsUpdate: boolean;
    downloadUrl: string;
    updating?: boolean;
  }>>([]);

  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const currentTab = location === '/' ? 'downloader' : location.split('/')[1];

  // Load binary updates on mount
  useEffect(() => {
    loadBinaryUpdates();
  }, []);

  const handleTabChange = (value: string) => {
    setLocation(value === 'downloader' ? '/' : `/${value}`);
  };

  // Persist Downloader state across tab navigation
  const [scanUrl, setScanUrl] = useState<string>(() => localStorage.getItem('idh_last_url') || '');
  const [videoInfo, setVideoInfo] = useState<DetectedVideo[] | null>(() => {
    try {
      const saved = localStorage.getItem('idh_last_video_info');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    localStorage.setItem('idh_last_url', scanUrl);
  }, [scanUrl]);

  useEffect(() => {
    if (videoInfo) {
      localStorage.setItem('idh_last_video_info', JSON.stringify(videoInfo));
    } else {
      localStorage.removeItem('idh_last_video_info');
    }
  }, [videoInfo]);

  // yt-dlp update banner state — driven by IPC events from main process
  const [ytdlpUpdateAvailable, setYtdlpUpdateAvailable] = useState(false);
  const [ytdlpLatestVersion, setYtdlpLatestVersion] = useState('');
  const [ytdlpBannerDismissed, setYtdlpBannerDismissed] = useState(false);

  // Playlist detection dialog state
  const [showPlaylistDialog, setShowPlaylistDialog] = useState(false);
  const [playlistDetectedData, setPlaylistDetectedData] = useState<{
    title: string;
    count: number;
    entries: Array<{
      url: string;
      title: string;
      thumbnail?: string;
      index: number;
    }>;
  } | null>(null);

  useEffect(() => {
    if (!window.electronAPI) return;
    window.electronAPI.onYtDlpUpdateAvailable?.((data) => {
      setYtdlpUpdateAvailable(true);
      setYtdlpLatestVersion(data.latestVersion);
    });
    window.electronAPI.onYtDlpVersionInfo?.((data) => {
      if (!data.updateAvailable) setYtdlpUpdateAvailable(false);
    });
    window.electronAPI.onPlaylistDetected?.((data) => {
      setPlaylistDetectedData(data);
      setShowPlaylistDialog(true);
    });
  }, []);

  const showUpdateBanner = ytdlpUpdateAvailable && !ytdlpBannerDismissed;

  return (
    <LayoutShell>
      <div className="space-y-8 animate-in fade-in duration-300">

        {globalError && (
          <Alert variant="destructive" className="bg-destructive/10 border-destructive/20 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <AlertTitle className="font-semibold text-lg">Error</AlertTitle>
            <AlertDescription className="text-base mt-2 flex flex-col gap-3">
              <p>{globalError.message}</p>
              <Button variant="outline" size="sm" className="w-fit border-destructive/30 hover:bg-destructive hover:text-white" onClick={() => setGlobalError(null)}>
                Dismiss
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <Tabs value={currentTab} onValueChange={handleTabChange} className="w-full">
          <TabsContent value="downloader" className="focus-visible:outline-none">
            <VideoCapturePanel 
              onScanStart={() => setGlobalError(null)} 
              onError={(err) => setGlobalError(err)}
              scanUrl={scanUrl}
              setScanUrl={setScanUrl}
              videoInfo={videoInfo}
              setVideoInfo={setVideoInfo}
              showUpdateBanner={showUpdateBanner}
              ytdlpLatestVersion={ytdlpLatestVersion}
              onDismissBanner={() => setYtdlpBannerDismissed(true)}
              onGoToSettings={() => handleTabChange('settings')}
              onGoToQueue={() => handleTabChange('queue')}
              setSuccessMsg={setSuccessMsg}
            />
          </TabsContent>

          <TabsContent value="queue" className="focus-visible:outline-none">
            {renderedTabs.has('queue') && <HistoryPanel />}
          </TabsContent>

          <TabsContent value="settings" className="focus-visible:outline-none">
            {renderedTabs.has('settings') && (
              <ErrorBoundary>
                <SettingsPanel />
              </ErrorBoundary>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </LayoutShell>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Video Capture Panel
// ─────────────────────────────────────────────────────────────────────────────

function VideoCapturePanel({ 
  onScanStart, 
  onError, 
  scanUrl, 
  setScanUrl, 
  videoInfo, 
  setVideoInfo,
  showUpdateBanner,
  ytdlpLatestVersion,
  onDismissBanner,
  onGoToSettings,
  onGoToQueue,
  setSuccessMsg
}: VideoInfoProps & VideoInfoState) {
  const videoDetectMutation = useVideoDetect();
  const [urlError, setUrlError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [errorObj, setErrorObj] = useState<{ message: string } | null>(null);

  const loadingMessages = [
    'Fetching video details...',
    'Analyzing available qualities...',
    'Almost ready...'
  ];

  useEffect(() => {
    if (!loading) return;
    let i = 0;
    const interval = setInterval(() => {
      i = (i + 1) % loadingMessages.length;
      setLoadingMessage(loadingMessages[i]);
    }, 3000);
    return () => clearInterval(interval);
  }, [loading]);

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    setUrlError(null);
    setSuccessMsg(null);
    setErrorObj(null);
    setPlaylistBlocked(null);
    setPlaylistTitle(null);
    setPlaylistVideoCount(null);
    setPlaylistMode('all');
    setSelectedPlaylistIndexes(new Set());
    setStartingPlaylist(false);
    setVideoInfo(null);

    const trimmed = scanUrl.trim();
    if (!trimmed) {
      setUrlError("Please paste a video URL first.");
      return;
    }
    if (!isValidUrl(trimmed)) {
      setUrlError("That doesn't look like a valid URL. Please paste a full link starting with http:// or https://");
      return;
    }

    if (onScanStart) onScanStart();
    
    setLoading(true);
    setLoadingMessage('Connecting...');

    try {
      setLoadingMessage('Fetching video details...');
      const result = await videoDetectMutation.mutateAsync(trimmed);

      if (!result) {
        setErrorObj({ message: 'Failed to fetch video info' });
        return;
      }

      const payload = result.data;

      // Handle playlist data structure
      let infos: DetectedVideo[];
      if ('isPlaylist' in payload && payload.isPlaylist) {
        infos = payload.videos;
      } else {
        infos = [payload as DetectedVideo];
      }

      const isEnabledPlaylist =
        Boolean(result.meta?.playlistDetected) &&
        Boolean(result.meta?.detectPlaylistsEnabled) &&
        'isPlaylist' in payload &&
        (payload as any).isPlaylist === true;

      // Playlist handling (blocked vs enabled)
      if (result.meta?.collapsedToSingle && !result.meta?.detectPlaylistsEnabled) {
        setPlaylistBlocked({
          title: result.meta.playlistTitle || 'Playlist',
          count: result.meta.playlistVideoCount ?? infos.length,
        });
        setPlaylistTitle(null);
        setPlaylistVideoCount(null);
      } else if (result.meta?.playlistDetected && result.meta?.detectPlaylistsEnabled && 'isPlaylist' in payload && payload.isPlaylist) {
        setPlaylistBlocked(null);
        setPlaylistTitle(result.meta.playlistTitle || 'Playlist');
        setPlaylistVideoCount(result.meta.playlistVideoCount ?? payload.videos.length);
      } else {
        setPlaylistBlocked(null);
        setPlaylistTitle(null);
        setPlaylistVideoCount(null);
      }

      const newFormats: Record<number, string> = {};
      
      try {
        if (window.electronAPI) {
          const settings = await window.electronAPI.getSettings();
          if (settings) {
            if (isEnabledPlaylist) {
              setPlaylistMode(settings.playlist_download_mode || settings.playlistDownloadMode || 'all');
            }
            const prefQuality = settings.default_quality || 'best';
            const prefFormat = settings.default_format || 'mp4';
            
            infos.forEach((v: any, idx: number) => {
              if (prefFormat === 'mp3') {
                newFormats[idx] = 'bestaudio';
              } else if (prefQuality === 'best') {
                newFormats[idx] = 'bestvideo+bestaudio';
              } else {
                const targetQuality = prefQuality + 'p';
                const match = v.formats?.find((f: any) => f.quality === targetQuality);
                newFormats[idx] = match ? match.formatId : 'bestvideo+bestaudio';
              }
            });
          }
        }
      } catch (e: any) {
        console.error('Failed to load format settings', e);
      }

      setSelectedFormats(newFormats);
      setVideoInfo(infos);
    } catch (err: any) {
      onError({
        message:
          err?.message ||
          'Could not load video information. Please check your internet connection and try again.',
      });
    } finally {
      setLoading(false);
      setLoadingMessage('');
    }
  };

  const handleClear = () => {
    setScanUrl("");
    setVideoInfo(null);
    setUrlError(null);
    setSuccessMsg(null);
    setErrorObj(null);
    setPlaylistBlocked(null);
    setPlaylistTitle(null);
    setPlaylistVideoCount(null);
    localStorage.removeItem('idh_last_url');
    localStorage.removeItem('idh_last_video_info');
  };

  const [selectedFormats, setSelectedFormats] = useState<Record<number, string>>({});
  const [playlistMode, setPlaylistMode] = useState<'all' | 'select'>('all');
  const [selectedPlaylistIndexes, setSelectedPlaylistIndexes] = useState<Set<number>>(new Set());
  const [playlistTitle, setPlaylistTitle] = useState<string | null>(null);
  const [playlistVideoCount, setPlaylistVideoCount] = useState<number | null>(null);
  const [playlistBlocked, setPlaylistBlocked] = useState<{ title: string; count: number } | null>(null);
  const [startingPlaylist, setStartingPlaylist] = useState(false);

  // When new scan results arrive, reset playlist selection.
  useEffect(() => {
    setSelectedPlaylistIndexes(new Set());
  }, [videoInfo]);

  const handleDownload = async (
    video: any,
    idx: number,
    opts?: { goToQueue?: boolean; showSuccessMsg?: boolean; savePathOverride?: string }
  ): Promise<boolean> => {
    const goToQueue = opts?.goToQueue ?? true
    const showSuccessMsg = opts?.showSuccessMsg ?? true

    const selectedFormatId = selectedFormats[idx] || "bestvideo+bestaudio";
    const format = video.formats?.find((f: any) => f.formatId === selectedFormatId) || video.formats?.[0];
    const isAudioOnly = format?.formatId === 'bestaudio';
    const cleanTitle = video.title ? video.title.replace(/[^a-z0-9]/gi, "_").slice(0, 50) : "video";
    const ext = isAudioOnly ? "mp3" : (format?.ext || "mp4");
    const filename = `${cleanTitle}.${ext}`;

    const downloadUrl = video?.extractedUrl || video?.url;

    if (showSuccessMsg) setSuccessMsg(null);

    try {
      if (!window.electronAPI) throw new Error("Electron API not available");


      if (!downloadUrl || typeof downloadUrl !== 'string' || !downloadUrl.trim()) {
        onError({ message: 'Could not determine the download URL for this entry. Please try again.' });
        return false;
      }
      if (!filename || typeof filename !== 'string' || !filename.trim()) {
        onError({ message: 'Could not determine a filename for this download. Please try again.' });
        return false;
      }

      // Load settings for save path
      const settings = await window.electronAPI.getSettings();
      const savePath = opts?.savePathOverride || settings?.download_path || settings?.downloadPath;
      const requiredBytes = format?.filesize || 0;

      // Disk space check
      const spaceCheck = await window.electronAPI.checkDiskSpace(savePath, requiredBytes);
      if (!spaceCheck.isEnough) {
        onError({ message: `Not enough storage space to download this file. Please free up some disk space and try again.` });
        return false;
      }

      const resolvedFormatId = isAudioOnly
        ? 'bestaudio'
        : (format?.formatId || selectedFormatId || 'bestvideo+bestaudio');

      await window.electronAPI.startDownload({
        url: downloadUrl,
        filename,
        formatId: resolvedFormatId,
        savePath,
        thumbnail: video.thumbnail,
        duration: video.duration,
        uploader: video.uploader
      });

      if (showSuccessMsg) {
        setSuccessMsg(`"${video.title || filename}" added to queue! Switch to Queue & History to track progress.`);
      }
      if (goToQueue) onGoToQueue?.();
      return true
    } catch (err: any) {
      console.error(`[Download Error]`, err);
      // Translate duplicate warning to user-friendly message
      if (err.message?.includes('already in your download queue')) {
        onError({ message: 'This video is already in your download queue.' });
      } else {
        onError({ message: 'Download failed. Please check your internet connection and try again.' });
      }
      return false
    }
  };

  const joinPath = (base: string, sub: string) => {
    const cleanedBase = base.replace(/[\\\/]+$/, '');
    const cleanedSub = sub.replace(/[\\\/]+/g, ' ').trim();
    return `${cleanedBase}\\${cleanedSub}`;
  };

  const handlePlaylistDownload = async () => {
    if (!videoInfo || videoInfo.length <= 1) return;
    if (!playlistTitle) return;
    if (startingPlaylist) return;

    const indicesToDownload =
      playlistMode === 'all'
        ? Array.from({ length: videoInfo.length }, (_, i) => i)
        : Array.from(selectedPlaylistIndexes.values());

    if (indicesToDownload.length === 0) return;

    setStartingPlaylist(true);
    if (successMsg) setSuccessMsg(null);

    try {
      const settings = await window.electronAPI.getSettings();
      const baseSavePath = settings?.download_path || settings?.downloadPath;
      const createFolder = Boolean(settings?.create_playlist_folder ?? settings?.createPlaylistFolder ?? true);

      const playlistFolderName = (playlistTitle || 'Playlist')
        .replace(/[<>:"/\\|?*]/g, '')
        .trim()
        .slice(0, 100);

      const savePathOverride = createFolder
        ? joinPath(baseSavePath, playlistFolderName || 'Playlist')
        : baseSavePath;

      let okCount = 0;
      for (let start = 0; start < indicesToDownload.length; start++) {
        const idx = indicesToDownload[start];
        const ok = await handleDownload(videoInfo[idx], idx, {
          goToQueue: false,
          showSuccessMsg: false,
          savePathOverride,
        });
        if (ok) okCount++;

        if (start < indicesToDownload.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }

      setSuccessMsg(
        `${okCount} item${okCount === 1 ? '' : 's'} added to queue! Switch to Queue & History to track progress.`
      );
      onGoToQueue?.();
    } finally {
      setStartingPlaylist(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* yt-dlp update banner */}
      {showUpdateBanner && (
        <div className="flex items-center justify-between gap-4 px-4 py-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 text-sm">
          <span className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4 shrink-0" />
            A yt-dlp update is available (v{ytdlpLatestVersion}). Keep it updated for best compatibility.
          </span>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs border-yellow-500/40 hover:bg-yellow-500/20 text-yellow-600 dark:text-yellow-400"
              onClick={onGoToSettings}
            >
              Update in Settings
            </Button>
            <button
              onClick={onDismissBanner}
              className="p-1 rounded hover:bg-yellow-500/10 text-yellow-500 transition-colors"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <Card className="border-border bg-card shadow-sm">
        <CardContent className="p-6 md:p-8">
          <div className="mb-6">
            <h2 className="text-3xl font-bold tracking-tight mb-2">Download a Video</h2>
            <p className="text-muted-foreground text-base">Paste a video link from YouTube, Twitter, Vimeo, or others to get started.</p>
          </div>

          <form onSubmit={handleScan} className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Input
                ref={urlInputRef}
                placeholder="Paste your video link here..."
                value={scanUrl}
                onChange={(e) => {
                  setScanUrl(e.target.value);
                  setUrlError(null);
                  setSuccessMsg(null);
                }}
                className={cn(
                  "h-14 md:text-lg bg-input border-border focus-visible:ring-primary focus-visible:border-primary shadow-sm rounded-lg pr-12",
                  urlError && "border-destructive focus-visible:ring-destructive"
                )}
              />
              {scanUrl && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-full hover:bg-muted"
                  title="Clear URL"
                  aria-label="Clear URL"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <Button
              type="submit"
              size="lg"
              disabled={!scanUrl || loading}
              className="h-14 px-8 text-base btn-primary rounded-lg shrink-0 min-w-[220px]"
            >
              {loading ? (
                <div className="flex flex-col items-center">
                  <div className="flex items-center"><Loader2 className="w-5 h-5 mr-2 animate-spin" />Scanning</div>
                  <span className="text-xs opacity-80 mt-0.5 max-w-[190px] truncate">{loadingMessage}</span>
                </div>
              ) : (
                <><Download className="w-5 h-5 mr-3" />Get Video Info</>
              )}
            </Button>
          </form>

          {/* Inline URL validation error */}
          {urlError && (
            <p className="mt-3 text-sm text-destructive flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {urlError}
            </p>
          )}

          {/* Success message */}
          {successMsg && (
            <p className="mt-3 text-sm text-green-600 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              {successMsg}
            </p>
          )}

          {/* Fetch error (friendly) */}
          {errorObj && (
            <Alert variant="destructive" className="mt-4 bg-destructive/10 border-destructive/20">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="flex flex-col gap-2">
                <span>{errorObj.message || "Could not fetch video info. Check the URL and try again."}</span>
                {errorObj.message?.includes("not supported") && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-fit h-7 text-xs border-destructive/30 hover:bg-destructive hover:text-white mt-1"
                    onClick={async () => {
                      try {
                        if (!window.electronAPI) return;
                        await window.electronAPI.updateYtDlp();
                        alert("Update successful! Please try scanning the link again.");
                      } catch (err: any) {
                        alert(err.message);
                      }
                    }}
                  >
                    <RefreshCw className="w-3 h-3 mr-1" /> Update Extractors
                  </Button>
                )}
              </AlertDescription>
            </Alert>
          )}

          {playlistBlocked && (
            <Alert className="mt-4 border-yellow-500/30 bg-yellow-500/10 text-yellow-700 dark:text-yellow-300">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="flex flex-col gap-3">
                <span>
                  This is a playlist with {playlistBlocked.count} videos. Enable playlist downloading in Settings to download all videos, or paste a single video URL instead.
                </span>
                <div className="flex gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs border-yellow-500/40 hover:bg-yellow-500/20 text-yellow-700 dark:text-yellow-300"
                    onClick={onGoToSettings}
                  >
                    Open Settings
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={handleClear}
                  >
                    Clear URL
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {videoInfo && (
        <div className="space-y-6">
          {playlistTitle && videoInfo.length > 1 && (
            <div className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground">{playlistTitle}</h4>
                  <p className="text-sm text-muted-foreground">
                    {playlistVideoCount ?? videoInfo.length} videos
                  </p>
                </div>
                <div className="flex flex-col gap-2 text-sm">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="playlistMode"
                      checked={playlistMode === 'all'}
                      onChange={() => setPlaylistMode('all')}
                    />
                    <span>Download all {playlistVideoCount ?? videoInfo.length} videos</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="playlistMode"
                      checked={playlistMode === 'select'}
                      onChange={() => setPlaylistMode('select')}
                    />
                    <span>Select specific videos</span>
                  </label>
                </div>
              </div>

              {playlistMode === 'select' && (
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={selectedPlaylistIndexes.size === videoInfo.length && videoInfo.length > 0}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedPlaylistIndexes(new Set(Array.from({ length: videoInfo.length }, (_, i) => i)));
                      } else {
                        setSelectedPlaylistIndexes(new Set());
                      }
                    }}
                  />
                  <span>Select all</span>
                </div>
              )}
            </div>
          )}

          {videoInfo.map((video, idx) => (
            <Card key={idx} className="overflow-hidden border-border bg-card shadow-md">
              <div className="flex flex-col md:flex-row">
                {/* Thumbnail */}
                <div className="md:w-72 bg-muted relative shrink-0">
                  <div className="aspect-video w-full h-full relative">
                    {video.thumbnail ? (
                      <img src={video.thumbnail} className="w-full h-full object-cover" alt="Video thumbnail" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon className="w-12 h-12 text-muted-foreground/30" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/20" />
                    <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/80 rounded text-xs font-medium text-white flex items-center gap-1">
                      <PlayCircle className="w-3 h-3" />
                      {video.duration
                        ? `${Math.floor(video.duration / 60)}:${(video.duration % 60).toString().padStart(2, '0')}`
                        : "LIVE"}
                    </div>
                  </div>
                </div>

                {/* Details */}
                <div className="flex-1 p-6 flex flex-col">
                  <div className="mb-6 border-b border-border/50 pb-6">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-xl md:text-2xl font-bold leading-snug mb-2 pr-4">{video.title || "Unknown Video"}</h3>
                      {playlistTitle && videoInfo.length > 1 && playlistMode === 'select' && (
                        <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer mt-1">
                          <input
                            type="checkbox"
                            checked={selectedPlaylistIndexes.has(idx)}
                            onChange={() => {
                              setSelectedPlaylistIndexes((prev) => {
                                const next = new Set(prev);
                                if (next.has(idx)) next.delete(idx);
                                else next.add(idx);
                                return next;
                              });
                            }}
                          />
                          <span className="text-xs">Select</span>
                        </label>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1.5 bg-muted px-2 py-1 rounded-md text-foreground">
                        <User className="w-4 h-4" /> {video.uploader || "Anonymous"}
                      </span>
                    </div>
                  </div>

                  <div className="mt-auto pt-4 flex flex-col sm:flex-row gap-3 items-end sm:items-center">
                    <div className="flex-1 w-full space-y-2">
                      <label className="text-sm font-medium text-muted-foreground block">
                        Select Quality
                      </label>
                      <Select 
                        value={selectedFormats[idx] || "bestvideo+bestaudio"} 
                        onValueChange={(val) => setSelectedFormats(prev => ({ ...prev, [idx]: val }))}
                      >
                        <SelectTrigger className="w-full bg-muted/50 border-border h-11">
                          <SelectValue placeholder="Select quality..." />
                        </SelectTrigger>
                        <SelectContent>
                          {video.formats?.map((f: any) => (
                            <SelectItem key={f.formatId} value={f.formatId}>
                              {f.label || f.quality}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {!(playlistTitle && videoInfo.length > 1) && (
                      <Button
                        size="lg"
                        className="btn-primary w-full sm:w-auto h-11 px-8 shrink-0"
                        onClick={() => handleDownload(video, idx, { goToQueue: true, showSuccessMsg: true })}
                        disabled={loading}
                      >
                        <Download className="w-5 h-5 mr-2" /> {loading ? 'Scanning...' : 'Download'}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ))}

          {playlistTitle && videoInfo.length > 1 && (
            <div className="flex justify-end">
              <Button
                size="lg"
                className="btn-primary"
                disabled={
                  startingPlaylist ||
                  loading ||
                  (playlistMode === 'select' && selectedPlaylistIndexes.size === 0)
                }
                onClick={handlePlaylistDownload}
              >
                <Download className="w-5 h-5 mr-2" />
                {startingPlaylist
                  ? 'Starting...'
                  : playlistMode === 'all'
                    ? `Download all ${playlistVideoCount ?? videoInfo.length} videos`
                    : `Download ${selectedPlaylistIndexes.size} selected videos`}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// History / Queue Panel
// ─────────────────────────────────────────────────────────────────────────────

interface DownloadJob {
  jobId: string
  url: string
  title: string
  thumbnail: string
  duration: string | number
  format: string
  percent: number
  speed: string
  eta: string
  phase: string
  status: 'queued' | 'downloading' | 'merging' | 'paused' | 'completed' | 'failed' | 'cancelled'
  totalSize: string
  error?: string
  savePath?: string
  canRetry: boolean
}

const DownloadCard = ({ job, onPause, onResume, onCancel, onRetry, onRemove, onOpenFolder, loading }: {
  job: DownloadJob
  onPause: (jobId: string) => void
  onResume: (jobId: string) => void
  onCancel: (jobId: string) => void
  onRetry: (jobId: string) => void
  onRemove: (jobId: string) => void
  onOpenFolder: (savePath: string) => void
  loading: boolean
}) => {
  const isActive = job.status === 'downloading' || job.status === 'merging'
  const isPaused = job.status === 'paused'
  const isCompleted = job.status === 'completed' || job.percent === 100
  const isFailed = job.status === 'failed'
  const isQueued = job.status === 'queued'

  const progressColor = isCompleted
    ? 'bg-green-500'
    : isFailed
    ? 'bg-red-500'
    : isPaused
    ? 'bg-yellow-500'
    : 'bg-primary'

  const statusLabel: Record<string, string> = {
    queued: 'Waiting',
    downloading: 'Downloading',
    merging: 'Merging',
    paused: 'Paused',
    completed: 'Complete',
    failed: 'Failed',
    cancelled: 'Cancelled'
  }

  const currentLabel = isCompleted ? 'Complete' : statusLabel[job.status] || job.status

  const statusColor: Record<string, string> = {
    queued: 'text-muted-foreground',
    downloading: 'text-blue-400',
    merging: 'text-cyan-400',
    paused: 'text-yellow-400',
    completed: 'text-green-400',
    failed: 'text-destructive',
    cancelled: 'text-orange-500'
  }

  const currentStatusColor = isCompleted ? statusColor.completed : statusColor[job.status] || statusColor.queued

  return (
    <div className="flex flex-col sm:flex-row gap-3 p-4 rounded-lg bg-card border border-border shadow-sm mb-3">
      {/* Thumbnail */}
      <div className="flex-shrink-0 w-24 h-16 rounded overflow-hidden bg-black/5 border border-border relative">
        {job.thumbnail ? (
          <img
            src={job.thumbnail}
            alt={job.title}
            className="w-full h-full object-cover"
            onError={(e) => { e.currentTarget.style.display = 'none' }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            <FileVideo className="w-6 h-6" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Title row */}
        <div className="flex items-start justify-between gap-2 mb-1">
          <p className="text-base font-semibold text-foreground truncate">{job.title || 'Unknown Title'}</p>
          <span className={`text-xs font-semibold flex-shrink-0 px-2 py-0.5 rounded shadow-sm bg-muted/60 ${currentStatusColor}`}>{currentLabel}</span>
        </div>

        {/* Phase and size row */}
        <p className="text-xs text-muted-foreground mb-2">
          {job.phase}
          {job.totalSize && !isCompleted && !isFailed ? ` — ${job.totalSize}` : ''}
        </p>

        {/* Progress bar */}
        <div className="w-full h-2 bg-secondary rounded-full overflow-hidden mb-2">
          <div
            className={`h-full rounded-full transition-all duration-500 ease-out ${progressColor}`}
            style={{ width: `${Math.max(0, Math.min(100, job.percent))}%` }}
          />
        </div>

        {/* Stats row */}
        {(isActive || isPaused) && (
          <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
            <span className="font-mono font-medium">{job.percent.toFixed(1)}%</span>
            {job.speed && <span className="flex items-center gap-1"><Zap className="w-3 h-3" /> {job.speed}</span>}
            {job.eta && <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {job.eta}</span>}
          </div>
        )}

        {/* Error message */}
        {isFailed && job.error && (
          <p className="text-xs text-destructive mb-2 line-clamp-2 bg-destructive/10 px-2 py-1 rounded border border-destructive/20">{job.error}</p>
        )}

        {/* Completed info */}
        {isCompleted && job.savePath && (
          <p className="text-xs text-green-600 mb-2 truncate bg-green-500/10 px-2 py-1 rounded border border-green-500/20">
            Saved to: {job.savePath}
          </p>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-2 flex-wrap mt-3">
          {/* Pause */}
          {isActive && (
            <Button size="sm" variant="secondary" className="h-7 text-xs" onClick={() => onPause(job.jobId)} disabled={loading}>
              <Pause className="w-3 h-3 mr-1" /> {loading ? 'Processing...' : 'Pause'}
            </Button>
          )}

          {/* Resume */}
          {isPaused && (
            <Button size="sm" variant="default" className="h-7 text-xs" onClick={() => onResume(job.jobId)} disabled={loading}>
              <Play className="w-3 h-3 mr-1" /> {loading ? 'Processing...' : 'Resume'}
            </Button>
          )}

          {/* Cancel */}
          {(isActive || isQueued || isPaused) && (
            <Button size="sm" variant="outline" className="h-7 text-xs border-destructive/30 text-destructive hover:bg-destructive hover:text-white" onClick={() => onCancel(job.jobId)} disabled={loading}>
              <XCircle className="w-3 h-3 mr-1" /> {loading ? 'Processing...' : 'Cancel'}
            </Button>
          )}

          {/* Retry */}
          {(isFailed || (isCompleted && job.error)) && (
            <Button size="sm" variant="secondary" className="h-7 text-xs" onClick={() => onRetry(job.jobId)} disabled={loading}>
              <RotateCcw className="w-3 h-3 mr-1" /> {loading ? 'Processing...' : 'Retry'}
            </Button>
          )}

          {/* Open Folder */}
          {isCompleted && job.savePath && (
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onOpenFolder(job.savePath!)}>
              <FolderOpen className="w-3 h-3 mr-1" /> Open Folder
            </Button>
          )}

          {/* Remove */}
          {(isCompleted || isFailed || job.status === 'cancelled') && (
            <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={() => onRemove(job.jobId)}>
              <Trash2 className="w-3 h-3 mr-1" /> Remove
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

function HistoryPanel() {
  const [downloads, setDownloads] = useState<DownloadJob[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [clearing, setClearing] = useState(false)

  // Load initial history
  useEffect(() => {
    const loadHistory = async () => {
      if (!window.electronAPI) return;
      try {
        const history = await window.electronAPI.getDownloadHistory();
        const initialJobs: DownloadJob[] = history.map((item: any) => ({
          jobId: String(item.id),
          url: item.url,
          title: item.filename,
          thumbnail: item.thumbnail,
          duration: item.duration || '',
          format: item.format_id || '',
          percent: item.state === 'completed' ? 100 : 0,
          speed: '',
          eta: '',
          phase: item.state === 'completed' ? 'Completed' : item.state,
          status: item.state as DownloadJob['status'],
          totalSize: '',
          error: item.error,
          savePath: item.save_path,
          canRetry: item.state === 'failed' || item.state === 'completed' || item.state === 'cancelled'
        }));
        setDownloads(initialJobs);
      } finally {
        setIsLoading(false);
      }
    };
    loadHistory();
  }, []);

  // Set up progress listener ONCE on mount
  useEffect(() => {
    if (!window.electronAPI) return

    // Remove any existing listeners first
    window.electronAPI.removeProgressListener()

    window.electronAPI.onDownloadProgress((data: any) => {

      setDownloads(prev => prev.map(job => {
        if (job.jobId !== String(data.jobId)) return job

        return {
          ...job,
          percent: typeof data.percent === 'number' ? data.percent : job.percent,
          speed: data.speed !== undefined ? data.speed : job.speed,
          eta: data.eta !== undefined ? data.eta : job.eta,
          phase: data.phase || job.phase,
          status: data.status || job.status,
          totalSize: data.totalSize || job.totalSize,
          error: data.error || job.error,
          savePath: data.savePath || job.savePath,
          canRetry: data.status === 'failed' || data.status === 'completed' || data.status === 'cancelled'
        }
      }))
    })

    return () => {
      window.electronAPI?.removeProgressListener()
    }
  }, [])

  // BUTTON HANDLERS
  const handlePause = async (jobId: string) => {
    if (!window.electronAPI) return
    try {
      await window.electronAPI.pauseDownload(Number(jobId))
      setDownloads(prev => prev.map(j =>
        j.jobId === jobId ? { ...j, status: 'paused', phase: 'Paused' } : j
      ))
    } catch (err) {
    }
  }

  const handleResume = async (jobId: string) => {
    if (!window.electronAPI) return
    try {
      await window.electronAPI.resumeDownload(Number(jobId))
      setDownloads(prev => prev.map(j =>
        j.jobId === jobId ? { ...j, status: 'downloading', phase: 'Resuming...' } : j
      ))
    } catch (err) {
    }
  }

  const handleCancel = async (jobId: string) => {
    if (!window.electronAPI) return
    try {
      await window.electronAPI.cancelDownload(Number(jobId))
      setDownloads(prev => prev.map(j =>
        j.jobId === jobId
          ? { ...j, status: 'cancelled', phase: 'Cancelled', percent: 0 }
          : j
      ))
    } catch (err) {
    }
  }

  const handleRetry = async (jobId: string) => {
    const job = downloads.find(j => j.jobId === jobId)
    if (!job || !window.electronAPI) return
    try {
      setDownloads(prev => prev.map(j =>
        j.jobId === jobId
          ? { ...j, status: 'queued', percent: 0, phase: 'Retrying...', error: undefined }
          : j
      ))
      await window.electronAPI.restartDownload(Number(jobId))
    } catch (err) {
      setDownloads(prev => prev.map(j =>
        j.jobId === jobId
          ? { ...j, status: 'failed', phase: 'Retry failed', error: String(err) }
          : j
      ))
    }
  }

  const handleRemove = async (jobId: string) => {
    if (!window.electronAPI) return
    try {
      await window.electronAPI.deleteDownload(Number(jobId))
      setDownloads(prev => prev.filter(j => j.jobId !== jobId))
    } catch (err) {
    }
  }

  const handleOpenFolder = async (savePath: string) => {
    if (!window.electronAPI) return
    await window.electronAPI.openFolder(savePath)
  }

  const handleClearHistory = async () => {
    if (!window.electronAPI) return;
    const confirmed = window.confirm("Clear all download history? This cannot be undone.");
    if (!confirmed) return;
    setClearing(true);
    try {
      await window.electronAPI.clearHistory();
      setDownloads([]);
    } finally {
      setClearing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-32 bg-card border border-border animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <Card className="border-border shadow-sm">
      <div className="p-6 border-b border-border flex flex-col sm:flex-row gap-4 sm:items-center justify-between">
        <div>
          <h3 className="text-2xl font-bold">Download Queue</h3>
          <p className="text-muted-foreground mt-1">Manage and track your video downloads.</p>
        </div>
        <Button
          variant="outline"
          className="border-border text-muted-foreground hover:bg-destructive/10 hover:text-destructive shrink-0"
          onClick={handleClearHistory}
          disabled={clearing || isLoading}
        >
          {clearing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
          {clearing ? 'Clearing...' : 'Clear History'}
        </Button>
      </div>

      <ScrollArea className="h-[600px]">
        <div className="p-6 space-y-2">
          {downloads.map((dl) => (
            <DownloadCard
              key={dl.jobId}
              job={dl}
              onPause={handlePause}
              onResume={handleResume}
              onCancel={handleCancel}
              onRetry={handleRetry}
              onRemove={handleRemove}
              onOpenFolder={handleOpenFolder}
              loading={isLoading}
            />
          ))}

          {downloads.length === 0 && (
            <div className="text-center py-20 flex flex-col items-center">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <Download className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-bold mb-2">No downloads yet</h3>
              <p className="text-muted-foreground max-w-md">Paste a video link on the Downloader tab to get started. Supports YouTube, TikTok, Instagram, Twitter, and 1000+ other sites.</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Settings Panel
// ─────────────────────────────────────────────────────────────────────────────

function SettingsPanel() {
  const [settings, setSettings] = useState<any>(null);
  const [saved, setSaved] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [appVersion, setAppVersion] = useState<string>('');

  // Binary updates state
  const [binaryUpdates, setBinaryUpdates] = useState<Array<{
    name: string;
    installedVersion: string;
    latestVersion: string;
    needsUpdate: boolean;
    downloadUrl: string;
    updating?: boolean;
  }>>([]);

  const loadBinaryUpdates = useCallback(async () => {
    if (!window.electronAPI) return;
    try {
      const updates = await window.electronAPI.checkAllBinaryUpdates();
      setBinaryUpdates(updates.map(u => ({ ...u, updating: false })));
    } catch (error: any) {
      console.error('Failed to check binary updates:', error);
    }
  }, []);

  // Load binary updates on mount
  useEffect(() => {
    loadBinaryUpdates();
  }, [loadBinaryUpdates]);

  const handleUpdateBinary = async (binaryName: string) => {
    if (!window.electronAPI) return;
    
    setBinaryUpdates(prev => 
      prev.map(u => u.name === binaryName ? { ...u, updating: true } : u)
    );
    
    try {
      const result = await window.electronAPI.updateBinary(binaryName);
      if (result.success) {
        setBinaryUpdates(prev => 
          prev.map(u => u.name === binaryName ? { 
            ...u, 
            installedVersion: result.newVersion, 
            latestVersion: result.newVersion, 
            needsUpdate: false, 
            updating: false 
          } : u)
        );
      }
    } catch (error: any) {
      console.error(`Failed to update ${binaryName}:`, error);
      setBinaryUpdates(prev => 
        prev.map(u => u.name === binaryName ? { ...u, updating: false } : u)
      );
    }
  };

  const handleUpdateAllBinaries = async () => {
    if (!window.electronAPI) return;
    
    setBinaryUpdates(prev => prev.map(u => ({ ...u, updating: true })));
    
    try {
      const updates = await window.electronAPI.checkAllBinaryUpdates();
      const outdatedBinaries = updates.filter(u => u.needsUpdate);
      
      for (const binary of outdatedBinaries) {
        try {
          await window.electronAPI.updateBinary(binary.name);
        } catch (error: any) {
          console.error(`Failed to update ${binary.name}:`, error);
        }
      }
      
      // Reload all updates after completion
      await loadBinaryUpdates();
    } catch (error: any) {
      console.error('Failed to update binaries:', error);
      setBinaryUpdates(prev => prev.map(u => ({ ...u, updating: false })));
    }
  };

  const defaultSettings = {
    downloadPath: '',
    maxConcurrentDownloads: 3,
    defaultQuality: 'best',
    defaultFormat: 'mp4',
    theme: 'system',
    detectPlaylists: false,
    playlistDownloadMode: 'all',
    createPlaylistFolder: true,
    eulaAgeAcknowledged: 0 as 0 | 1,
    cookiesFilePath: '',
  };

  const loadSettings = useCallback(async () => {
    try {
      if (!window.electronAPI) {
        setSettings(defaultSettings);
        return;
      }
      const s = await window.electronAPI.getSettings();
      let defaultPath = '';
      try {
        defaultPath = await window.electronAPI.getDefaultDownloadPath();
      } catch (e) {
      }

      if (!s) {
        setSettings({ ...defaultSettings, downloadPath: defaultPath });
        return;
      }

      setSettings({
        downloadPath: s.download_path || s.downloadPath || defaultPath,
        maxConcurrentDownloads: s.max_concurrent_downloads ?? s.maxConcurrentDownloads ?? 3,
        defaultQuality: s.default_quality || s.defaultQuality || 'best',
        defaultFormat: s.default_format || s.defaultFormat || 'mp4',
        theme: s.theme || 'system',
        detectPlaylists: s.detect_playlists ?? s.detectPlaylists ?? false,
        playlistDownloadMode: s.playlist_download_mode || s.playlistDownloadMode || 'all',
        createPlaylistFolder: Boolean(s.create_playlist_folder ?? s.createPlaylistFolder ?? true),
        eulaAgeAcknowledged: Number(s.eula_age_acknowledged ?? s.eulaAgeAcknowledged ?? 0) === 1 ? 1 : 0,
        cookiesFilePath: String(s.cookies_file_path ?? s.cookiesFilePath ?? ''),
      });
    } catch (error) {
      setSettings(defaultSettings);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    const loadAppVersion = async () => {
      if (!window.electronAPI) return;
      try {
        const versionInfo = await window.electronAPI.getAppVersion();
        setAppVersion(versionInfo.version);
      } catch (error: any) {
        console.error('Failed to load app version:', error);
      }
    };
    loadAppVersion();
  }, []);

  // Wire up yt-dlp background version check events
  useEffect(() => {
    if (!window.electronAPI) return;

    // Receive up-to-date notification
    window.electronAPI.onYtDlpVersionInfo((data) => {
      setYtDlpVersion(data.currentVersion);
      setLatestVersion(data.latestVersion);
      setUpdateAvailable(false);
      setUpdateStatus('');
    });

    // Receive update-available notification
    window.electronAPI.onYtDlpUpdateAvailable((data) => {
      setYtDlpVersion(data.currentVersion);
      setLatestVersion(data.latestVersion);
      setUpdateAvailable(true);
      setUpdateStatus(`v${data.latestVersion} available`);
    });

    // Also eagerly fetch the installed version so it shows immediately
    window.electronAPI.getYtDlpVersion?.().then((v) => {
      if (v && v !== 'unknown') setYtDlpVersion(v);
    }).catch(() => {});
  }, []);

  const saveSetting = async (key: string, value: any) => {
    if (!window.electronAPI) return;
    const updated = { ...settings, [key]: value };
    setSettings(updated);
    await window.electronAPI.saveSettings(updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleBrowse = async () => {
    if (!window.electronAPI) return;
    const chosen = await window.electronAPI.chooseSaveFolder();
    if (chosen) {
      await saveSetting('downloadPath', chosen);
    }
  };

  const handleBrowseCookies = async () => {
    if (!window.electronAPI?.chooseCookiesFile) return;
    const chosen = await window.electronAPI.chooseCookiesFile();
    if (chosen) await saveSetting('cookiesFilePath', chosen);
  };
  const handleReset = async () => {
    if (!window.electronAPI) return;
    const confirmed = window.confirm("Reset all settings to their defaults?");
    if (!confirmed) return;
    setResetting(true);
    try {
      await window.electronAPI.resetSettings();
      await loadSettings();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setResetting(false);
    }
  };

  
  if (!settings) {
    return (
      <div className="flex items-center justify-center p-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      <Card className="border-border shadow-sm">
        <div className="p-6 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Settings</h2>
            <p className="text-muted-foreground mt-1">Manage how your app downloads video files.</p>
          </div>
          <div className="text-right">
            <span className="text-sm text-muted-foreground">Version {appVersion}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              disabled={resetting}
              className="text-muted-foreground hover:text-destructive border-border"
            >
              {resetting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RotateCcw className="w-4 h-4 mr-2" />}
              Reset Defaults
            </Button>
          </div>
        </div>

        <CardContent className="p-6 md:p-8 space-y-8">

          {/* Save Location */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <FolderOpen className="w-5 h-5 text-primary" /> Save downloads to
            </h3>
            <p className="text-sm text-muted-foreground">The folder on your computer where video files will be saved.</p>
            <div className="flex gap-4 max-w-md">
              <Input value={settings.downloadPath} readOnly className="bg-muted border-border cursor-default" />
              <Button onClick={handleBrowse} variant="secondary">Browse</Button>
            </div>
          </div>

          <div className="border-t border-border/50 pt-8 space-y-3">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-primary" /> Age eligibility &amp; site sign-in
            </h3>
            <p className="text-sm text-muted-foreground">
              Some hosts only serve certain videos after you sign in there. yt-dlp can use a browser
              cookie file you export (Netscape format). The app does not handle your password—only the
              file you pick on this device.
            </p>
            <div className="flex items-center space-x-3">
              <Switch
                id="eula-settings"
                checked={settings.eulaAgeAcknowledged === 1}
                onCheckedChange={(checked) => saveSetting('eulaAgeAcknowledged', checked ? 1 : 0)}
              />
              <Label htmlFor="eula-settings" className="text-sm cursor-pointer leading-snug">
                I am of legal age where I live and I accept the EULA (required to use the app).
              </Label>
            </div>
            <button
              type="button"
              className="text-sm text-primary underline-offset-4 hover:underline inline-flex items-center gap-1"
              onClick={() =>
                window.electronAPI?.openExternal(
                  'https://github.com/Isaac-Onyango-Dev/Internet-Download-Hub/blob/main/EULA.txt'
                )
              }
            >
              Read the EULA
              <ExternalLink className="h-3.5 w-3.5" />
            </button>
            <div className="space-y-2 pt-2">
              <Label className="text-sm text-muted-foreground">Cookies file (optional)</Label>
              <div className="flex flex-wrap gap-2 items-center">
                <Input
                  value={settings.cookiesFilePath || ''}
                  readOnly
                  className="bg-muted border-border cursor-default flex-1 min-w-[12rem]"
                  placeholder="None selected"
                />
                <Button onClick={handleBrowseCookies} variant="secondary" type="button">
                  Browse…
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!settings.cookiesFilePath}
                  onClick={() => saveSetting('cookiesFilePath', '')}
                >
                  Clear
                </Button>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Export cookies while logged into the site (for example YouTube) using a trusted method;
                keep the file private and clear it here when you no longer need it.
              </p>
            </div>
          </div>

          {/* Concurrent Downloads */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Zap className="w-5 h-5 text-primary" /> Concurrent downloads
            </h3>
            <p className="text-sm text-muted-foreground">How many videos should download at the same time.</p>
            <Select
              value={String(settings.maxConcurrentDownloads)}
              onValueChange={(v) => saveSetting('maxConcurrentDownloads', parseInt(v))}
            >
              <SelectTrigger className="w-full max-w-sm bg-input border-border h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 at a time (uses least bandwidth)</SelectItem>
                <SelectItem value="2">2 at a time</SelectItem>
                <SelectItem value="3">3 at a time (Recommended)</SelectItem>
                <SelectItem value="5">5 at a time (Fastest)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Default Quality */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-primary" /> Default video quality
            </h3>
            <p className="text-sm text-muted-foreground">The quality automatically selected for new downloads.</p>
            <Select
              value={settings.defaultQuality}
              onValueChange={(v) => saveSetting('defaultQuality', v)}
            >
              <SelectTrigger className="w-full max-w-sm bg-input border-border h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="best">Highest Quality Available</SelectItem>
                <SelectItem value="1080p">High (1080p)</SelectItem>
                <SelectItem value="720p">Standard (720p)</SelectItem>
                <SelectItem value="480p">Small File (480p)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Default Format */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <FileVideo className="w-5 h-5 text-primary" /> Default format
            </h3>
            <p className="text-sm text-muted-foreground">The file format used for video downloads.</p>
            <Select
              value={settings.defaultFormat}
              onValueChange={(v) => saveSetting('defaultFormat', v)}
            >
              <SelectTrigger className="w-full max-w-sm bg-input border-border h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mp4">MP4 (Most compatible)</SelectItem>
                <SelectItem value="webm">WebM (Open format)</SelectItem>
                <SelectItem value="mkv">MKV (Best quality)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="border-t border-border/50 pt-8 space-y-3">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <List className="w-5 h-5 text-primary" /> Playlist Downloads
            </h3>
            <p className="text-sm text-muted-foreground">Control what happens when you paste a playlist link.</p>
            <div className="flex items-center space-x-3">
              <Switch
                id="playlist-detect"
                checked={settings?.detectPlaylists || false}
                onCheckedChange={(checked) => saveSetting('detectPlaylists', checked)}
              />
              <Label htmlFor="playlist-detect" className="text-sm cursor-pointer">
                Enable Playlist Downloading
              </Label>
            </div>
            {settings?.detectPlaylists && (
              <>
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">Default Playlist Mode</Label>
                  <Select
                    value={settings.playlistDownloadMode}
                    onValueChange={(v) => saveSetting('playlistDownloadMode', v)}
                  >
                    <SelectTrigger className="w-full max-w-sm bg-input border-border h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Download all videos automatically</SelectItem>
                      <SelectItem value="select">Let me choose which videos to download</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center space-x-3 pt-2">
                  <Switch
                    id="playlist-create-folder"
                    checked={settings.createPlaylistFolder || false}
                    onCheckedChange={(checked) => saveSetting('createPlaylistFolder', checked)}
                  />
                  <Label htmlFor="playlist-create-folder" className="text-sm cursor-pointer">
                    Create playlist folder
                  </Label>
                </div>
              </>
            )}
          </div>

          <div className="border-t border-border/50 pt-8 space-y-3">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <RefreshCw className={cn("w-5 h-5 text-primary", binaryUpdates.some(u => u.updating) && "animate-spin")} /> Software updates
            </h3>
            <p className="text-sm text-muted-foreground">Keep all download engines up to date for best compatibility with all sites.</p>

            {/* Update All button */}
            <div className="mb-4">
              <Button
                onClick={handleUpdateAllBinaries}
                disabled={binaryUpdates.every(u => !u.needsUpdate) || binaryUpdates.some(u => u.updating)}
                variant="default"
                className="h-9"
              >
                {binaryUpdates.some(u => u.updating) ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Updating All...</>
                ) : binaryUpdates.some(u => u.needsUpdate) ? (
                  <>Update All</>
                ) : (
                  <>All Up to Date</>
                )}
              </Button>
            </div>

            {/* Individual binary updates */}
            <div className="space-y-4">
              {binaryUpdates.map((binary) => (
                <div key={binary.name} className="flex items-center justify-between p-4 border border-border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-medium">{binary.name}</h4>
                      <span className="text-xs text-muted-foreground">
                        v{binary.installedVersion} installed
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Latest: v{binary.latestVersion}</span>
                      {binary.needsUpdate && (
                        <span className="text-xs font-semibold bg-yellow-500/15 text-yellow-500 border border-yellow-500/30 px-2 py-0.5 rounded-full ml-2">
                          Update available
                        </span>
                      )}
                      {!binary.needsUpdate && binary.installedVersion !== 'Checking...' && binary.installedVersion !== 'Not installed' && (
                        <span className="text-xs font-semibold bg-green-500/15 text-green-500 border border-green-500/30 px-2 py-0.5 rounded-full ml-2 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Up to date
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {binary.updating ? (
                      <div className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-sm">Updating...</span>
                      </div>
                    ) : binary.needsUpdate ? (
                      <Button
                        onClick={() => handleUpdateBinary(binary.name)}
                        disabled={binary.updating}
                        variant="default"
                        size="sm"
                      >
                        Update
                      </Button>
                    ) : (
                      <span className="text-sm text-muted-foreground">Up to date</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Status message */}
            {updateStatus && (
              <p className={cn(
                "text-sm flex items-center gap-1.5",
                updateStatus.includes('failed') ? 'text-destructive' : 'text-green-500'
              )}>
                {updateStatus.includes('failed')
                  ? <AlertCircle className="w-3.5 h-3.5" />
                  : <CheckCircle2 className="w-3.5 h-3.5" />}
                {updateStatus}
              </p>
            )}
          </div>

        </CardContent>
      </Card>

      {/* Playlist Detection Dialog */}
      <Dialog open={showPlaylistDialog} onOpenChange={setShowPlaylistDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>Playlist Detected</DialogTitle>
            <DialogDescription>
              This URL is a playlist with {playlistDetectedData?.count || 0} videos. How would you like to proceed?
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="text-center">
              <h3 className="font-semibold text-lg">{playlistDetectedData?.title || 'Playlist'}</h3>
              <p className="text-muted-foreground">{playlistDetectedData?.count || 0} videos</p>
            </div>

            {/* Thumbnail grid preview */}
            <ScrollArea className="h-48 w-full border rounded-md p-2">
              <div className="grid grid-cols-4 gap-2">
                {playlistDetectedData?.entries?.slice(0, 12).map((entry, index) => (
                  <div key={index} className="relative group">
                    {entry.thumbnail ? (
                      <img 
                        src={entry.thumbnail} 
                        alt={entry.title}
                        className="w-full h-20 object-cover rounded border"
                      />
                    ) : (
                      <div className="w-full h-20 bg-muted rounded border flex items-center justify-center">
                        <ImageIcon className="w-6 h-6 text-muted-foreground/30" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded flex items-center justify-center">
                      <span className="text-white text-xs font-medium">{entry.index}</span>
                    </div>
                  </div>
                ))}
                {playlistDetectedData?.entries && playlistDetectedData.entries.length > 12 && (
                  <div className="w-full h-20 bg-muted rounded border flex items-center justify-center">
                    <span className="text-muted-foreground text-sm">+{playlistDetectedData.entries.length - 12} more</span>
                  </div>
                )}
              </div>
            </ScrollArea>

            <div className="flex gap-3 pt-4">
              <Button
                onClick={async () => {
                  if (!playlistDetectedData) return;
                  try {
                    const settings = await window.electronAPI.getSettings();
                    await window.electronAPI.addPlaylistToQueue(playlistDetectedData.entries, {
                      savePath: settings?.download_path || settings?.downloadPath,
                      createFolder: settings?.create_playlist_folder ?? settings?.createPlaylistFolder ?? true,
                      playlistTitle: playlistDetectedData.title
                    });
                    setShowPlaylistDialog(false);
                    setSuccessMsg(`Added ${playlistDetectedData.count} videos to queue! Switch to Queue & History to track progress.`);
                    onGoToQueue?.();
                  } catch (error: any) {
                    onError({ message: `Failed to add playlist to queue: ${error.message}` });
                  }
                }}
                className="flex-1 btn-primary"
              >
                <Download className="w-4 h-4 mr-2" />
                Download All Videos
              </Button>
              
              <Button
                variant="outline"
                onClick={() => {
                  setShowPlaylistDialog(false);
                  // Continue with single video download (already handled by the main process)
                }}
              >
                Download This Video Only
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

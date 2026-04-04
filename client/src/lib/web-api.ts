/**
 * Web API — a browser-compatible replacement for window.electronAPI.
 *
 * Video info and download are powered by the Cobalt open-source API.
 * Cobalt docs: https://github.com/imputnet/cobalt/blob/main/docs/api.md
 * Instance list: https://instances.cobalt.best/
 *
 * All other methods (settings, history, etc.) use localStorage so the app
 * works as a fully static site with zero backend requirements.
 */

// ── Cobalt instance config ────────────────────────────────────────────────────
// Primary and fallback community instances with CORS enabled.
// Replace these if the current ones go offline — check https://instances.cobalt.best/

const COBALT_INSTANCES = [
  'https://cobalt-backend.canine.tools',
  'https://cobalt-api.meowing.de',
  'https://api.cobalt.tools',
];

// ── Cobalt fetch with automatic fallback ─────────────────────────────────────

interface CobaltRequestBody {
  url: string;
  videoQuality?: string; // "720", "1080", etc.
  audioFormat?: string;   // "mp3", "opus", etc.
  filenameStyle?: 'classic' | 'pretty' | 'basic' | 'nerdy';
  isAudioOnly?: boolean;
  isAudioMuted?: boolean;
  videoCodec?: 'h264' | 'av1' | 'vp9';
}

interface CobaltResponse {
  status: 'redirect' | 'tunnel' | 'picker' | 'error';
  url?: string;
  filename?: string;
  error?: { code: string };
  picker?: Array<{ type: string; url: string; thumb?: string }>;
}

async function cobaltPost(instance: string, body: CobaltRequestBody): Promise<CobaltResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

  try {
    const resp = await fetch(`${instance}/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!resp.ok) {
      throw new Error(`Cobalt instance ${instance} returned ${resp.status}`);
    }
    return resp.json();
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

async function cobaltFetch(body: CobaltRequestBody): Promise<CobaltResponse> {
  let lastError: unknown = null;

  for (const instance of COBALT_INSTANCES) {
    try {
      return await cobaltPost(instance, body);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.warn(`[Cobalt] Instance ${instance} failed: ${errMsg}`);
      lastError = err;
    }
  }

  const finalMsg = lastError instanceof Error ? lastError.message : String(lastError || 'Unknown error');
  console.error(`[Cobalt] All instances failed. Last error: ${finalMsg}`);
  throw new Error(
    'Could not reach any Cobalt download service. Please check your internet connection and try again.',
  );
}

// ── Local settings helpers ────────────────────────────────────────────────────

const SETTINGS_KEY = 'idh_settings';

function loadSettings(): Record<string, unknown> {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveSettingsToStorage(updates: Record<string, unknown>) {
  const current = loadSettings();
  localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...current, ...updates }));
}

// ── Trigger browser file download ─────────────────────────────────────────────

function triggerBrowserDownload(url: string, filename: string) {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => document.body.removeChild(a), 1000);
}

// ── Map a Cobalt response to the app's VideoInfo shape ───────────────────────

function cobaltResponseToVideoInfo(cobaltResp: CobaltResponse, originalUrl: string) {
  // Cobalt returns a direct stream URL or a picker (for multi-track content).
  // We normalise both into a single "video" entry the UI can handle.
  const downloadUrl =
    cobaltResp.url ||
    cobaltResp.picker?.[0]?.url ||
    originalUrl;

  const thumbnail = cobaltResp.picker?.[0]?.thumb || '';

  return {
    url: originalUrl,
    extractedUrl: downloadUrl,
    title: cobaltResp.filename || 'Video',
    thumbnail,
    duration: 0,
    uploader: '',
    extractionMethod: 'cobalt',
    formats: [
      {
        formatId: 'best-video',
        label: 'Best Video (1080p)',
        quality: '1080p',
        ext: 'mp4',
        filesize: null,
        height: 1080,
      },
      {
        formatId: 'best-720',
        label: 'Standard Quality (720p)',
        quality: '720p',
        ext: 'mp4',
        filesize: null,
        height: 720,
      },
      {
        formatId: 'audio-only',
        label: 'Audio Only (MP3)',
        quality: 'audio',
        ext: 'mp3',
        filesize: null,
        height: null,
      },
    ],
    // Store the resolved CDN URL so startDownload can use it directly
    _cobaltDownloadUrl: downloadUrl,
    // Whether Cobalt returned a picker (multi-track, e.g. TikTok slideshow)
    _isPicker: cobaltResp.status === 'picker',
  };
}

// ── Map quality selection to Cobalt videoQuality param ───────────────────────

function formatIdToQuality(formatId: string): { videoQuality: string; isAudioOnly: boolean } {
  if (formatId === 'audio-only' || formatId === 'bestaudio') {
    return { videoQuality: '720', isAudioOnly: true };
  }
  if (formatId === 'best-720') return { videoQuality: '720', isAudioOnly: false };
  return { videoQuality: '1080', isAudioOnly: false };
}

// ── Public webAPI object ──────────────────────────────────────────────────────

export const webAPI = {
  // ── Video info ──────────────────────────────────────────────────────────────
  fetchVideoInfo: async (url: string) => {
    const cobaltResp = await cobaltFetch({ url, videoQuality: '1080' });

    if (cobaltResp.status === 'error') {
      throw new Error(
        cobaltResp.error?.code === 'error.api.content.unavailable'
          ? 'This URL is not supported. Try a link from YouTube, TikTok, Twitter, or another popular site.'
          : `Could not fetch video info: ${cobaltResp.error?.code || 'unknown error'}`,
      );
    }

    const videoInfo = cobaltResponseToVideoInfo(cobaltResp, url);

    return {
      success: true,
      data: videoInfo,
      meta: {
        playlistDetected: false,
        detectPlaylistsEnabled: false,
        collapsedToSingle: false,
      },
    };
  },

  // ── Downloads ───────────────────────────────────────────────────────────────
  startDownload: async (options: {
    url: string;
    filename: string;
    formatId?: string;
    savePath?: string;
    thumbnail?: string;
    duration?: number;
    uploader?: string;
  }) => {
    const { url, filename, formatId = 'best-video' } = options;
    const { videoQuality, isAudioOnly } = formatIdToQuality(formatId);

    const cobaltResp = await cobaltFetch({
      url,
      videoQuality,
      isAudioOnly,
      audioFormat: isAudioOnly ? 'mp3' : undefined,
    });

    if (cobaltResp.status === 'error') {
      throw new Error(`Download failed: ${cobaltResp.error?.code || 'unknown error'}`);
    }

    const downloadUrl = cobaltResp.url || cobaltResp.picker?.[0]?.url;
    if (!downloadUrl) throw new Error('Cobalt did not return a download URL.');

    triggerBrowserDownload(downloadUrl, filename);
    return { id: Date.now(), success: true };
  },

  cancelDownload: async (_id: number) => ({ success: true }),
  deleteDownload: async (_id: number) => ({ success: true }),
  restartDownload: async (_id: number) => {
    throw new Error('Re-download not supported in web mode. Please paste the URL again.');
  },
  pauseDownload: async (_id: number) => ({ success: true }),
  resumeDownload: async (_id: number) => ({ success: true }),

  // ── History ─────────────────────────────────────────────────────────────────
  getDownloadHistory: async () => [],
  clearHistory: async (_type: string) => ({ success: true }),

  // ── Settings ─────────────────────────────────────────────────────────────────
  getSettings: async () => {
    const s = loadSettings() as Record<string, unknown>;
    return {
      theme: (s.theme as string) || 'dark',
      download_path: (s.downloadPath as string) || '',
      downloadPath: (s.downloadPath as string) || '',
      default_quality: (s.default_quality as string) || 'best',
      default_format: (s.default_format as string) || 'mp4',
      max_concurrent_downloads: (s.max_concurrent_downloads as number) || 3,
      maxConcurrentDownloads: (s.max_concurrent_downloads as number) || 3,
      detect_playlists: (s.detect_playlists as number) ?? 0,
      create_playlist_folder: (s.create_playlist_folder as number) ?? 1,
      createPlaylistFolder: (s.create_playlist_folder as number) ?? 1,
      playlist_download_mode: (s.playlist_download_mode as string) || 'all',
      playlistDownloadMode: (s.playlist_download_mode as string) || 'all',
      eula_age_acknowledged: 1,
      eulaAgeAcknowledged: 1,
      cookies_file_path: (s.cookies_file_path as string) || '',
      cookiesFilePath: (s.cookies_file_path as string) || '',
    };
  },
  saveSettings: async (updates: Record<string, unknown>) => {
    saveSettingsToStorage(updates);
    return { success: true };
  },
  resetSettings: async () => {
    localStorage.removeItem(SETTINGS_KEY);
    return { success: true };
  },
  getDefaultDownloadPath: async () => '',
  chooseSaveFolder: async () => null,
  chooseCookiesFile: async () => null,

  // ── Disk space (always OK in web mode) ──────────────────────────────────────
  checkDiskSpace: async (_path?: string, _requiredBytes?: number) => ({
    isEnough: true,
    available: 100 * 1024 * 1024 * 1024,
    required: _requiredBytes || 0,
  }),

  // ── Folder / external links ──────────────────────────────────────────────────
  openFolder: async (_path: string) => {
    console.log('Open folder not supported in browser:', _path);
    return { success: true };
  },
  openExternal: (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  },

  // ── Playlist (sequential Cobalt calls, one per entry) ───────────────────────
  addPlaylistToQueue: async (
    entries: Array<{ url: string; title: string; thumbnail?: string }>,
    _opts: Record<string, unknown>,
  ) => {
    for (const entry of entries) {
      try {
        const cobaltResp = await cobaltFetch({ url: entry.url, videoQuality: '720' });
        const downloadUrl = cobaltResp.url || cobaltResp.picker?.[0]?.url;
        if (downloadUrl) {
          const cleanTitle = (entry.title || 'video').replace(/[^a-z0-9]/gi, '_').slice(0, 50);
          triggerBrowserDownload(downloadUrl, `${cleanTitle}.mp4`);
        }
      } catch (err) {
        console.warn('[Cobalt] Skipping playlist entry due to error:', err);
      }
      await new Promise((r) => setTimeout(r, 800));
    }
    return { addedCount: entries.length };
  },

  // ── App / version info ───────────────────────────────────────────────────────
  getAppVersion: async () => '1.0.8-web',
  getYtDlpVersion: async () => ({ version: 'cobalt', updateAvailable: false }),
  getUpdateInfo: async () => ({
    needsUpdate: false,
    installedVersion: '1.0.8',
    latestVersion: '1.0.8',
  }),

  // ── Binary updates (no-op in web) ───────────────────────────────────────────
  checkBinaryUpdates: async () => [],
  checkAllBinaryUpdates: async () => [],
  updateBinary: async (_name: string) => ({ success: false }),
  updateBinaries: async () => ({ success: true }),

  // ── Event stubs (Electron IPC events — not used in web) ─────────────────────
  onDownloadProgress: (_cb: (data: unknown) => void) => () => {},
  removeProgressListener: () => {},
  onYtDlpUpdateAvailable: (_cb: (data: unknown) => void) => () => {},
  onYtDlpVersionInfo: (_cb: (data: unknown) => void) => () => {},
  onPlaylistDetected: (_cb: (data: unknown) => void) => () => {},
  onPlaylistVideoDetected: (_cb: (data: unknown) => void) => () => {},
  onPlaylistDetectionComplete: (_cb: (data: unknown) => void) => () => {},

  // ── Update yt-dlp (no-op in web) ─────────────────────────────────────────────
  updateYtDlp: async () => ({ success: false, message: 'Not applicable in web mode' }),
  checkForUpdates: async () => {},
};

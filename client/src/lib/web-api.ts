/**
 * Web API — a browser-compatible replacement for window.electronAPI.
 *
 * When running in a browser (not Electron), this module provides the same
 * interface as the Electron preload bridge by routing calls to the
 * Express backend at /api/*.
 */

const SETTINGS_KEY = 'idh_settings';

function loadSettings(): Record<string, any> {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveSettingsToStorage(updates: Record<string, any>) {
  const current = loadSettings();
  localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...current, ...updates }));
}

function triggerBrowserDownload(url: string, filename: string) {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => document.body.removeChild(a), 1000);
}

// Determine the API base URL.
// In web mode, we default to relative paths (/api/*).
// This allows the app to work behind a reverse proxy or when hosted on the same domain as the server.
const getApiBase = () => {
  if (typeof window === 'undefined') return '';
  // @ts-ignore - VITE_API_URL might be defined via env
  return import.meta.env.VITE_API_URL || '';
};

const API_BASE = getApiBase();

export const webAPI = {
  // ── Video info ──────────────────────────────────────────────────────────────
  fetchVideoInfo: async (url: string) => {
    const resp = await fetch(`${API_BASE}/api/video-info?url=${encodeURIComponent(url)}`);
    const json = await resp.json();
    return json;
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
    const { url, filename, formatId = 'bestvideo+bestaudio' } = options;
    const downloadUrl =
      `${API_BASE}/api/download?` +
      `url=${encodeURIComponent(url)}` +
      `&formatId=${encodeURIComponent(formatId)}` +
      `&filename=${encodeURIComponent(filename)}`;

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
    const s = loadSettings();
    return {
      theme: s.theme || 'dark',
      download_path: s.downloadPath || '',
      downloadPath: s.downloadPath || '',
      default_quality: s.default_quality || 'best',
      default_format: s.default_format || 'mp4',
      max_concurrent_downloads: s.max_concurrent_downloads || 3,
      maxConcurrentDownloads: s.max_concurrent_downloads || 3,
      detect_playlists: s.detect_playlists ?? 0,
      create_playlist_folder: s.create_playlist_folder ?? 1,
      createPlaylistFolder: s.create_playlist_folder ?? 1,
      playlist_download_mode: s.playlist_download_mode || 'all',
      playlistDownloadMode: s.playlist_download_mode || 'all',
      eula_age_acknowledged: 1,
      eulaAgeAcknowledged: 1,
      cookies_file_path: s.cookies_file_path || '',
      cookiesFilePath: s.cookies_file_path || '',
    };
  },
  saveSettings: async (updates: Record<string, any>) => {
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
    available: 100 * 1024 * 1024 * 1024, // 100GB dummy
    required: _requiredBytes || 0,
  }),

  // ── Folder open (not applicable in web mode) ─────────────────────────────────
  openFolder: async (_path: string) => {
    console.log('Open folder not supported in browser:', _path);
    return { success: true };
  },

  // ── External links ───────────────────────────────────────────────────────────
  openExternal: (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  },

  // ── Playlist (web mode: we return info inline, no popup dialog) ─────────────
  addPlaylistToQueue: async (
    entries: Array<{ url: string; title: string; thumbnail?: string }>,
    _opts: any,
  ) => {
    for (const entry of entries) {
      const cleanTitle = (entry.title || 'video').replace(/[^a-z0-9]/gi, '_').slice(0, 50);
      const filename = `${cleanTitle}.mp4`;
      const downloadUrl =
        `${API_BASE}/api/download?` +
        `url=${encodeURIComponent(entry.url)}` +
        `&formatId=bestvideo%2Bbestaudio` +
        `&filename=${encodeURIComponent(filename)}`;
      triggerBrowserDownload(downloadUrl, filename);
      await new Promise((r) => setTimeout(r, 600));
    }
    return { addedCount: entries.length };
  },

  // ── App / version info ───────────────────────────────────────────────────────
  getAppVersion: async () => '1.0.8-web',
  getYtDlpVersion: async () => ({ version: 'latest', updateAvailable: false }),
  getUpdateInfo: async () => ({
    needsUpdate: false,
    installedVersion: '1.0.8',
    latestVersion: '1.0.8',
  }),

  // ── Binary updates (no-op) ───────────────────────────────────────────────────
  checkBinaryUpdates: async () => [],
  checkAllBinaryUpdates: async () => [],
  updateBinary: async (_name: string) => ({ success: false }),
  updateBinaries: async () => ({ success: true }),

  // ── Event stubs (Electron IPC events — not needed in web) ───────────────────
  onDownloadProgress: (_cb: (data: any) => void) => {
    return () => { };
  },
  removeProgressListener: () => { },
  onYtDlpUpdateAvailable: (_cb: (data: any) => void) => {
    return () => { };
  },
  onYtDlpVersionInfo: (_cb: (data: any) => void) => {
    return () => { };
  },
  onPlaylistDetected: (_cb: (data: any) => void) => {
    return () => { };
  },
  onPlaylistVideoDetected: (_cb: (data: any) => void) => {
    return () => { };
  },
  onPlaylistDetectionComplete: (_cb: (data: any) => void) => {
    return () => { };
  },

  // ── Update yt-dlp (no-op in web) ─────────────────────────────────────────────
  updateYtDlp: async () => ({ success: false, message: 'Update not supported in web mode' }),
  checkForUpdates: async () => { },
};

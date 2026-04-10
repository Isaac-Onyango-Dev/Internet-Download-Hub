/**
 * Cobalt API integration for the web version.
 *
 * This module provides a Cobalt-based download path as a fallback
 * when the primary yt-dlp server endpoint is unavailable.
 * The primary web download flow uses api.ts (server yt-dlp).
 *
 * Cobalt docs: https://github.com/imputnet/cobalt/blob/main/docs/api.md
 */

// ── Cobalt Instances ──────────────────────────────────────────────────────
// If the backend proxy is unavailable, these public instances are tried
// as a direct fallback (they may require JWT auth).

const COBALT_INSTANCES = [
  'https://cobalt-api.meowing.de',
  'https://api.cobalt.tools',
  'https://cobalt-backend.canine.tools',
];

interface CobaltRequestBody {
  url: string;
  videoQuality?: string;
  isAudioOnly?: boolean;
  audioFormat?: string;
}

interface CobaltResponse {
  status: 'redirect' | 'tunnel' | 'picker' | 'error';
  url?: string;
  filename?: string;
  error?: { code: string };
  picker?: Array<{ type: string; url: string; thumb?: string }>;
}

// ── Cobalt fetch with instance fallback ───────────────────────────────────

async function cobaltFetchDirect(body: CobaltRequestBody): Promise<CobaltResponse> {
  let lastError: unknown = null;

  for (const instance of COBALT_INSTANCES) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    try {
      const resp = await fetch(`${instance}/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!resp.ok) throw new Error(`Instance returned ${resp.status}`);
      return resp.json();
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      lastError = err;
    }
  }

  throw lastError || new Error('All Cobalt instances failed');
}

// ── Browser download helper ───────────────────────────────────────────────

function triggerBrowserDownload(url: string, filename: string) {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    if (a.parentNode) a.parentNode.removeChild(a);
  }, 1000);
}

// ── Local settings helpers ────────────────────────────────────────────────

const SETTINGS_KEY = 'idh_settings';

function loadSettings(): Record<string, unknown> {
  try { return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'); } catch { return {}; }
}

function saveSettingsToStorage(updates: Record<string, unknown>) {
  const current = loadSettings();
  localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...current, ...updates }));
}

// ── Public webAPI object ──────────────────────────────────────────────────

export const webAPI = {
  // ── Cobalt video info (minimal metadata, fallback path) ───────────────
  fetchVideoInfo: async (url: string) => {
    const cobaltResp = await cobaltFetchDirect({ url, videoQuality: '1080' });

    if (cobaltResp.status === 'error') {
      throw new Error(
        cobaltResp.error?.code === 'error.api.content.unavailable'
          ? 'This URL is not supported by Cobalt. Try the desktop app for 1000+ sites.'
          : `Could not fetch video info: ${cobaltResp.error?.code || 'unknown error'}`,
      );
    }

    const downloadUrl = cobaltResp.url || cobaltResp.picker?.[0]?.url || url;
    const thumbnail = cobaltResp.picker?.[0]?.thumb || '';

    return {
      success: true,
      data: {
        url,
        extractedUrl: downloadUrl,
        title: cobaltResp.filename || 'Video',
        thumbnail,
        duration: 0,
        uploader: '',
        extractionMethod: 'cobalt',
        formats: [
          { formatId: 'best-video', label: 'Best Video (1080p)', quality: '1080p', ext: 'mp4', filesize: null, height: 1080 },
          { formatId: 'best-720', label: 'Standard Quality (720p)', quality: '720p', ext: 'mp4', filesize: null, height: 720 },
          { formatId: 'audio-only', label: 'Audio Only (MP3)', quality: 'audio', ext: 'mp3', filesize: null, height: null },
        ],
      },
      meta: { playlistDetected: false, detectPlaylistsEnabled: false, collapsedToSingle: false },
    };
  },

  // ── Cobalt download (triggers browser download via redirect URL) ──────
  startDownload: async (options: {
    url: string;
    filename: string;
    formatId?: string;
  }) => {
    const { url, filename, formatId = 'best-video' } = options;
    const isAudioOnly = formatId === 'audio-only' || formatId === 'bestaudio';
    const videoQuality = isAudioOnly ? '720' : '1080';

    const cobaltResp = await cobaltFetchDirect({
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

  // ── Settings (localStorage) ───────────────────────────────────────────
  getSettings: async () => {
    const s = loadSettings();
    return {
      theme: (s.theme as string) || 'dark',
      download_path: (s.downloadPath as string) || '',
      downloadPath: (s.downloadPath as string) || '',
      default_quality: (s.defaultQuality as string) || 'best',
      default_format: (s.defaultFormat as string) || 'mp4',
      eula_age_acknowledged: 1,
    };
  },
  saveSettings: async (updates: Record<string, unknown>) => {
    saveSettingsToStorage(updates);
    return { success: true };
  },

  // ── Open external link ────────────────────────────────────────────────
  openExternal: (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  },

  // ── Stubs for Electron-only methods (no-op in web) ────────────────────
  cancelDownload: async () => ({ success: true }),
  deleteDownload: async () => ({ success: true }),
  restartDownload: async () => ({ success: true }),
  pauseDownload: async () => ({ success: true }),
  resumeDownload: async () => ({ success: true }),
  getDownloadHistory: async () => [] as unknown[],
  clearHistory: async () => ({ success: true }),
  resetSettings: async () => { localStorage.removeItem(SETTINGS_KEY); return { success: true }; },
  getDefaultDownloadPath: async () => '',
  chooseSaveFolder: async () => null,
  chooseCookiesFile: async () => null,
  openFolder: async () => ({ success: true }),
  checkDiskSpace: async () => ({ isEnough: true, available: Infinity, required: 0 }),
  getAppVersion: async () => ({ version: 'web' }),
  getYtDlpVersion: async () => ({ version: 'cobalt', updateAvailable: false }),
  getUpdateInfo: async () => ({ needsUpdate: false, installedVersion: 'web', latestVersion: 'web' }),
  checkAllBinaryUpdates: async () => [] as unknown[],
  checkBinaryUpdates: async () => [] as unknown[],
  updateBinary: async () => ({ success: false }),
  updateBinaries: async () => ({ success: true }),
  updateYtDlp: async () => ({ success: false, message: 'Not applicable in web mode' }),
  checkForUpdates: async () => {},
  addPlaylistToQueue: async () => ({ addedCount: 0 }),
  removeProgressListener: () => {},
  onDownloadProgress: () => () => {},
  onYtDlpVersionInfo: () => () => {},
  onYtDlpUpdateAvailable: () => () => {},
  onPlaylistDetected: () => () => {},
  onPlaylistVideoDetected: () => () => {},
  onPlaylistDetectionComplete: () => () => {},
  onFFmpegDownloadProgress: () => () => {},
  onFFmpegDownloadNotification: () => () => {},
  onNavigateToTab: () => () => {},
  onSettingsUpdated: () => () => {},
  onDownloadsCleared: () => () => {},
};

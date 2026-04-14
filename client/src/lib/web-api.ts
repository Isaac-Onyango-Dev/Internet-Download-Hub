/**
 * Web-mode stubs and utilities.
 *
 * Note: The primary web download flow uses api.ts which routes
 * through the server's yt-dlp endpoint for all sites.
 * This file provides Electron-API-compatible stubs for web mode.
 */

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
// Provides Electron-API-compatible stubs for web mode.
// Primary download path is through api.ts → server yt-dlp endpoint.

export const webAPI = {
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

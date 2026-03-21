import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  // ── Video Info ──────────────────────────────────────────────────────────
  fetchVideoInfo: (url: string) =>
    ipcRenderer.invoke('fetch-video-info', url),

  // ── Downloads ────────────────────────────────────────────────────────────
  startDownload: (options: {
    url: string;
    filename: string;
    formatId?: string;
    savePath?: string;
    thumbnail?: string;
    duration?: number;
    uploader?: string;
  }) => ipcRenderer.invoke('start-download', options),

  cancelDownload: (id: number) =>
    ipcRenderer.invoke('cancel-download', id),

  deleteDownload: (id: number) =>
    ipcRenderer.invoke('delete-download', id),

  restartDownload: (id: number) =>
    ipcRenderer.invoke('restart-download', id),

  pauseDownload: (id: number) =>
    ipcRenderer.invoke('pause-download', id),

  resumeDownload: (id: number) =>
    ipcRenderer.invoke('resume-download', id),

  // ── Progress Events ───────────────────────────────────────────────────────
  removeProgressListener: () => {
    ipcRenderer.removeAllListeners('download-progress');
  },

  onDownloadProgress: (callback: (data: any) => void) => {
    ipcRenderer.removeAllListeners('download-progress');
    ipcRenderer.on('download-progress', (_event, data) => {
      callback(data);
    });
  },

  // ── File System ───────────────────────────────────────────────────────────
  chooseSaveFolder: () =>
    ipcRenderer.invoke('choose-save-folder'),

  chooseCookiesFile: () =>
    ipcRenderer.invoke('choose-cookies-file'),

  openFilePath: (filePath: string) =>
    ipcRenderer.invoke('open-file-path', filePath),

  openFolder: (filePath: string) =>
    ipcRenderer.invoke('open-folder', filePath),
  
  openExternal: (url: string) =>
    ipcRenderer.invoke('open-external', url),

  checkDiskSpace: (path: string, requiredBytes: number) =>
    ipcRenderer.invoke('check-disk-space', { path, requiredBytes }),

  // ── History ───────────────────────────────────────────────────────────────
  getDownloadHistory: () =>
    ipcRenderer.invoke('get-download-history'),

  clearHistory: () =>
    ipcRenderer.invoke('clear-history'),

  // ── Settings ──────────────────────────────────────────────────────────────
  getSettings: () =>
    ipcRenderer.invoke('get-settings'),

  saveSettings: (settings: any) =>
    ipcRenderer.invoke('save-settings', settings),

  resetSettings: () =>
    ipcRenderer.invoke('reset-settings'),

  // ── System ────────────────────────────────────────────────────────────────
  getDefaultDownloadPath: () =>
    ipcRenderer.invoke('get-default-download-path'),

  getAppVersion: () =>
    ipcRenderer.invoke('get-app-version'),

  updateYtDlp: () =>
    ipcRenderer.invoke('update-ytdlp'),

  getYtDlpVersion: () =>
    ipcRenderer.invoke('get-ytdlp-version'),

  onYtDlpVersionInfo: (callback: (data: any) => void) => {
    ipcRenderer.removeAllListeners('ytdlp-version-info');
    ipcRenderer.on('ytdlp-version-info', (_event, data) => callback(data));
  },

  onYtDlpUpdateAvailable: (callback: (data: any) => void) => {
    ipcRenderer.removeAllListeners('ytdlp-update-available');
    ipcRenderer.on('ytdlp-update-available', (_event, data) => callback(data));
  },

  // ── Playlist Detection ─────────────────────────────────────────────────────
  onPlaylistDetected: (callback: (data: any) => void) => {
    ipcRenderer.removeAllListeners('playlist-detected');
    ipcRenderer.on('playlist-detected', (_event, data) => callback(data));
  },

  addPlaylistToQueue: (entries: Array<{
    url: string;
    title: string;
    thumbnail?: string;
    index: number;
  }>, options: {
    savePath?: string;
    createFolder?: boolean;
    playlistTitle?: string;
  }) => ipcRenderer.invoke('add-playlist-to-queue', { entries, options }),
})

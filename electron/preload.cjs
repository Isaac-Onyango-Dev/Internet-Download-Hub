"use strict";

// electron/preload.ts
var import_electron = require("electron");
import_electron.contextBridge.exposeInMainWorld("electronAPI", {
  // ── Video Info ──────────────────────────────────────────────────────────
  fetchVideoInfo: (url) => import_electron.ipcRenderer.invoke("fetch-video-info", url),
  // ── Downloads ────────────────────────────────────────────────────────────
  startDownload: (options) => import_electron.ipcRenderer.invoke("start-download", options),
  cancelDownload: (id) => import_electron.ipcRenderer.invoke("cancel-download", id),
  deleteDownload: (id) => import_electron.ipcRenderer.invoke("delete-download", id),
  restartDownload: (id) => import_electron.ipcRenderer.invoke("restart-download", id),
  pauseDownload: (id) => import_electron.ipcRenderer.invoke("pause-download", id),
  resumeDownload: (id) => import_electron.ipcRenderer.invoke("resume-download", id),
  // ── Progress Events ───────────────────────────────────────────────────────
  removeProgressListener: () => {
    import_electron.ipcRenderer.removeAllListeners("download-progress");
  },
  onDownloadProgress: (callback) => {
    import_electron.ipcRenderer.removeAllListeners("download-progress");
    import_electron.ipcRenderer.on("download-progress", (_event, data) => {
      callback(data);
    });
  },
  // ── File System ───────────────────────────────────────────────────────────
  chooseSaveFolder: () => import_electron.ipcRenderer.invoke("choose-save-folder"),
  chooseCookiesFile: () => import_electron.ipcRenderer.invoke("choose-cookies-file"),
  openFilePath: (filePath) => import_electron.ipcRenderer.invoke("open-file-path", filePath),
  openFolder: (filePath) => import_electron.ipcRenderer.invoke("open-folder", filePath),
  openExternal: (url) => import_electron.ipcRenderer.invoke("open-external", url),
  checkDiskSpace: (path, requiredBytes) => import_electron.ipcRenderer.invoke("check-disk-space", { path, requiredBytes }),
  // ── History ───────────────────────────────────────────────────────────────
  getDownloadHistory: () => import_electron.ipcRenderer.invoke("get-download-history"),
  clearHistory: (type = "all") => import_electron.ipcRenderer.invoke("clear-history", type),
  // ── Settings ──────────────────────────────────────────────────────────────
  getSettings: () => import_electron.ipcRenderer.invoke("get-settings"),
  saveSettings: (settings) => import_electron.ipcRenderer.invoke("save-settings", settings),
  resetSettings: () => import_electron.ipcRenderer.invoke("reset-settings"),
  // ── System ────────────────────────────────────────────────────────────────
  getDefaultDownloadPath: () => import_electron.ipcRenderer.invoke("get-default-download-path"),
  getAppVersion: () => import_electron.ipcRenderer.invoke("get-app-version"),
  updateYtDlp: () => import_electron.ipcRenderer.invoke("update-ytdlp"),
  getYtDlpVersion: () => import_electron.ipcRenderer.invoke("get-ytdlp-version"),
  checkAllBinaryUpdates: () => import_electron.ipcRenderer.invoke("check-all-binary-updates"),
  updateBinary: (binaryName) => import_electron.ipcRenderer.invoke("update-binary", { binaryName }),
  onYtDlpVersionInfo: (callback) => {
    import_electron.ipcRenderer.removeAllListeners("ytdlp-version-info");
    import_electron.ipcRenderer.on("ytdlp-version-info", (_event, data) => callback(data));
  },
  onYtDlpUpdateAvailable: (callback) => {
    import_electron.ipcRenderer.removeAllListeners("ytdlp-update-available");
    import_electron.ipcRenderer.on("ytdlp-update-available", (_event, data) => callback(data));
  },
  // ── Playlist Detection ─────────────────────────────────────────────────────
  onPlaylistDetected: (callback) => {
    import_electron.ipcRenderer.removeAllListeners("playlist-detected");
    import_electron.ipcRenderer.on("playlist-detected", (_event, data) => callback(data));
  },
  addPlaylistToQueue: (entries, options) => import_electron.ipcRenderer.invoke("add-playlist-to-queue", { entries, options }),
  // ── FFmpeg Download Events ─────────────────────────────────────────────
  onFFmpegDownloadProgress: (callback) => {
    import_electron.ipcRenderer.removeAllListeners("ffmpeg-download-progress");
    import_electron.ipcRenderer.on("ffmpeg-download-progress", (_event, data) => callback(data));
  },
  onFFmpegDownloadNotification: (callback) => {
    import_electron.ipcRenderer.removeAllListeners("ffmpeg-download-notification");
    import_electron.ipcRenderer.on("ffmpeg-download-notification", (_event, data) => callback(data));
  }
});

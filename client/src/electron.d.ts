/* eslint-disable @typescript-eslint/no-explicit-any */
export {};

export interface BinaryUpdateInfo {
  name: string;
  installedVersion: string;
  latestVersion: string;
  needsUpdate: boolean;
  downloadUrl: string;
}

export interface YtDlpVersionInfo {
  currentVersion: string;
  latestVersion: string;
  upToDate: boolean;
  updateAvailable: boolean;
}

export interface PlaylistEntry {
  url: string;
  title: string;
  thumbnail?: string;
  index: number;
}

export interface PlaylistOptions {
  savePath?: string;
  createFolder?: boolean;
  playlistTitle?: string;
}

export interface FFmpegDownloadProgress {
  phase: 'downloading' | 'completed' | 'error';
  percent: number;
  error?: string;
}

export interface FFmpegDownloadNotification {
  title: string;
  body: string;
  type: 'info' | 'success' | 'error';
}

declare global {
  interface Window {
    electronAPI: {
      // Video Info
      fetchVideoInfo: (
        url: string,
      ) => Promise<{ success: boolean; data?: any; error?: string; meta?: any }>;

      // Downloads
      startDownload: (options: {
        url: string;
        filename: string;
        formatId?: string;
        savePath?: string;
        thumbnail?: string;
        duration?: number;
        uploader?: string;
      }) => Promise<{ id: number }>;
      cancelDownload: (id: number) => Promise<{ success: boolean }>;
      deleteDownload: (id: number) => Promise<{ success: boolean }>;
      restartDownload: (id: number) => Promise<{ id: number }>;
      pauseDownload: (id: number) => Promise<{ success: boolean }>;
      resumeDownload: (id: number) => Promise<{ id: number }>;

      // Progress Events
      removeProgressListener: () => void;
      onDownloadProgress: (callback: (data: any) => void) => void;

      // File System
      chooseSaveFolder: () => Promise<string | null>;
      chooseCookiesFile: () => Promise<string | null>;
      openFilePath: (filePath: string) => Promise<{ success: boolean }>;
      openFolder: (filePath: string) => Promise<{ success: boolean }>;
      openExternal: (url: string) => Promise<{ success: boolean; error?: string }>;
      checkDiskSpace: (
        path: string,
        requiredBytes: number,
      ) => Promise<{
        isEnough: boolean;
        freeSpace: number;
        required: number;
      }>;

      // History
      getDownloadHistory: () => Promise<any[]>;
      clearHistory: (type?: 'all' | 'completed' | 'failed') => Promise<{ success: boolean }>;

      // Settings
      getSettings: () => Promise<any>;
      saveSettings: (settings: any) => Promise<any>;
      resetSettings: () => Promise<any>;

      // System
      getDefaultDownloadPath: () => Promise<string>;
      getAppVersion: () => Promise<{ version: string }>;

      // yt-dlp update
      updateYtDlp: () => Promise<{ updated: boolean; version: string }>;
      getYtDlpVersion: () => Promise<string>;
      checkAllBinaryUpdates: () => Promise<BinaryUpdateInfo[]>;
      updateBinary: (binaryName: string) => Promise<{ success: boolean; newVersion: string }>;
      onYtDlpVersionInfo: (callback: (data: YtDlpVersionInfo) => void) => void;
      onYtDlpUpdateAvailable: (
        callback: (data: { currentVersion: string; latestVersion: string }) => void,
      ) => void;
      onPlaylistDetected: (
        callback: (data: { title: string; count: number; entries: PlaylistEntry[]; streaming?: boolean }) => void,
      ) => void;
      onPlaylistVideoDetected: (
        callback: (data: { video: any; index: number; total: number }) => void,
      ) => void;
      onPlaylistDetectionComplete: (
        callback: (data: { title: string; count: number }) => void,
      ) => void;
      addPlaylistToQueue: (
        entries: any[],
        options: PlaylistOptions,
      ) => Promise<{ success: boolean; addedCount: number }>;

      // FFmpeg Download Events
      onFFmpegDownloadProgress: (callback: (data: FFmpegDownloadProgress) => void) => void;
      onFFmpegDownloadNotification: (callback: (data: FFmpegDownloadNotification) => void) => void;

      // Menu-driven Events
      onNavigateToTab: (callback: (tabPath: string) => void) => void;
      onSettingsUpdated: (callback: () => void) => void;
      onDownloadsCleared: (callback: () => void) => void;
    };
  }
}

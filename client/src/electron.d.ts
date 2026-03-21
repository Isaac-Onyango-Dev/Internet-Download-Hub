export {}

declare global {
  interface Window {
    electronAPI: {
      // Video Info
      fetchVideoInfo: (url: string) => Promise<{ success: boolean; data?: any; error?: string }>

      // Downloads
      startDownload: (options: {
        url: string;
        filename: string;
        formatId?: string;
        savePath?: string;
        thumbnail?: string;
        duration?: number;
        uploader?: string;
      }) => Promise<{ id: number }>
      cancelDownload: (id: number) => Promise<{ success: boolean }>
      deleteDownload: (id: number) => Promise<{ success: boolean }>
      restartDownload: (id: number) => Promise<{ id: number }>
      pauseDownload: (id: number) => Promise<{ success: boolean }>
      resumeDownload: (id: number) => Promise<{ id: number }>

      // Progress Events
      removeProgressListener: () => void
      onDownloadProgress: (callback: (data: any) => void) => void

      // File System
      chooseSaveFolder: () => Promise<string | null>
      chooseCookiesFile: () => Promise<string | null>
      openFilePath: (filePath: string) => Promise<{ success: boolean }>
      openFolder: (filePath: string) => Promise<{ success: boolean }>
  
  openExternal: (url: string) => Promise<{ success: boolean; error?: string }>
      checkDiskSpace: (path: string, requiredBytes: number) => Promise<{
        isEnough: boolean;
        freeSpace: number;
        required: number;
      }>

      // History
      getDownloadHistory: () => Promise<any[]>
      clearHistory: () => Promise<{ success: boolean }>

      // Settings
      getSettings: () => Promise<any>
      saveSettings: (settings: any) => Promise<any>
      resetSettings: () => Promise<any>

      // System
      getDefaultDownloadPath: () => Promise<string>
      getAppVersion: () => Promise<{ version: string }>

      // yt-dlp update
      updateYtDlp: () => Promise<{ updated: boolean; version: string }>
      getYtDlpVersion: () => Promise<string>
      onYtDlpVersionInfo: (callback: (data: {
        currentVersion: string;
        latestVersion: string;
        upToDate: boolean;
        updateAvailable: boolean;
      }) => void) => void
      onYtDlpUpdateAvailable: (callback: (data: {
        currentVersion: string;
        latestVersion: string;
      }) => void) => void
    }
  }
}

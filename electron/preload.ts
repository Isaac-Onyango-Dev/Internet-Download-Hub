// ============================================================================
// PRELOAD SCRIPT - IPC BRIDGE
// ============================================================================
// This script runs in the renderer process and provides a secure bridge
// between the frontend (React app) and the main Electron process.
//
// Security: Uses contextBridge to safely expose specific APIs to the renderer
// without giving it direct access to Node.js or Electron modules.
//
// All communication happens through IPC (Inter-Process Communication) channels
// defined in main.ts. This file defines the frontend-facing API.
// ============================================================================

import { contextBridge, ipcRenderer } from 'electron';

// Expose a secure API to the renderer process
// This creates window.electronAPI that the React app can use
contextBridge.exposeInMainWorld('electronAPI', {
  // ============================================================================
  // VIDEO INFORMATION EXTRACTION
  // ============================================================================

  /**
   * Fetches metadata for a video URL (title, duration, formats, etc.)
   * @param url - Video URL to analyze
   * @returns Promise with video metadata
   */
  fetchVideoInfo: (url: string) => ipcRenderer.invoke('fetch-video-info', url),

  // ============================================================================
  // DOWNLOAD MANAGEMENT
  // ============================================================================

  /**
   * Starts a new download with the specified options
   * @param options - Download configuration including URL, filename, format, etc.
   * @returns Promise with download ID
   */
  startDownload: (options: {
    url: string; // Video URL to download
    filename: string; // Output filename
    formatId?: string; // Video format (e.g., 'bestvideo+bestaudio')
    savePath?: string; // Where to save the file
    thumbnail?: string; // Video thumbnail URL
    duration?: number; // Video duration in seconds
    uploader?: string; // Video uploader/channel name
  }) => ipcRenderer.invoke('start-download', options),

  /**
   * Cancels an active download and cleans up files
   * @param id - Download ID to cancel
   */
  cancelDownload: (id: number) => ipcRenderer.invoke('cancel-download', id),

  /**
   * Deletes a download from history and removes the file
   * @param id - Download ID to delete
   */
  deleteDownload: (id: number) => ipcRenderer.invoke('delete-download', id),

  /**
   * Restarts a failed or cancelled download
   * @param id - Download ID to restart
   */
  restartDownload: (id: number) => ipcRenderer.invoke('restart-download', id),

  /**
   * Pauses an active download
   * @param id - Download ID to pause
   */
  pauseDownload: (id: number) => ipcRenderer.invoke('pause-download', id),

  /**
   * Resumes a paused download
   * @param id - Download ID to resume
   */
  resumeDownload: (id: number) => ipcRenderer.invoke('resume-download', id),

  // ============================================================================
  // REAL-TIME EVENTS AND NOTIFICATIONS
  // ============================================================================

  /**
   * Removes all download progress event listeners
   * Useful when unmounting components to prevent memory leaks
   */
  removeProgressListener: () => {
    ipcRenderer.removeAllListeners('download-progress');
  },

  /**
   * Listens for real-time download progress updates
   * @param callback - Function to handle progress data
   */
  onDownloadProgress: (callback: (data: any) => void) => {
    ipcRenderer.removeAllListeners('download-progress');
    ipcRenderer.on('download-progress', (_event, data) => {
      callback(data);
    });
  },

  // ============================================================================
  // FILE SYSTEM OPERATIONS
  // ============================================================================

  /**
   * Opens a folder selection dialog for choosing save location
   * @returns Promise with selected folder path or null if cancelled
   */
  chooseSaveFolder: () => ipcRenderer.invoke('choose-save-folder'),

  /**
   * Opens a file selection dialog for choosing browser cookies file
   * Used for accessing age-restricted or private content
   * @returns Promise with selected file path or null if cancelled
   */
  chooseCookiesFile: () => ipcRenderer.invoke('choose-cookies-file'),

  /**
   * Opens a file using the system default application
   * @param filePath - Path to the file to open
   */
  openFilePath: (filePath: string) => ipcRenderer.invoke('open-file-path', filePath),

  /**
   * Opens a folder in the system file explorer
   * @param filePath - Path to the folder to open
   */
  openFolder: (filePath: string) => ipcRenderer.invoke('open-folder', filePath),

  /**
   * Opens a URL in the system default browser
   * Only allows whitelisted domains for security
   * @param url - URL to open
   */
  openExternal: (url: string) => ipcRenderer.invoke('open-external', url),

  /**
   * Checks available disk space for a given path
   * @param path - Path to check disk space for
   * @param requiredBytes - Estimated bytes needed for download
   * @returns Promise with disk space information
   */
  checkDiskSpace: (path: string, requiredBytes: number) =>
    ipcRenderer.invoke('check-disk-space', { path, requiredBytes }),

  // ============================================================================
  // DOWNLOAD HISTORY MANAGEMENT
  // ============================================================================

  /**
   * Retrieves the complete download history from the database
   * @returns Promise with array of download records
   */
  getDownloadHistory: () => ipcRenderer.invoke('get-download-history'),

  /**
   * Clears download history based on completion status
   * @param type - What to clear: 'all', 'completed', or 'failed'
   * @returns Promise when operation completes
   */
  clearHistory: (type: 'all' | 'completed' | 'failed' = 'all') =>
    ipcRenderer.invoke('clear-history', type),

  // ============================================================================
  // APPLICATION SETTINGS
  // ============================================================================

  /**
   * Retrieves current application settings from database
   * @returns Promise with settings object
   */
  getSettings: () => ipcRenderer.invoke('get-settings'),

  /**
   * Saves application settings to database
   * @param settings - Settings object to save
   * @returns Promise when save completes
   */
  saveSettings: (settings: any) => ipcRenderer.invoke('save-settings', settings),

  /**
   * Resets all settings to their default values
   * @returns Promise when reset completes
   */
  resetSettings: () => ipcRenderer.invoke('reset-settings'),

  // ============================================================================
  // SYSTEM INFORMATION AND UPDATES
  // ============================================================================

  /**
   * Gets the system's default download directory
   * @returns Promise with default download path
   */
  getDefaultDownloadPath: () => ipcRenderer.invoke('get-default-download-path'),

  /**
   * Gets the current application version
   * @returns Promise with version string
   */
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),

  /**
   * Updates yt-dlp to the latest version
   * @returns Promise with update result
   */
  updateYtDlp: () => ipcRenderer.invoke('update-ytdlp'),

  /**
   * Gets the current yt-dlp version
   * @returns Promise with version information
   */
  getYtDlpVersion: () => ipcRenderer.invoke('get-ytdlp-version'),

  /**
   * Checks for updates to all binary tools
   * @returns Promise with update information for all tools
   */
  checkAllBinaryUpdates: () => ipcRenderer.invoke('check-all-binary-updates'),

  /**
   * Updates a specific binary tool
   * @param binaryName - Name of the binary to update
   * @returns Promise with update result
   */
  updateBinary: (binaryName: string) => ipcRenderer.invoke('update-binary', { binaryName }),

  /**
   * Listens for yt-dlp version check results
   * @param callback - Function to handle version info
   */
  onYtDlpVersionInfo: (callback: (data: any) => void) => {
    ipcRenderer.removeAllListeners('ytdlp-version-info');
    ipcRenderer.on('ytdlp-version-info', (_event, data) => callback(data));
  },

  /**
   * Listens for yt-dlp update availability notifications
   * @param callback - Function to handle update notifications
   */
  onYtDlpUpdateAvailable: (callback: (data: any) => void) => {
    ipcRenderer.removeAllListeners('ytdlp-update-available');
    ipcRenderer.on('ytdlp-update-available', (_event, data) => callback(data));
  },

  // ============================================================================
  // PLAYLIST DETECTION AND MANAGEMENT
  // ============================================================================

  /**
   * Listens for playlist detection events
   * When a user pastes a playlist URL, this event fires with playlist info
   * @param callback - Function to handle playlist detection data
   */
  onPlaylistDetected: (callback: (data: any) => void) => {
    ipcRenderer.removeAllListeners('playlist-detected');
    ipcRenderer.on('playlist-detected', (_event, data) => callback(data));
  },

  /**
   * Adds multiple videos from a playlist to the download queue
   * @param entries - Array of playlist entries with URLs and metadata
   * @param options - Playlist download options (save path, folder creation, etc.)
   * @returns Promise with result (added count, skipped count)
   */
  addPlaylistToQueue: (
    entries: Array<{
      url: string; // Video URL
      title: string; // Video title
      thumbnail?: string; // Video thumbnail URL
      index: number; // Position in playlist
    }>,
    options: {
      savePath?: string; // Where to save the playlist
      createFolder?: boolean; // Whether to create a playlist folder
      playlistTitle?: string; // Playlist name for folder creation
    },
  ) => ipcRenderer.invoke('add-playlist-to-queue', { entries, options }),

  // ============================================================================
  // FFMPEG DOWNLOAD NOTIFICATIONS
  // ============================================================================
  // These events handle the on-demand FFmpeg download system

  /**
   * Listens for FFmpeg download progress updates
   * Shows progress when FFmpeg is being downloaded automatically
   * @param callback - Function to handle progress data
   */
  onFFmpegDownloadProgress: (callback: (data: any) => void) => {
    ipcRenderer.removeAllListeners('ffmpeg-download-progress');
    ipcRenderer.on('ffmpeg-download-progress', (_event, data) => callback(data));
  },

  /**
   * Listens for FFmpeg download notifications (completion, errors, etc.)
   * @param callback - Function to handle notification data
   */
  onFFmpegDownloadNotification: (callback: (data: any) => void) => {
    ipcRenderer.removeAllListeners('ffmpeg-download-notification');
    ipcRenderer.on('ffmpeg-download-notification', (_event, data) => callback(data));
  },
});

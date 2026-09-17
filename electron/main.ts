// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
// ============================================================================
// INTERNET DOWNLOAD HUB - MAIN PROCESS
// ============================================================================
// This is the main Electron process that handles:
// - Application lifecycle and window management
// - Download queue management and execution
// - IPC (Inter-Process Communication) with the renderer process
// - System tray integration
// - Database operations for download history
// - Binary tool management (yt-dlp, ffmpeg, etc.)
// ============================================================================

// Import core Electron modules for desktop app functionality
import log from 'electron-log'; // Logging utility
import { autoUpdater } from 'electron-updater'; // In-place app updates from GitHub Releases
import {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  shell,
  Tray,
  Menu,
  nativeImage,
  powerSaveBlocker,
  Notification,
  clipboard,
} from 'electron';
import path from 'path'; // File path utilities
import crypto from 'crypto'; // Checksum verification for downloaded files
import semver from 'semver'; // Version comparison that understands pre-releases
import { spawn, execSync, execFile, execFileSync, ChildProcess } from 'child_process'; // Process spawning for downloads
import execa from 'execa'; // Better process execution
import { extractVideoInfo, streamPlaylistInfo } from './extractor'; // Video metadata extraction
import { analyseUrl, type Engine } from './url-analyser'; // Engine order shared by extraction and download
import { parseEngineProgress, splitNm3u8dlOutput } from './engine-progress'; // streamlink and N_m3u8DL-RE output
import fs from 'fs'; // File system operations
import os from 'os'; // Operating system utilities
import https from 'https'; // HTTP requests for FFmpeg download
import { fileURLToPath } from 'url'; // Matching the renderer's own page in will-navigate
import { pipeline } from 'stream/promises'; // Streams that reject when either side fails
import { promisify } from 'util'; // Utility for promise conversion
import initSqlJs from 'sql.js'; // In-memory database
import { translateDownloadError, isLikelyYoutubeAgeRestrictionError, isEngineErrorLine } from './errors'; // Error handling
import {
  ytDlpCommonArgs,
  ytDlpCookiesArgs,
  isYouTubeUrl,
  type YoutubePlayerClient,
} from './ytdlp-args'; // yt-dlp configuration

// ============================================================================
// LOGGING CONFIGURATION
// ============================================================================
// Configure electron-log for debugging and error tracking
log.transports.file.level = 'debug'; // Log everything to file
log.catchErrors(); // Catch unhandled exceptions

try {
  const fileTransport = log.transports.file as { getFile?: () => { path?: string } };
  const p = fileTransport.getFile?.()?.path;
  log.info('[Main] electron-log file path:', p ?? '(default location)');
} catch {
  log.info('[Main] electron-log initialized');
}

// ============================================================================
// DOWNLOAD ENGINES
// ============================================================================

/** True for a chosen quality or audio-only, which only yt-dlp can honour. */
function isSpecificFormat(formatId?: string | null): boolean {
  return !!formatId && formatId !== 'bestvideo+bestaudio' && formatId !== 'best';
}

/** Engines that can download `url`, in the same order extraction tries them, skipping missing binaries. */
function downloadEnginesFor(url: string, formatId?: string | null): { engine: Engine; binary: string }[] {
  const binaries: Partial<Record<Engine, string>> = {
    'yt-dlp': ytDlpPath,
    streamlink: streamlinkPath,
    'gallery-dl': galleryDlPath,
    'n-m3u8dl': n_m3u8dlPath,
  };
  let order: Engine[];
  try { order = analyseUrl(url).engineOrder; } catch { order = ['yt-dlp']; }
  // The others always fetch the best they can, so a chosen quality starts with yt-dlp.
  if (isSpecificFormat(formatId)) order = ['yt-dlp', ...order.filter((e) => e !== 'yt-dlp')];
  // playwright only finds the stream URL during extraction; it never downloads.
  return order
    .filter((e) => binaries[e] && fs.existsSync(binaries[e]!))
    .map((e) => ({ engine: e, binary: binaries[e]! }));
}

/** Per-download scratch folder for partial files, next to the output so the final move is a rename. */
function jobTempDir(saveFolder: string, downloadId: number): string {
  return path.join(saveFolder, '.idh-temp', String(downloadId));
}

/**
 * Deletes a download's scratch folder, then the shared parent if nothing else uses it.
 * Only ever touches .idh-temp, so a user's own files next to the download are safe.
 */
function removeJobTempDir(saveFolder: string, downloadId: number) {
  const dir = jobTempDir(saveFolder, downloadId);
  try {
    // Retries cover a just-killed engine that has not released its handles yet.
    fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    fs.rmdirSync(path.dirname(dir)); // throws while other downloads still use it
  } catch (err: any) {
    if (err?.code !== 'ENOTEMPTY' && err?.code !== 'ENOENT') log.warn(`[Cleanup] ${dir}: ${err?.message}`);
  }
}

/** `file`, or `file (2)`, `file (3)`… so an engine never overwrites an earlier recording. */
function uniquePath(file: string): string {
  const { dir, name, ext } = path.parse(file);
  let candidate = file;
  for (let n = 2; fs.existsSync(candidate); n++) candidate = path.join(dir, `${name} (${n})${ext}`);
  return candidate;
}

// ============================================================================
// GLOBAL STATE VARIABLES
// ============================================================================

// Database file path for storing download history and settings
let DB_PATH: string;

// Flag to indicate we're running in Electron environment
process.env.VITE_ELECTRON = 'true';

// Main application window and system tray references
let mainWindow: any = null; // Primary browser window
let tray: any = null; // System tray icon
let db: any; // SQL.js database instance

// Active download tasks management
// Maps download ID to process information for tracking and control
const activeTasks = new Map<
  number,
  {
    process: ChildProcess; // The actual download process
    engine: Engine; // Which binary it is, so that binary is not replaced mid-download
    recording: string | null; // File streamlink writes directly, discarded on cancel
  }
>();

// Track why tasks were stopped (for proper UI state management)
const taskStopReasons = new Map<number, 'paused' | 'cancelled'>();

// Power management: prevent sleep during downloads
let powerSaveBlockerId: number | null = null;

// UI behavior flag for close-to-tray functionality
const minimizeToTray = false; // toggled by close event (always on for now)

// Global promise lock for FFmpeg on-demand download to prevent race conditions
let ffmpegDownloadPromise: Promise<void> | null = null;

// ============================================================================
// ENVIRONMENT AND PATH CONFIGURATION
// ============================================================================

// Environment detection flags
let isDev: boolean; // True when running in development mode
let isTest: boolean; // True when running tests

// Binary tool paths (yt-dlp, ffmpeg, etc.)
let binariesPath: string; // Base path for all binary tools
let ytDlpPath: string; // Path to yt-dlp executable
let ffmpegPath: string; // Path to ffmpeg executable
let ffprobePath: string; // Path to ffprobe executable
let streamlinkPath: string; // Path to streamlink executable
let n_m3u8dlPath: string; // Path to N_m3u8DL-RE executable
let galleryDlPath: string; // Path to gallery-dl executable

// ============================================================================
// SINGLE INSTANCE MANAGEMENT
// ============================================================================
// Prevent multiple instances of the app from running simultaneously
// Only enforce single instance in production - allow multiple dev runs
// Initialize isDev here since it's used before setupPaths() is called
isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

/**
 * Sets up single instance lock to prevent multiple app instances
 * @returns {boolean} - True if app should continue, false if it should exit
 */
function initializeSingleInstanceLock(): boolean {
  if (!isDev) {
    // Production mode: enforce single instance
    const gotTheLock = app.requestSingleInstanceLock();
    if (!gotTheLock) {
      log.info('[Main] Another instance is running — focusing it and exiting');
      app.quit();
      return false; // Exit early
    }

    // Handle second instance attempt by focusing existing window
    app.on('second-instance', () => {
      if (mainWindow) {
        if (!mainWindow.isVisible()) mainWindow.show();
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
      }
    });
  } else {
    log.info('[Main] Development mode detected — single-instance lock disabled');
  }
  return true; // Continue with startup
}

// ============================================================================
// PATH CONFIGURATION AND BINARY MANAGEMENT
// ============================================================================

/**
 * Configures paths for binary tools based on environment (dev vs production)
 * In production: uses packaged resources, in dev: uses local binaries folder
 */
function setupPaths() {
  isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
  isTest = process.env.NODE_ENV === 'test';

  // Determine where to look for binaries based on environment
  const userDataBinariesPath = path.join(app.getPath('userData'), 'binaries');
  binariesPath = app.isPackaged
    ? path.join(process.resourcesPath, 'binaries') // Packaged app resources
    : path.join(process.cwd(), 'binaries'); // Development local files

  /**
   * Binary resolution helper: checks user data first, then packaged resources
   * This allows users to override bundled binaries with their own versions
   * @param {string} name - The binary filename
   * @returns {string} - Full path to the binary
   */
  const getBinaryPath = (name: string) => {
    const userPath = path.join(userDataBinariesPath, name);
    if (fs.existsSync(userPath)) {
      log.info(`[Main] Using ${name} from userData: ${userPath}`);
      return userPath;
    }
    const pkgPath = path.join(binariesPath, name);
    log.info(`[Main] Using ${name} from resources: ${pkgPath}`);
    return pkgPath;
  };

  ytDlpPath = getBinaryPath('yt-dlp.exe');
  ffmpegPath = getBinaryPath('ffmpeg.exe');
  ffprobePath = getBinaryPath('ffprobe.exe');
  streamlinkPath = getBinaryPath('streamlink/bin/streamlink.exe'); // launcher needs its sibling Python/ and pkgs/
  n_m3u8dlPath = getBinaryPath('N_m3u8DL-RE.exe');
  galleryDlPath = getBinaryPath('gallery-dl.exe');
}

// ============================================================================
// BINARY VERIFICATION SYSTEM
// ============================================================================

/**
 * Checks availability of all required binary tools on startup
 * Logs which tools are available and which are missing
 * This helps users understand why certain features might not work
 */
function checkBinaries() {
  setupPaths();

  // List of all required binary tools with their display names and paths
  const binaries = [
    { name: 'yt-dlp', path: ytDlpPath }, // Main video downloader
    { name: 'ffmpeg', path: ffmpegPath }, // Video/audio processing
    { name: 'ffprobe', path: ffprobePath }, // Media analysis
    { name: 'streamlink', path: streamlinkPath }, // Live streaming
    { name: 'N_m3u8DL-RE', path: n_m3u8dlPath }, // HLS/DASH streams
    { name: 'gallery-dl', path: galleryDlPath }, // Image galleries
  ];

  log.info('[MAIN] === BINARY VERIFICATION ===');
  log.info('[MAIN] Binaries path:', binariesPath);
  log.info('[MAIN] App packaged:', app.isPackaged);

  // Check each binary and report status
  let missingCount = 0;
  binaries.forEach(({ name, path }) => {
    if (fs.existsSync(path)) {
      log.info(`[BINARY OK] ${name}: ${path}`);
    } else {
      log.error(`[BINARY MISSING] ${name}: ${path}`);
      missingCount++;
    }
  });

  log.info('[MAIN] === END BINARY VERIFICATION ===');
  if (missingCount > 0) {
    log.warn(`[MAIN] ${missingCount} binaries missing. Some features may not work.`);
  }

  // Additional environment information for debugging
  log.info(`[Main] isDev: ${isDev}`);
  log.info(`[Main] isPackaged: ${app.isPackaged}`);
  log.info('[MAIN] Default save path:', app.getPath('downloads'));

  // User-friendly status display with emojis
  binaries.forEach((bin) => {
    if (fs.existsSync(bin.path)) {
      log.info(`✅ ${bin.name} found at: ${bin.path}`);
    } else {
      log.error(`❌ ${bin.name} MISSING at: ${bin.path}`);
    }
  });
  log.info('------------------------');
}

// ============================================================================
// FFMPEG ON-DEMAND DOWNLOAD SYSTEM
// ============================================================================
// FFmpeg is required for high-quality video merging and audio extraction
// To keep the app size small, we download it on-demand when first needed

/**
 * Checks if FFmpeg is available either in userData binaries or packaged resources
 * @returns {boolean} - True if FFmpeg executable exists
 */
function isFFmpegAvailable(): boolean {
  // Check if FFmpeg exists in userData binaries (user-installed)
  const userDataBinariesPath = path.join(app.getPath('userData'), 'binaries');
  const userFFmpegPath = path.join(userDataBinariesPath, 'ffmpeg.exe');

  // Check the bundled copy: packaged resources, or ./binaries in development
  const packagedFFmpegPath = path.join(binariesPath, 'ffmpeg.exe');

  const ffmpegAvailable = fs.existsSync(userFFmpegPath) || fs.existsSync(packagedFFmpegPath);
  log.info(
    `[Main] FFmpeg availability check - userData: ${fs.existsSync(userFFmpegPath)}, packaged: ${fs.existsSync(packagedFFmpegPath)}`,
  );

  return ffmpegAvailable;
}

async function downloadFFmpeg() {
  if (ffmpegDownloadPromise) return ffmpegDownloadPromise;

  ffmpegDownloadPromise = (async () => {
    const ffmpegDownloaded =
      getQuery(db, 'SELECT ffmpeg_downloaded FROM settings WHERE id = 1')?.ffmpeg_downloaded === 1;

    // Only the file on disk counts: the flag stays set after an antivirus quarantines
    // ffmpeg.exe, and trusting it left every queued download waiting forever.
    if (isFFmpegAvailable()) {
      log.info('[Main] FFmpeg is available, skipping download');
      if (!ffmpegDownloaded) {
        db.run('UPDATE settings SET ffmpeg_downloaded = 1 WHERE id = 1');
        saveDatabase(db);
      }
      return;
    }

    try {
      // Show one-time notification
      if (mainWindow) {
        mainWindow.webContents.send('ffmpeg-download-notification', {
          title: 'Downloading FFmpeg',
          body: 'FFmpeg is being downloaded (about 190 MB) for high-quality video merging. This only happens once.',
          type: 'info',
        });
      }

      const userDataBinariesPath = path.join(app.getPath('userData'), 'binaries');
      if (!fs.existsSync(userDataBinariesPath)) {
        fs.mkdirSync(userDataBinariesPath, { recursive: true });
      }

      const zipPath = path.join(userDataBinariesPath, 'ffmpeg.zip');
      const downloadUrl =
        'https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip';

      log.info(`[Main] Starting FFmpeg download from: ${downloadUrl}`);

      let lastPercent = -1;
      await downloadFileUnverified(downloadUrl, zipPath, (received, total) => {
        // Once per whole percent: a 190 MB body arrives in thousands of chunks.
        const percent = total > 0 ? Math.floor((received / total) * 100) : -1;
        if (percent === lastPercent) return;
        lastPercent = percent;
        mainWindow?.webContents.send('ffmpeg-download-progress', { phase: 'downloading', percent });
      });
      log.info('[Main] FFmpeg zip downloaded, extracting...');

      if (mainWindow) {
        mainWindow.webContents.send('ffmpeg-download-progress', {
          phase: 'extracting',
          percent: 50,
        });
      }

      const tempDir = path.join(userDataBinariesPath, 'temp_ffmpeg_extract');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      // Use PowerShell to extract zip on Windows. Paths go through the
      // environment, never into the command text — see PS_EXPAND_ARCHIVE.
      await promisify(execFile)('powershell', [...PS_FLAGS, '-Command', PS_EXPAND_ARCHIVE], {
        env: { ...process.env, IDH_ARCHIVE: zipPath, IDH_DEST: tempDir },
      });

      // Find ffmpeg.exe in extracted directory
      const findFfmpeg = (dir: string): string | null => {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          const fullPath = path.join(dir, file);
          if (fs.statSync(fullPath).isDirectory()) {
            const found = findFfmpeg(fullPath);
            if (found) return found;
          } else if (file === 'ffmpeg.exe') {
            return fullPath;
          }
        }
        return null;
      };

      const extractedFfmpegPath = findFfmpeg(tempDir);
      if (extractedFfmpegPath) {
        // Move ffmpeg.exe and ffprobe.exe to the base binaries folder
        const finalFfmpegPath = path.join(userDataBinariesPath, 'ffmpeg.exe');
        const ffprobeSource = extractedFfmpegPath.replace('ffmpeg.exe', 'ffprobe.exe');
        const finalFfprobePath = path.join(userDataBinariesPath, 'ffprobe.exe');

        fs.copyFileSync(extractedFfmpegPath, finalFfmpegPath);
        if (fs.existsSync(ffprobeSource)) {
          fs.copyFileSync(ffprobeSource, finalFfprobePath);
        }

        // Clean up: delete zip and extracted folder
        fs.unlinkSync(zipPath);
        fs.rmSync(tempDir, { recursive: true, force: true });

        db.run('UPDATE settings SET ffmpeg_downloaded = 1 WHERE id = 1');
        saveDatabase(db);
        setupPaths(); // Refresh global paths to point to the new binaries in userData
        log.info('[Main] FFmpeg installed successfully');
        // Downloads that were waiting for FFmpeg start now, not on the next queue event.
        setImmediate(processQueue);

        if (mainWindow) {
          mainWindow.webContents.send('ffmpeg-download-progress', {
            phase: 'completed',
            percent: 100,
          });
          mainWindow.webContents.send('ffmpeg-download-notification', {
            title: 'FFmpeg Ready',
            body: 'FFmpeg has been installed and is ready for high-quality downloads.',
            type: 'success',
          });
        }
      } else {
        throw new Error('ffmpeg.exe not found in extracted archive');
      }
    } catch (error: any) {
      log.error('[Main] FFmpeg download failed:', error);
      if (mainWindow) {
        mainWindow.webContents.send('ffmpeg-download-progress', {
          phase: 'error',
          percent: 0,
          error: error.message,
        });

        mainWindow.webContents.send('ffmpeg-download-notification', {
          title: 'FFmpeg Download Failed',
          body: `Failed to download FFmpeg: ${error.message}. Please try again later.`,
          type: 'error',
        });
      }
    } finally {
      ffmpegDownloadPromise = null;
    }
  })();

  return ffmpegDownloadPromise;
}

// Check if FFmpeg is needed for a download.
// Must mirror spawnDownload's formatArg branching exactly: every branch there
// either merges separate video+audio streams or requires audio extraction, so
// ffmpeg is required for every formatId, including the empty/default case
// (which becomes 'bestvideo+bestaudio/best').
function checkFFmpegRequired(_formatId?: string | null): boolean {
  return true;
}

// ── Filename Cleaning ────────────────────────────────────────────────────────
function cleanFilename(filename: string): string {
  return filename
    .replace(/_{2,}/g, ' ')
    .replace(/-{2,}/g, ' - ')
    .replace(/__+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/^\s+|\s+$/g, '')
    .replace(/[<>:"/\\|?*]/g, '');
}

// ── Power Save Blocker ────────────────────────────────────────────────────────
function updatePowerSave() {
  if (activeTasks.size > 0) {
    if (powerSaveBlockerId === null) {
      powerSaveBlockerId = powerSaveBlocker.start('prevent-app-suspension');
      log.info('[PowerSave] Blocking sleep — downloads active');
    }
  } else {
    if (powerSaveBlockerId !== null) {
      powerSaveBlocker.stop(powerSaveBlockerId);
      powerSaveBlockerId = null;
      log.info('[PowerSave] Allowing sleep — no active downloads');
    }
  }
}

// ── Taskbar Progress ──────────────────────────────────────────────────────────
function updateTaskbarProgress() {
  if (!mainWindow) return;
  if (activeTasks.size === 0) {
    mainWindow.setProgressBar(-1);
    return;
  }
  // We update per-download from the progress event; this is called after each update
  // to refresh the taskbar with an aggregate or current value
}

// ── Persistence Helpers ──────────────────────────────────────────────────────
function getDefaultSavePath(): string {
  if (!db) return app.getPath('downloads');
  const settings = getQuery(db, 'SELECT download_path FROM settings WHERE id = 1');
  if (settings && settings.download_path && fs.existsSync(settings.download_path)) {
    return settings.download_path;
  }
  return app.getPath('downloads');
}

function saveDatabase(database: any) {
  if (!database || !DB_PATH) return;
  const data = database.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

function getQuery(database: any, sql: string, params: any[] = []): any {
  const result = database.exec(sql, params);
  if (result.length === 0) return null;
  const { columns, values } = result[0];
  const obj: any = {};
  columns.forEach((col: string, i: number) => (obj[col] = values[0][i]));
  return obj;
}

function allQuery(database: any, sql: string, params: any[] = []): any[] {
  const result = database.exec(sql, params);
  if (result.length === 0) return [];
  const { columns, values } = result[0];
  return values.map((row: any[]) => {
    const obj: any = {};
    columns.forEach((col: string, i: number) => (obj[col] = row[i]));
    return obj;
  });
}

/** sql.js must load sql-wasm.wasm from a real path; default resolution breaks inside asar / packaged apps. */
function getSqlJsWasmDir(): string {
  const unpackedDist = path.join(
    process.resourcesPath,
    'app.asar.unpacked',
    'node_modules',
    'sql.js',
    'dist',
  );
  const insideAsar = path.join(app.getAppPath(), 'node_modules', 'sql.js', 'dist');
  const devCwd = path.join(process.cwd(), 'node_modules', 'sql.js', 'dist');
  const nextToMain = path.join(__dirname, '..', 'node_modules', 'sql.js', 'dist');

  const candidates = app.isPackaged
    ? [unpackedDist, insideAsar]
    : [devCwd, nextToMain, unpackedDist, insideAsar];

  for (const dir of candidates) {
    try {
      if (fs.existsSync(path.join(dir, 'sql-wasm.wasm'))) {
        log.info('[Main] sql.js WASM directory:', dir, app.isPackaged ? '(packaged)' : '(dev)');
        return dir;
      }
    } catch {
      /* continue */
    }
  }

  log.error('[Main] sql-wasm.wasm not found in candidates:', candidates);
  return candidates[0] ?? devCwd;
}

// ── Database initialization ──────────────────────────────────────────────────
async function initDb() {
  const wasmDir = getSqlJsWasmDir();
  const SQL = await initSqlJs({
    locateFile: (file: string) => path.join(wasmDir, file),
  });
  DB_PATH = path.join(app.getPath('userData'), 'downloads.db');
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  const defaultPath = app.getPath('downloads').replace(/\\/g, '/');

  db.exec(`
    CREATE TABLE IF NOT EXISTS downloads (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      url             TEXT    NOT NULL,
      filename        TEXT    NOT NULL,
      thumbnail       TEXT,
      duration        INTEGER,
      uploader        TEXT,
      mime_type       TEXT,
      total_bytes     INTEGER NOT NULL DEFAULT 0,
      received_bytes  INTEGER NOT NULL DEFAULT 0,
      format_id       TEXT,
      state           TEXT    NOT NULL DEFAULT 'queued',
      error           TEXT,
      save_path       TEXT,
      created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
      completed_at    TEXT,
      playlist_title   TEXT,
      playlist_index   INTEGER,
      playlist_total   INTEGER
    );

    CREATE TABLE IF NOT EXISTS settings (
      id                       INTEGER PRIMARY KEY DEFAULT 1,
      theme                    TEXT NOT NULL DEFAULT 'system',
      max_concurrent_downloads INTEGER NOT NULL DEFAULT 3,
      auto_capture             INTEGER NOT NULL DEFAULT 1,
      file_types               TEXT    NOT NULL DEFAULT '["mp4","mp3","zip","exe","pdf","jpg","png"]',
      download_path            TEXT    NOT NULL DEFAULT '${defaultPath}',
      default_quality          TEXT    NOT NULL DEFAULT 'best',
      default_format           TEXT    NOT NULL DEFAULT 'mp4',
      detect_playlists         INTEGER NOT NULL DEFAULT 1,
      playlist_download_mode  TEXT    NOT NULL DEFAULT 'all',
      create_playlist_folder   INTEGER NOT NULL DEFAULT 1,
      ffmpeg_downloaded         INTEGER NOT NULL DEFAULT 0,
      close_to_tray            INTEGER NOT NULL DEFAULT 1
    );
  `);

  // Run migrations for existing DBs that may be missing columns
  const migrations = [
    `ALTER TABLE downloads ADD COLUMN thumbnail TEXT`,
    `ALTER TABLE downloads ADD COLUMN duration INTEGER`,
    `ALTER TABLE downloads ADD COLUMN uploader TEXT`,
    `ALTER TABLE settings ADD COLUMN default_quality TEXT NOT NULL DEFAULT 'best'`,
    `ALTER TABLE settings ADD COLUMN default_format TEXT NOT NULL DEFAULT 'mp4'`,
    `ALTER TABLE settings ADD COLUMN detect_playlists INTEGER NOT NULL DEFAULT 1`,
    `ALTER TABLE settings ADD COLUMN playlist_download_mode TEXT NOT NULL DEFAULT 'all'`,
    `ALTER TABLE settings ADD COLUMN create_playlist_folder INTEGER NOT NULL DEFAULT 1`,
    `ALTER TABLE settings ADD COLUMN eula_age_acknowledged INTEGER DEFAULT 0`,
    `ALTER TABLE settings ADD COLUMN cookies_file_path TEXT DEFAULT ''`,
    `ALTER TABLE settings ADD COLUMN ffmpeg_downloaded INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE downloads ADD COLUMN playlist_title TEXT`,
    `ALTER TABLE downloads ADD COLUMN playlist_index INTEGER`,
    `ALTER TABLE downloads ADD COLUMN playlist_total INTEGER`,
    `ALTER TABLE settings ADD COLUMN close_to_tray INTEGER NOT NULL DEFAULT 1`,
  ];
  for (const sql of migrations) {
    try {
      db.run(sql);
    } catch (_) {
      /* column already exists */
    }
  }

  // Note: detect_playlists default is controlled by CREATE TABLE / INSERT OR IGNORE.
  // Do NOT force-override here — it would erase the user's saved preference on every restart.

  // Ensure default settings row
  db.exec(`
    INSERT OR IGNORE INTO settings (id, max_concurrent_downloads, download_path, default_quality, default_format, detect_playlists, playlist_download_mode, create_playlist_folder, close_to_tray)
    VALUES (1, 3, '${defaultPath}', 'best', 'mp4', 1, 'all', 1, 1);
  `);

  // Ensure all columns have non-null values
  const defaults: Record<string, any> = {
    theme: 'system',
    max_concurrent_downloads: 3,
    auto_capture: 1,
    file_types: '["mp4","mp3","zip","exe","pdf","jpg","png"]',
    download_path: defaultPath,
    default_quality: 'best',
    default_format: 'mp4',
    detect_playlists: 1,
    playlist_download_mode: 'all',
    create_playlist_folder: 1,
    eula_age_acknowledged: 0,
    cookies_file_path: '',
    close_to_tray: 1,
  };

  for (const [key, value] of Object.entries(defaults)) {
    try {
      db.run(`UPDATE settings SET ${key} = ? WHERE id = 1 AND (${key} IS NULL OR ${key} = '')`, [
        value,
      ]);
    } catch (_) {
      /* ignore */
    }
  }

  // Reset any stranded active tasks to paused so user can resume them
  try {
    db.run("UPDATE downloads SET state = 'paused' WHERE state IN ('downloading', 'merging')");
  } catch (_) { /* intentional: cleanup failure is non-critical */ }

  saveDatabase(db);
}

// ── External link policy ─────────────────────────────────────────────────────
// The renderer cannot open arbitrary URLs. Everything it asks for is matched
// against this table by exact hostname — prefix matching let
// "https://isaac-onyango-dev.github.io.example.com/" through, because that
// string does start with the allowed prefix.
//
// The share targets are here because the Support page offers those buttons;
// without them every share threw "External URL not allowed" and did nothing.
const ALLOWED_EXTERNAL_TARGETS: Array<{ host: string; pathPrefix?: string }> = [
  // The project's own pages.
  { host: 'github.com', pathPrefix: '/Isaac-Onyango-Dev' },
  { host: 'isaac-onyango-dev.github.io' },
  // Share targets offered on the Support page.
  { host: 'twitter.com' },
  { host: 'x.com' },
  { host: 'reddit.com' },
  { host: 'www.reddit.com' },
  { host: 'wa.me' },
  { host: 'facebook.com' },
  { host: 'www.facebook.com' },
  { host: 'linkedin.com' },
  { host: 'www.linkedin.com' },
  { host: 't.me' },
  { host: 'threads.net' },
  { host: 'www.threads.net' },
  { host: 'mastodon.social' },
  { host: 'news.ycombinator.com' },
  { host: 'pinterest.com' },
  { host: 'www.pinterest.com' },
];

/** True when the renderer is allowed to hand this URL to the OS browser. */
function isAllowedExternalUrl(rawUrl: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'https:') return false;
  const host = parsed.hostname.toLowerCase();
  return ALLOWED_EXTERNAL_TARGETS.some(
    (target) =>
      target.host === host && (!target.pathPrefix || parsed.pathname.startsWith(target.pathPrefix)),
  );
}

// ── Helper functions ─────────────────────────────────────────────────────────

// Every PowerShell call below goes through execFile with an argument array, so
// no shell parses the command line, and every runtime value reaches the script
// through the environment. A value read from $env: is data to PowerShell — it
// is never re-parsed as source — which is what stops a path or filename from
// closing a quote and appending a command of its own.
const PS_FLAGS = ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass'];
const PS_EXPAND_ARCHIVE =
  'Expand-Archive -LiteralPath $env:IDH_ARCHIVE -DestinationPath $env:IDH_DEST -Force';
const PS_DRIVE_FREE = '(Get-PSDrive -Name $env:IDH_DRIVE).Free';

async function getFreeSpace(targetPath: string): Promise<number> {
  return new Promise((resolve) => {
    let command: string;
    let args: string[];
    let env = process.env;
    const isUncPath = os.platform() === 'win32' && (targetPath.startsWith('\\\\') || targetPath.startsWith('//'));
    if (isUncPath) {
      // UNC paths (e.g. \\server\share) have no drive letter — Get-PSDrive
      // doesn't apply and would silently query the wrong/nonexistent drive.
      // Query the volume directly via fsutil instead.
      command = 'fsutil';
      args = ['volume', 'diskfree', targetPath];
    } else if (os.platform() === 'win32') {
      // Use drive letter only (e.g. "C"). targetPath is the user's chosen save
      // folder, so it must not be pasted into the command text.
      command = 'powershell';
      args = [...PS_FLAGS, '-Command', PS_DRIVE_FREE];
      env = { ...process.env, IDH_DRIVE: targetPath.split(':')[0] };
    } else {
      // -k is the POSIX-portable block size; the pipeline this replaced used
      // shell quoting around the path, and -b differs between GNU and BSD df.
      command = 'df';
      args = ['-k', targetPath];
    }
    const isPosixDf = command === 'df';

    execFile(command, args, { env }, (err: any, stdout: string) => {
      if (err) {
        log.error('Failed to get free space:', err);
        resolve(Number.MAX_SAFE_INTEGER);
        return;
      }
      let parsed: number;
      if (isUncPath) {
        const match = stdout.match(/free bytes\s*:\s*([\d,]+)/i);
        parsed = match ? parseInt(match[1].replace(/,/g, ''), 10) : NaN;
      } else if (isPosixDf) {
        // "Filesystem 1K-blocks Used Available Use% Mounted on" — take the
        // Available column of the last row and convert from 1K blocks.
        const rows = stdout.trim().split('\n');
        const columns = (rows[rows.length - 1] || '').trim().split(/\s+/);
        const availableBlocks = parseInt(columns[3], 10);
        parsed = isNaN(availableBlocks) ? NaN : availableBlocks * 1024;
      } else {
        parsed = parseInt(stdout.trim().replace(/[^0-9]/g, ''), 10);
      }
      resolve(isNaN(parsed) ? Number.MAX_SAFE_INTEGER : parsed);
    });
  });
}

function updateDownloadInDb(id: number, updates: any) {
  const fields: string[] = [];
  const values: any[] = [];
  for (const [key, val] of Object.entries(updates)) {
    fields.push(`${key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)} = ?`);
    values.push(val instanceof Date ? val.toISOString() : val);
  }
  if (fields.length > 0) {
    db.run(`UPDATE downloads SET ${fields.join(', ')} WHERE id = ?`, [...values, id]);
    saveDatabase(db);
  }
}

/**
 * Discards an unfinished download's partial data. yt-dlp, gallery-dl and N_m3u8DL-RE keep
 * theirs in the job's scratch folder. streamlink records straight into the save folder, and
 * only the file the stopped process created (`recording`) is removed. The save path itself
 * is never deleted: it can name a finished file from an earlier download.
 */
function discardPartialDownload(id: number, savePath: string | null, recording?: string | null) {
  if (savePath) removeJobTempDir(path.dirname(savePath), id);
  if (!recording) return;
  try {
    fs.rmSync(recording, { force: true, maxRetries: 5, retryDelay: 200 });
    log.info(`[Cleanup] Deleted partial recording: ${recording}`);
  } catch (err) {
    log.error(`[Cleanup] Failed to delete partial recording:`, err);
  }
}

/**
 * Removes history rows. Shared by the Queue page and the Downloads menu, which used to
 * delete rows under running downloads and leave their partial data behind.
 */
function clearHistory(type: 'all' | 'completed' | 'failed') {
  // Rows that go away take their partial data with them; nothing else would ever find it.
  const discardUnfinished = (where: string, recordings = new Map<number, string | null>()) => {
    for (const row of allQuery(db, `SELECT id, save_path FROM downloads WHERE ${where}`)) {
      discardPartialDownload(row.id, row.save_path, recordings.get(row.id));
    }
  };
  if (type === 'all') {
    const recordings = new Map([...activeTasks].map(([id, job]) => [id, job.recording]));
    activeTasks.forEach((job) => {
      killProcessTree(job.process.pid);
    });
    activeTasks.clear();
    updatePowerSave();
    updateTaskbarProgress();
    discardUnfinished("state != 'completed'", recordings);
    db.run('DELETE FROM downloads');
  } else if (type === 'completed') {
    db.run("DELETE FROM downloads WHERE state = 'completed'");
  } else if (type === 'failed') {
    discardUnfinished("state = 'failed'");
    db.run("DELETE FROM downloads WHERE state = 'failed'");
  }
  saveDatabase(db);
}

/** The same question the Queue page asks before clearing. */
function confirmClearHistory(type: 'all' | 'completed' | 'failed'): boolean {
  const options = {
    type: 'question' as const,
    buttons: ['Clear', 'Cancel'],
    defaultId: 1,
    cancelId: 1,
    message: `Clear ${type} downloads? This cannot be undone.`,
    detail: type === 'all' ? 'Downloads in progress are stopped and their partial files deleted.' : undefined,
  };
  const choice = mainWindow ? dialog.showMessageBoxSync(mainWindow, options) : dialog.showMessageBoxSync(options);
  return choice === 0;
}

// ── System Tray ───────────────────────────────────────────────────────────────
function createTray() {
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, 'assets/icon.ico')
    : path.join(process.cwd(), 'assets/icon.ico');

  let trayIcon: any;
  if (fs.existsSync(iconPath)) {
    trayIcon = nativeImage.createFromPath(iconPath);
  } else {
    // Create a tiny valid icon from data URI
    trayIcon = nativeImage.createEmpty();
  }

  tray = new Tray(trayIcon);
  tray.setToolTip('Internet Download Hub');

  const updateTrayMenu = () => {
    const activeCount = activeTasks.size;
    const contextMenu = Menu.buildFromTemplate([
      { label: 'Internet Download Hub', enabled: false },
      { type: 'separator' },
      {
        label: 'Show Window',
        click: () => {
          if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
          }
        },
      },
      {
        label: activeCount > 0 ? `Active Downloads: ${activeCount}` : 'No active downloads',
        enabled: false,
      },
      { type: 'separator' },
      {
        label: 'Pause All Downloads',
        enabled: activeCount > 0,
        click: () => {
          activeTasks.forEach((job, id) => {
            // The whole tree: yt-dlp.exe and streamlink.exe are launchers, and killing
            // only the launcher leaves the real downloader running.
            killProcessTree(job.process.pid);
            updateDownloadInDb(id, { state: 'paused' });
            if (mainWindow)
              mainWindow.webContents.send('download-progress', {
                jobId: String(id),
                id,
                phase: 'Paused',
                status: 'paused',
              });
          });
          activeTasks.clear();
          updatePowerSave();
          updateTaskbarProgress();
        },
      },
      {
        label: 'Resume All Downloads',
        click: () => {
          const paused = allQuery(
            db,
            "SELECT * FROM downloads WHERE state = 'paused' ORDER BY created_at ASC",
          );
          for (const item of paused) {
            updateDownloadInDb(item.id, { state: 'queued', error: null });
          }
          processQueue();
        },
      },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => {
          tray?.destroy();
          app.quit();
        },
      },
    ]);
    tray?.setContextMenu(contextMenu);
  };

  updateTrayMenu();

  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.focus();
      } else {
        mainWindow.show();
      }
    }
  });

  // Update tray menu when tasks change
  setInterval(updateTrayMenu, 3000);
}

// ============================================================================
// APPLICATION MENU (Top Menu Bar)
// ============================================================================

function createApplicationMenu() {
  const template: Electron.MenuItemConstructorOptions[] = [
    // ── File ──────────────────────────────────────────────────────────────
    {
      label: 'File',
      submenu: [
        {
          label: 'New Download',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            if (mainWindow) {
              mainWindow.show();
              mainWindow.webContents.send('navigate-to-tab', '/');
            }
          },
        },
        {
          label: 'Choose Save Folder…',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: async () => {
            if (!mainWindow) return;
            const settings = getQuery(db, 'SELECT download_path FROM settings WHERE id = 1');
            const defaultPath = settings?.download_path || app.getPath('downloads');
            const result = await dialog.showOpenDialog(mainWindow, {
              title: 'Choose Default Save Folder',
              defaultPath,
              properties: ['openDirectory'],
            });
            if (!result.canceled && result.filePaths.length > 0) {
              // Params must be an array: sql.js ignores a bare value and binds NULL.
              db.run('UPDATE settings SET download_path = ? WHERE id = 1', [result.filePaths[0]]);
              saveDatabase(db);
              mainWindow.webContents.send('settings-updated');
            }
          },
        },
        { type: 'separator' },
        {
          label: 'Close to Tray',
          type: 'checkbox',
          checked: (() => {
            const s = getQuery(db, 'SELECT close_to_tray FROM settings WHERE id = 1');
            return s ? s.close_to_tray !== 0 : true;
          })(),
          click: (item) => {
            db.run('UPDATE settings SET close_to_tray = ? WHERE id = 1', [item.checked ? 1 : 0]);
            saveDatabase(db);
          },
        },
        { type: 'separator' },
        {
          label: 'Exit',
          accelerator: 'Alt+F4',
          click: () => {
            (app as any).isQuitting = true;
            app.quit();
          },
        },
      ],
    },
    // ── Edit ──────────────────────────────────────────────────────────────
    {
      label: 'Edit',
      submenu: [
        { role: 'undo', label: 'Undo' },
        { role: 'redo', label: 'Redo' },
        { type: 'separator' },
        { role: 'cut', label: 'Cut' },
        { role: 'copy', label: 'Copy' },
        { role: 'paste', label: 'Paste' },
        { role: 'delete', label: 'Delete' },
        { type: 'separator' },
        { role: 'selectAll', label: 'Select All' },
      ],
    },
    // ── View ──────────────────────────────────────────────────────────────
    {
      label: 'View',
      submenu: [
        {
          label: 'Toggle Full Screen',
          accelerator: 'F11',
          click: () => {
            if (mainWindow) mainWindow.setFullScreen(!mainWindow.isFullScreen());
          },
        },
        { type: 'separator' },
        {
          label: 'Zoom In',
          accelerator: 'CmdOrCtrl+Plus',
          click: () => {
            if (mainWindow) {
              const wc = mainWindow.webContents;
              const current = wc.getZoomFactor();
              wc.setZoomFactor(Math.min(current + 0.1, 3.0));
            }
          },
        },
        {
          label: 'Zoom Out',
          accelerator: 'CmdOrCtrl+-',
          click: () => {
            if (mainWindow) {
              const wc = mainWindow.webContents;
              const current = wc.getZoomFactor();
              wc.setZoomFactor(Math.max(current - 0.1, 0.5));
            }
          },
        },
        {
          label: 'Reset Zoom',
          accelerator: 'CmdOrCtrl+0',
          click: () => {
            if (mainWindow) mainWindow.webContents.setZoomFactor(1.0);
          },
        },
        { type: 'separator' },
        {
          label: 'Reload',
          accelerator: 'CmdOrCtrl+R',
          click: () => {
            if (mainWindow) mainWindow.webContents.reload();
          },
        },
        ...(isDev
          ? [
              { type: 'separator' } as Electron.MenuItemConstructorOptions,
              {
                label: 'Toggle Developer Tools',
                accelerator: 'F12',
                click: () => {
                  if (mainWindow) mainWindow.webContents.toggleDevTools();
                },
              },
            ]
          : []),
      ],
    },
    // ── Downloads ─────────────────────────────────────────────────────────
    {
      label: 'Downloads',
      submenu: [
        {
          label: 'Open Download Folder',
          accelerator: 'CmdOrCtrl+J',
          click: async () => {
            const settings = getQuery(db, 'SELECT download_path FROM settings WHERE id = 1');
            const folder = settings?.download_path || app.getPath('downloads');
            shell.openPath(folder);
          },
        },
        {
          label: 'View Queue & History',
          accelerator: 'CmdOrCtrl+L',
          click: () => {
            if (mainWindow) {
              mainWindow.show();
              mainWindow.webContents.send('navigate-to-tab', '/queue');
            }
          },
        },
        { type: 'separator' },
        {
          label: 'Clear Completed Downloads',
          click: () => {
            try {
              if (!confirmClearHistory('completed')) return;
              clearHistory('completed');
              if (mainWindow) mainWindow.webContents.send('downloads-cleared');
            } catch (err: unknown) {
              log.error('[Menu] Failed to clear completed downloads:', err);
            }
          },
        },
        {
          label: 'Clear Failed Downloads',
          click: () => {
            try {
              if (!confirmClearHistory('failed')) return;
              clearHistory('failed');
              if (mainWindow) mainWindow.webContents.send('downloads-cleared');
            } catch (err: unknown) {
              log.error('[Menu] Failed to clear failed downloads:', err);
            }
          },
        },
        {
          label: 'Clear All History',
          click: () => {
            try {
              if (!confirmClearHistory('all')) return;
              clearHistory('all');
              if (mainWindow) mainWindow.webContents.send('downloads-cleared');
            } catch (err: unknown) {
              log.error('[Menu] Failed to clear all history:', err);
            }
          },
        },
      ],
    },
    // ── Help ──────────────────────────────────────────────────────────────
    {
      role: 'help',
      submenu: [
        {
          label: 'Visit GitHub Repository',
          click: () => shell.openExternal('https://github.com/Isaac-Onyango-Dev/Internet-Download-Hub'),
        },
        {
          label: 'Report a Bug',
          click: () =>
            shell.openExternal('https://github.com/Isaac-Onyango-Dev/Internet-Download-Hub/issues/new'),
        },
        {
          label: 'Request a Feature',
          click: () =>
            shell.openExternal('https://github.com/Isaac-Onyango-Dev/Internet-Download-Hub/discussions/new'),
        },
        { type: 'separator' },
        {
          label: 'Open Log File',
          click: () => {
            try {
              const logFile = log.transports.file.getFile();
              if (logFile?.path) {
                shell.openPath(logFile.path);
              } else {
                shell.openPath(app.getPath('logs'));
              }
            } catch (err: unknown) {
              log.error('[Menu] Failed to open log file:', err);
            }
          },
        },
        { type: 'separator' },
        {
          label: 'Check for Updates',
          click: () => {
            void checkForAppUpdates();
          },
        },
        { type: 'separator' },
        {
          label: 'About Internet Download Hub',
          click: async () => {
            const version = app.getVersion();
            const ytDlpVersion = await (async () => {
              try {
                const r = await execa(ytDlpPath, ['--version'], { timeout: 5000 });
                return r.stdout.trim();
              } catch {
                return 'Not installed';
              }
            })();
            const ffmpegVersion = await (async () => {
              try {
                const r = await execa(ffmpegPath, ['-version'], { timeout: 5000 });
                const m = r.stdout.match(/ffmpeg version\s+(\S+)/);
                return m ? m[1] : 'Not installed';
              } catch {
                return 'Not installed';
              }
            })();
            const streamlinkVersion = await (async () => {
              try {
                const r = await execa(streamlinkPath, ['--version'], { timeout: 5000 });
                return r.stdout.trim().split('\n')[0] || 'Not installed';
              } catch {
                return 'Not installed';
              }
            })();

            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'About Internet Download Hub',
              message: 'Internet Download Hub',
              detail:
                `Grab any video, anywhere.\n\n` +
                `Version: ${version}\n\n` +
                `A free, open-source desktop video downloader for Windows.\n` +
                `Supports 1000+ sites via yt-dlp, streamlink, gallery-dl & more.\n\n` +
                `── Engine Versions ──\n` +
                `yt-dlp:       ${ytDlpVersion}\n` +
                `ffmpeg:       ${ffmpegVersion}\n` +
                `streamlink:   ${streamlinkVersion}\n\n` +
                `© ${new Date().getFullYear()} Isaac Onyango\n` +
                `Licensed under MIT\n` +
                `https://isaac-onyango-dev.github.io/Internet-Download-Hub/\n` +
                `https://github.com/Isaac-Onyango-Dev/Internet-Download-Hub`,
              buttons: ['OK', 'Copy Info'],
              defaultId: 0,
              cancelId: 0,
              noLink: true,
            }).then(({ response }) => {
              if (response === 1) {
                const info =
                  `Internet Download Hub v${version}\n` +
                  `yt-dlp: ${ytDlpVersion}\n` +
                  `ffmpeg: ${ffmpegVersion}\n` +
                  `streamlink: ${streamlinkVersion}`;
                clipboard.writeText(info);
              }
            });
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// ── Window Management ───────────────────────────────────────────────────────
const getPreloadPath = (): string => {
  if (app.isPackaged) {
    // In packaged app, preload is next to main.cjs in resources/app.asar
    return path.join(__dirname, 'preload.cjs');
  } else {
    // In development, preload is in the electron/ folder
    return path.join(process.cwd(), 'electron', 'preload.cjs');
  }
};

/**
 * Vite `outDir` is `dist/public` (see vite.config.ts). Some builds may use `dist/` only.
 */
function getPackagedIndexHtmlPath(): string {
  const candidates = [
    path.join(__dirname, '..', 'dist', 'public', 'index.html'),
    path.join(__dirname, '..', 'dist', 'index.html'),
    path.join(app.getAppPath(), 'dist', 'public', 'index.html'),
    path.join(app.getAppPath(), 'dist', 'index.html'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      log.info('[MAIN] Loading renderer from:', p);
      return p;
    }
    log.warn('[MAIN] index.html not found at:', p);
  }
  const fallback = candidates[0];
  log.error('[MAIN] No index.html found; attempting loadFile with:', fallback);
  return fallback;
}

function createWindow() {
  const preloadPath = getPreloadPath();

  log.info('[MAIN] Preload path:', preloadPath);
  log.info('[MAIN] Preload exists:', fs.existsSync(preloadPath));

  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, 'assets/icon.png')
    : path.join(process.cwd(), 'assets/icon.png');

  // Show splash screen immediately
  const splash = new BrowserWindow({
    width: 400,
    height: 300,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Packaged: splash.html ships inside the asar at client/splash.html (see the
  // "files" array in package.json). It is not unpacked, so resolve it relative
  // to the app path rather than resourcesPath/app.asar.unpacked.
  const splashPath = app.isPackaged
    ? path.join(app.getAppPath(), 'client', 'splash.html')
    : path.join(process.cwd(), 'client', 'splash.html');

  if (fs.existsSync(splashPath)) {
    splash.loadFile(splashPath);
  } else {
    log.warn('[MAIN] Splash screen not found at:', splashPath);
  }

  // Create main window in parallel
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'Internet Download Hub',
    icon: iconPath,
    show: false,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.once('ready-to-show', () => {
    // Close splash and show main window
    splash.close();
    mainWindow?.show();

    // Open DevTools in development for debugging
    if (isDev) {
      mainWindow.webContents.openDevTools();
    }

    // Ensure FFmpeg database flag is synced with actual availability
    const ffmpegDownloaded =
      getQuery(db, 'SELECT ffmpeg_downloaded FROM settings WHERE id = 1')?.ffmpeg_downloaded === 1;
    const ffmpegAvailable = isFFmpegAvailable();

    if (ffmpegAvailable && !ffmpegDownloaded) {
      log.info('[Main] FFmpeg is available (bundled), updating database flag');
      db.run('UPDATE settings SET ffmpeg_downloaded = 1 WHERE id = 1');
      saveDatabase(db);
    }

    if (!ffmpegAvailable) {
      log.info('[Main] FFmpeg not bundled, user will be notified when needed');
    }
  });

  mainWindow.webContents.on(
    'did-fail-load',
    (_event: unknown, errorCode: number, errorDescription: string, validatedURL: string) => {
      log.error('[MAIN] did-fail-load', { errorCode, errorDescription, validatedURL });
      const msg = `Failed to load (${errorCode}): ${validatedURL}\n${errorDescription}`;
      if (!(app as any).isPackaged) {
        dialog.showErrorBox('Load Error', msg);
      } else {
        dialog.showErrorBox(
          'Internet Download Hub — load error',
          `${msg}\n\nIf this persists, check the log file from Help or %APPDATA% logs.`,
        );
      }
    },
  );

  // Prevent in-app external navigation
  mainWindow.webContents.setWindowOpenHandler(({ url }: { url: string }) => {
    if (isAllowedExternalUrl(url)) {
      shell.openExternal(url);
    } else {
      log.warn(`[MAIN] Blocked external navigation: ${url}`);
    }
    return { action: 'deny' };
  });

  // Minimize to tray instead of closing
  mainWindow.on('close', (event: any) => {
    if (tray && !(app as any).isQuitting) {
      const settings = getQuery(db, 'SELECT close_to_tray FROM settings WHERE id = 1');
      const shouldCloseToTray = settings ? settings.close_to_tray !== 0 : true;
      if (shouldCloseToTray) {
        event.preventDefault();
        mainWindow?.hide();
      } else {
        (app as any).isQuitting = true;
      }
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  const isDevRenderer = !app.isPackaged && process.env.CI !== 'true';
  const devUrl = 'http://localhost:5173';
  const indexHtml = isDevRenderer ? null : getPackagedIndexHtmlPath();

  // A plain link would load its page in this window, and the preload API with it.
  // Routing is hash-based, so the app itself never navigates away from its page.
  mainWindow.webContents.on('will-navigate', (event, target) => {
    let own = false;
    try {
      const u = new URL(target);
      own = indexHtml
        ? u.protocol === 'file:' && fileURLToPath(u).toLowerCase() === indexHtml.toLowerCase()
        : u.origin === devUrl;
    } catch {
      /* not a URL we know */
    }
    if (own) return;
    event.preventDefault();
    if (isAllowedExternalUrl(target)) shell.openExternal(target);
    else log.warn(`[MAIN] Blocked navigation: ${target}`);
  });

  if (indexHtml) {
    mainWindow.loadFile(indexHtml);
  } else {
    mainWindow.loadURL(devUrl);
  }
}

// ── Playlist / URL Helpers ───────────────────────────────────────────────────
function isPlaylistUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.searchParams.has('list') && !parsed.searchParams.has('v');
  } catch {
    return false;
  }
}

function cleanVideoUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.searchParams.has('v') && parsed.searchParams.has('list')) {
      const videoId = parsed.searchParams.get('v');
      return `https://www.youtube.com/watch?v=${videoId}`;
    }
    return url;
  } catch {
    return url;
  }
}

function detectPlaylist(url: string): { isPlaylist: boolean } {
  try {
    const parsed = new URL(url);
    const hasV = parsed.searchParams.has('v');
    const hasList = parsed.searchParams.has('list');
    const list = (parsed.searchParams.get('list') || '').toUpperCase();
    const lower = url.toLowerCase();

    // Single YouTube video inside a playlist context must be treated as a SINGLE video.
    // Example: https://www.youtube.com/watch?v=...&list=...
    if (hasV && hasList) {
      return { isPlaylist: false };
    }

    // Explicit YouTube playlist page: /playlist?list=...
    if (parsed.pathname === '/playlist' && hasList) {
      return { isPlaylist: true };
    }

    // YouTube channel/user pages: /channel/..., /c/..., /user/..., /@...
    if (/youtube\.com\/(c\/|channel\/|user\/|@)/.test(lower)) {
      return { isPlaylist: true };
    }

    // Mix/radio-style: list param present but no v param.
    if (
      !hasV &&
      hasList &&
      (list.startsWith('RD') || list.startsWith('FL') || list.startsWith('PL'))
    ) {
      return { isPlaylist: true };
    }

    // Generic "list without v" (covers playlist URLs that follow this pattern).
    if (!hasV && hasList) {
      return { isPlaylist: true };
    }

    return { isPlaylist: false };
  } catch {
    return { isPlaylist: false };
  }
}

// ── yt-dlp Helper Functions ───────────────────────────────────────────────

/** Fetch a JSON URL with a User-Agent header (follows redirects for GitHub API) */
/**
 * GitHub refused the request because this computer is out of API quota.
 * Unauthenticated callers get 60 requests an hour per IP, and this app spends
 * that budget in six places, so a shared or corporate NAT hits it in normal
 * use. Distinguished from other failures so the UI can say "try again later"
 * instead of blaming the user's connection.
 */
class GitHubRateLimitError extends Error {
  readonly retryAfter: Date | null;

  constructor(retryAfter: Date | null) {
    super(
      retryAfter
        ? `GitHub is limiting requests from this network until ${retryAfter.toLocaleTimeString()}.`
        : 'GitHub is limiting requests from this network.',
    );
    this.name = 'GitHubRateLimitError';
    this.retryAfter = retryAfter;
  }
}

/** When GitHub says the quota resets, from whichever header it sent. */
function rateLimitResetAt(headers: any): Date | null {
  const retryAfter = Number(headers['retry-after']);
  if (Number.isFinite(retryAfter) && retryAfter > 0) {
    return new Date(Date.now() + retryAfter * 1000);
  }
  const reset = Number(headers['x-ratelimit-reset']);
  if (Number.isFinite(reset) && reset > 0) return new Date(reset * 1000);
  return null;
}

/**
 * A 403 from GitHub is usually quota exhaustion, but not always. Only treat it
 * as rate limiting when the headers say so; 429 always is.
 */
function isRateLimited(statusCode: number | undefined, headers: any): boolean {
  if (statusCode === 429) return true;
  if (statusCode !== 403) return false;
  return headers['x-ratelimit-remaining'] === '0' || headers['retry-after'] != null;
}

const GITHUB_API_TIMEOUT_MS = 15000;

async function fetchJson(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const doGet = (target: string) => {
      const request = https
        .get(
          target,
          {
            headers: {
              'User-Agent': 'Internet-Download-Hub',
              // Pins the response schema; without it GitHub is free to serve a
              // different default representation.
              Accept: 'application/vnd.github+json',
              'X-GitHub-Api-Version': '2022-11-28',
            },
          },
          (res) => {
            // Follow redirects
            if ((res.statusCode === 301 || res.statusCode === 302) && res.headers.location) {
              res.resume(); // drain, or the socket is never released
              doGet(res.headers.location);
              return;
            }
            if (isRateLimited(res.statusCode, res.headers)) {
              res.resume();
              reject(new GitHubRateLimitError(rateLimitResetAt(res.headers)));
              return;
            }
            let data = '';
            res.on('data', (chunk) => (data += chunk));
            res.on('end', () => {
              try {
                if (res.statusCode && res.statusCode >= 400) {
                  reject(new Error(`GitHub API returned HTTP ${res.statusCode}`));
                  return;
                }
                resolve(JSON.parse(data));
              } catch {
                reject(new Error('Failed to parse GitHub API response'));
              }
            });
          },
        )
        .on('error', reject);

      // https.get has no default timeout, so a connection that opens and then
      // stalls (captive-portal Wi-Fi is the usual cause) would hang the caller
      // forever with no dialog and no way to cancel.
      request.setTimeout(GITHUB_API_TIMEOUT_MS, () => {
        request.destroy(new Error('The request to GitHub timed out.'));
      });
    };
    doGet(url);
  });
}

/**
 * Verify a downloaded file against the checksum published beside it.
 *
 * GitHub release assets carry a `digest` field shaped `"sha256:<hex>"`. Pass it
 * through and this throws on any mismatch. Pass nothing — because the publisher
 * does not yet publish a checksum for that asset — and it logs and returns, so
 * the check starts working the day a digest appears without any code change.
 *
 * The app's own update asset does not come through here: electron-updater
 * downloads it and verifies the sha512 recorded in latest.yml, and refuses to
 * install anything whose update metadata carries no checksum at all.
 */
async function verifyFileDigest(filePath: string, digest?: string | null): Promise<void> {
  const name = path.basename(filePath);
  if (!digest) {
    log.warn(`[Integrity] No checksum published for ${name}; skipping verification.`);
    return;
  }

  const parsed = /^\s*([a-z0-9-]+)[:=]([a-f0-9]+)\s*$/i.exec(digest);
  if (!parsed) {
    throw new Error(`Unrecognised checksum format for ${name}: "${digest}".`);
  }
  const algorithm = parsed[1].toLowerCase().replace(/-/g, '');
  const expected = parsed[2].toLowerCase();

  let actual: string;
  try {
    actual = await new Promise<string>((resolve, reject) => {
      const hash = crypto.createHash(algorithm);
      const stream = fs.createReadStream(filePath);
      stream.on('error', reject);
      stream.on('data', (chunk) => hash.update(chunk));
      stream.on('end', () => resolve(hash.digest('hex')));
    });
  } catch (err: any) {
    throw new Error(`Could not verify ${name} (${algorithm}): ${err?.message || err}`);
  }

  if (actual !== expected) {
    throw new Error(
      `Checksum mismatch for ${name} — expected ${algorithm} ${expected}, got ${actual}.`,
    );
  }
  log.info(`[Integrity] ${name} matches its published ${algorithm} checksum.`);
}

/**
 * Download a file, following redirects, into dest.
 *
 * When `digest` is supplied the file is verified before this resolves, and a
 * file that fails verification is deleted rather than left on disk where a
 * later step could execute it.
 */
async function downloadFile(url: string, dest: string, digest?: string | null): Promise<void> {
  await downloadFileUnverified(url, dest);
  try {
    await verifyFileDigest(dest, digest);
  } catch (err) {
    fs.unlink(dest, () => {});
    throw err;
  }
}

/** The transfer itself, with no integrity check. Use downloadFile instead. */
async function downloadFileUnverified(
  url: string,
  dest: string,
  onProgress?: (received: number, total: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const doRequest = (target: string, redirectsLeft: number) => {
      const request = https.get(target, { headers: { 'User-Agent': 'Internet-Download-Hub' } }, (res) => {
        const status = res.statusCode ?? 0;
        // GitHub answers release downloads with a redirect to its CDN.
        if (status >= 300 && status < 400 && res.headers.location && redirectsLeft > 0) {
          res.resume(); // drain, or the socket is never released
          doRequest(new URL(res.headers.location, target).toString(), redirectsLeft - 1);
          return;
        }
        if (status !== 200) {
          res.resume();
          reject(new Error(`Failed to download file (HTTP ${status}): ${url}`));
          return;
        }
        const total = parseInt(res.headers['content-length'] || '0', 10);
        let received = 0;
        if (onProgress) res.on('data', (chunk: Buffer) => onProgress((received += chunk.length), total));
        // pipeline, not pipe: a connection that drops mid-body rejects instead of hanging.
        pipeline(res, fs.createWriteStream(dest)).then(resolve, (err) => {
          fs.unlink(dest, () => {});
          reject(err);
        });
      });
      request.on('error', reject);
      // A connection that stays open but stops sending ends the same way.
      request.setTimeout(60000, () => request.destroy(new Error(`The download stalled: ${url}`)));
    };
    doRequest(url, 5);
  });
}

// ── App Self-Update ──────────────────────────────────────────────────────────
// "Check for Updates" asks the GitHub API which release is newest, then hands
// the install to electron-updater, which downloads the release installer and
// runs it. Every way that can go wrong — an unsupported platform, a dev build,
// missing update metadata, GitHub rejecting the request, a failed download —
// ends at the public download page. It never ends at the GitHub releases/tags
// page, which a non-technical user cannot navigate.

const APP_RELEASE_API =
  'https://api.github.com/repos/Isaac-Onyango-Dev/Internet-Download-Hub/releases/latest';
const DOWNLOAD_PAGE_URL = 'https://isaac-onyango-dev.github.io/Internet-Download-Hub/';

/** Stops a second "Check for Updates" click from stacking requests and dialogs. */
let appUpdateInFlight = false;

/**
 * Open the public download page in the user's default browser.
 * If even that fails, show the address and offer to copy it, so the user is
 * never left with a dead button and no way forward.
 */
async function openDownloadPage(): Promise<void> {
  try {
    await shell.openExternal(DOWNLOAD_PAGE_URL);
    log.info(`[Update] Opened the download page: ${DOWNLOAD_PAGE_URL}`);
  } catch (err: unknown) {
    log.error('[Update] Could not open the download page:', err);
    if (!mainWindow) return;
    const { response } = await dialog.showMessageBox(mainWindow, {
      type: 'warning',
      title: 'Could not open your browser',
      message: 'Please download the new version from our website.',
      detail: DOWNLOAD_PAGE_URL,
      buttons: ['Copy Link', 'OK'],
      defaultId: 0,
      cancelId: 1,
      noLink: true,
    });
    if (response === 0) clipboard.writeText(DOWNLOAD_PAGE_URL);
  }
}

/**
 * Download the new version and restart into its installer.
 *
 * Returns null once the install is under way (the app is quitting at that
 * point). Returns a plain-language reason string when the in-app path cannot
 * be used, so the caller can fall back to the download page.
 */
async function installUpdateInApp(
  setStatus: (text: string | null) => void,
): Promise<string | null> {
  // Only the Windows build ships an installer, and electron-updater needs a
  // packaged app with app-update.yml in its resources.
  if (process.platform !== 'win32') {
    return 'Automatic updates are only available in the Windows build.';
  }
  if (!app.isPackaged) {
    return 'Automatic updates only work in an installed build, not in development.';
  }

  const onProgress = (progress: any) => {
    const percent = Math.max(0, Math.min(100, Math.round(progress?.percent ?? 0)));
    setStatus(`Downloading update… ${percent}%`);
  };
  // electron-updater rejects its promises AND emits 'error'. An 'error' event
  // with no listener is rethrown by EventEmitter, so keep one attached.
  const onError = (err: unknown) => log.error('[Update] electron-updater reported:', err);

  autoUpdater.logger = log;
  autoUpdater.autoDownload = false; // the dialog decides, not the check
  autoUpdater.autoInstallOnAppQuit = true; // if our explicit install is cut short, still land it
  autoUpdater.on('error', onError);
  autoUpdater.on('download-progress', onProgress);

  try {
    setStatus('Checking for updates…');
    const result = await autoUpdater.checkForUpdates();
    if (!result?.updateInfo) {
      return 'The update service did not say which version to install.';
    }
    if (result.isUpdateAvailable === false) {
      return 'The update service found no installable update for this build.';
    }

    setStatus('Downloading update… 0%');
    await autoUpdater.downloadUpdate(result.cancellationToken);

    setStatus('Installing update…');
    log.info(`[Update] Downloaded v${result.updateInfo.version}; restarting to install.`);

    // The window's close handler hides to tray unless isQuitting is set, which
    // would swallow the app.quit() inside quitAndInstall() and leave the
    // installer unrun.
    (app as any).isQuitting = true;
    // Defer so this call stack (and the caller's dialog) unwinds before the
    // app tears itself down.
    setImmediate(() => autoUpdater.quitAndInstall(false, true));
    return null;
  } catch (err: any) {
    log.error('[Update] In-app update failed:', err);
    return err?.message || 'The update could not be downloaded.';
  } finally {
    autoUpdater.removeListener('download-progress', onProgress);
    autoUpdater.removeListener('error', onError);
  }
}

/**
 * Help ▸ Check for Updates. Compares the installed version against the newest
 * GitHub release and offers to install it in place.
 */
async function checkForAppUpdates(): Promise<void> {
  if (!mainWindow) return;
  if (appUpdateInFlight) {
    log.info('[Update] A check is already running; ignoring the repeat click.');
    return;
  }
  appUpdateInFlight = true;

  const win = mainWindow;
  const baseTitle = win.getTitle();
  // Progress lives in the window title: it is visible in the title bar and the
  // taskbar without blocking the UI, and a modal dialog cannot show progress.
  const setStatus = (text: string | null) => {
    if (win.isDestroyed()) return;
    win.setTitle(text ? `${baseTitle} — ${text}` : baseTitle);
  };

  const currentVersion = app.getVersion();
  log.info(`[Menu] Checking for updates… (installed: v${currentVersion})`);

  // On the success path the app is quitting into the installer, so the title
  // keeps saying so instead of snapping back to normal.
  let installing = false;

  try {
    setStatus('Checking for updates…');
    const release = await fetchJson(APP_RELEASE_API);
    const latestTag: string = release.tag_name; // e.g. "v1.1.3"
    const latestVersion = latestTag.replace(/^v/, '');
    setStatus(null);

    // Compare as versions, not as strings. String equality called every
    // difference an update, so a local build ahead of the published tag
    // (1.1.6 against a 1.1.5 release) was offered a downgrade, and a
    // pre-release suffix never matched at all.
    const installed = semver.valid(currentVersion);
    const published = semver.valid(latestVersion);
    const comparable = Boolean(installed && published);
    // Unparseable on either side: fall back to the old exact-match behaviour
    // rather than guessing which way round they go.
    const updateAvailable = comparable
      ? semver.gt(published as string, installed as string)
      : currentVersion !== latestVersion;
    const aheadOfRelease = comparable && semver.gt(installed as string, published as string);

    if (!updateAvailable) {
      await dialog.showMessageBox(win, {
        type: 'info',
        title: 'You\'re up to date',
        message: 'Internet Download Hub is up to date.',
        detail: aheadOfRelease
          ? `Installed version: v${currentVersion}\n` +
            `Latest release: v${latestVersion}\n\n` +
            `This build is newer than the latest public release, so there is ` +
            `nothing to install.`
          : `Installed version: v${currentVersion}\n\n` +
            `You're running the latest version. Check here again whenever you ` +
            `want to see if a newer one has been released.`,
        buttons: ['OK'],
        defaultId: 0,
        noLink: true,
      });
      return;
    }

    const releaseBody = release.body || '';
    const releaseNotes = releaseBody
      .split('\n')
      .filter((line: string) => line.trim())
      .slice(0, 20) // limit to first 20 lines
      .join('\n');

    const { response } = await dialog.showMessageBox(win, {
      type: 'info',
      title: 'Update Available',
      message: `Version ${latestVersion} is available`,
      detail:
        `Installed: v${currentVersion}\nLatest: v${latestVersion}\n\n` +
        `${releaseNotes ? `Release Notes:\n${releaseNotes}\n\n` : ''}` +
        `The app will download the update and restart to install it. ` +
        `This can take a few minutes on a slow connection.`,
      buttons: ['Install Update', 'Later'],
      defaultId: 0,
      cancelId: 1,
      noLink: true,
    });

    if (response !== 0) return;

    const failureReason = await installUpdateInApp(setStatus);
    if (failureReason === null) {
      installing = true;
      return; // the app is quitting into the installer
    }

    setStatus(null);
    await dialog.showMessageBox(win, {
      type: 'warning',
      title: 'Update Failed',
      message: 'Update failed — opening the download page instead.',
      detail:
        `${failureReason}\n\n` +
        `Your browser will open at our download page, where you can get ` +
        `v${latestVersion} and install it yourself. Nothing on this computer ` +
        `has been changed.`,
      buttons: ['OK'],
      defaultId: 0,
      noLink: true,
    });
    await openDownloadPage();
  } catch (err: unknown) {
    log.error('[Menu] Update check failed:', err);
    setStatus(null);

    // Being out of GitHub API quota is not a broken connection, and telling
    // the user to check their internet would send them chasing the wrong
    // thing. Say what actually happened and when it will work again.
    const rateLimited = err instanceof GitHubRateLimitError;
    const retryAfter = rateLimited ? (err as GitHubRateLimitError).retryAfter : null;

    const { response } = await dialog.showMessageBox(win, {
      type: rateLimited ? 'warning' : 'error',
      title: 'Update Check Failed',
      message: rateLimited
        ? 'Could not check for updates right now — please try again later.'
        : 'Could not check for updates.',
      detail: rateLimited
        ? `GitHub is temporarily limiting requests from this network` +
          `${retryAfter ? `, and will accept them again after ${retryAfter.toLocaleTimeString()}` : ''}. ` +
          `This is a limit on the network, not a problem with your computer or ` +
          `your copy of the app.\n\n` +
          `You can wait and try again, or download the latest version from our website.`
        : 'Please check your internet connection and try again.\n\n' +
          'You can also download the latest version from our website.',
      buttons: ['Open Download Page', 'Cancel'],
      defaultId: 0,
      cancelId: 1,
      noLink: true,
    });
    if (response === 0) await openDownloadPage();
  } finally {
    if (!installing) setStatus(null);
    appUpdateInFlight = false;
  }
}

/** Get the currently installed yt-dlp version string. */
async function getCurrentYtDlpVersion(): Promise<string> {
  try {
    const { stdout, stderr } = await execa(ytDlpPath, ['--version'], { timeout: 10000 });
    // yt-dlp outputs version to stdout, but some builds use stderr
    const version = (stdout || stderr || '').trim();
    return version || 'unknown';
  } catch {
    return 'unknown';
  }
}

/** Check if a yt-dlp update is available without downloading anything. */
async function checkYtDlpVersion(): Promise<{
  updateAvailable: boolean;
  currentVersion: string;
  latestVersion: string;
}> {
  const [currentVersion, release] = await Promise.all([
    getCurrentYtDlpVersion(),
    fetchJson('https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest'),
  ]);
  const latestVersion: string = release.tag_name;
  return {
    updateAvailable: currentVersion !== 'unknown' && currentVersion !== latestVersion,
    currentVersion,
    latestVersion,
  };
}

/**
 * Binary configurations for all download engines
 */
const BINARIES = [
  {
    name: 'yt-dlp',
    releaseApi: 'https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest',
    downloadUrl: (tag: string) =>
      `https://github.com/yt-dlp/yt-dlp/releases/download/${tag}/yt-dlp.exe`,
    versionFlag: '--version',
    fileName: 'yt-dlp.exe',
  },
  {
    name: 'streamlink',
    releaseApi: 'https://api.github.com/repos/streamlink/windows-builds/releases/latest',
    downloadUrl: null, // Asset is e.g. streamlink-8.6.1-1-py314-x86_64.zip
    assetPattern: /x86_64\.zip$/,
    versionFlag: '--version',
    fileName: 'streamlink/bin/streamlink.exe',
    isZip: true,
    // The launcher needs its sibling Python/ and pkgs/, so the whole build is kept.
    keepDir: 'streamlink',
  },
  {
    name: 'gallery-dl',
    // Releases moved to Codeberg; its GitHub releases no longer carry binaries.
    // Forgejo's release API returns the same tag_name/assets shape as GitHub's.
    releaseApi: 'https://codeberg.org/api/v1/repos/mikf/gallery-dl/releases/latest',
    downloadUrl: null,
    assetPattern: /^gallery-dl\.exe$/,
    versionFlag: '--version',
    fileName: 'gallery-dl.exe',
  },
  {
    name: 'N_m3u8DL-RE',
    releaseApi: 'https://api.github.com/repos/nilaoda/N_m3u8DL-RE/releases/latest',
    downloadUrl: null, // Dynamic - finds the correct asset from release
    versionFlag: '--version',
    assetPattern: /_win-x64_.*\.zip$/,
    fileName: 'N_m3u8DL-RE.exe',
    isZip: true,
  },
] as {
  name: string;
  releaseApi: string;
  downloadUrl: ((tag: string) => string) | null;
  assetPattern?: RegExp;
  versionFlag: string;
  fileName: string;
  isZip?: boolean;
  keepDir?: string;
}[];

/**
 * Helper to find the correct download asset URL from a release
 */
function getAssetDownloadUrl(release: any, fileNamePattern: RegExp): string | null {
  const assets = release.assets || [];
  // Anchored patterns, so a neighbouring .sig/.asc file is never picked instead.
  const asset = assets.find((a: any) => fileNamePattern.test(a.name));
  return asset ? asset.browser_download_url : null;
}

/**
 * Safe update: download new binary to system temp dir first,
 * then copy it into the binaries folder — this avoids EPERM when installed in
 * C:\Program Files\ because the temp dir is always writable.
 */
async function performYtDlpUpdate(): Promise<{ updated: boolean; version: string }> {
  // Fetch release info
  const release = await fetchJson('https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest');
  const latestVersion: string = release.tag_name;
  const currentVersion = await getCurrentYtDlpVersion();

  if (currentVersion === latestVersion) {
    return { updated: false, version: currentVersion };
  }

  const asset = release.assets.find((a: any) => a.name === 'yt-dlp.exe');
  if (!asset) throw new Error('Could not find yt-dlp.exe in the latest release');

  // Destination folder: userData/binaries (always writable)
  const userDataBinariesPath = path.join(app.getPath('userData'), 'binaries');
  if (!fs.existsSync(userDataBinariesPath)) {
    fs.mkdirSync(userDataBinariesPath, { recursive: true });
  }
  const destPath = path.join(userDataBinariesPath, 'yt-dlp.exe');

  // Write to a temporary file first
  const tempPath = path.join(userDataBinariesPath, `yt-dlp-new-${Date.now()}.exe`);

  log.info(`[UPDATE] Downloading yt-dlp ${latestVersion} to: ${tempPath}`);
  await downloadFile(asset.browser_download_url, tempPath, asset.digest);

  // Sanity-check the downloaded file
  const stats = fs.statSync(tempPath);
  if (stats.size < 10 * 1024 * 1024) {
    // Increased to 10MB because yt-dlp is usually 15MB+
    fs.unlinkSync(tempPath);
    throw new Error(
      `Downloaded file is suspiciously small (${(stats.size / 1024 / 1024).toFixed(2)} MB) — aborting`,
    );
  }

  // Backup existing binary in userData if it exists
  const backupPath = destPath + '.backup';
  try {
    if (fs.existsSync(backupPath)) fs.unlinkSync(backupPath);
  } catch (err: any) { log.error('Operation failed:', err?.message || err); }
  try {
    if (fs.existsSync(destPath)) fs.renameSync(destPath, backupPath);
  } catch (err: any) { log.error('Operation failed:', err?.message || err); }

  try {
    // Replace the binary
    fs.renameSync(tempPath, destPath);
    try {
      if (fs.existsSync(backupPath)) fs.unlinkSync(backupPath);
    } catch (err: any) { log.error('Operation failed:', err?.message || err); }

    // Switch to the new path immediately
    ytDlpPath = destPath;
    log.info(`[UPDATE] yt-dlp successfully updated to v${latestVersion} in userData`);
    return { updated: true, version: latestVersion };
  } catch (err: any) {
    // Restore backup on failure
    try {
      if (!fs.existsSync(destPath) && fs.existsSync(backupPath)) {
        fs.renameSync(backupPath, destPath);
      }
    } catch (err: any) { log.error('Operation failed:', err?.message || err); }
    try {
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    } catch (err: any) { log.error('Operation failed:', err?.message || err); }
    throw new Error(`Failed to finalize update: ${err.message}`);
  }
}

// Keep old helper for backward compat (used in getLatestYtDlpRelease calls elsewhere)
async function getLatestYtDlpRelease(): Promise<{ url: string; version: string }> {
  const release = await fetchJson('https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest');
  const asset = release.assets.find((a: any) => a.name === 'yt-dlp.exe');
  if (!asset) throw new Error('yt-dlp.exe asset not found in latest release');
  return { url: asset.browser_download_url, version: release.tag_name };
}

// Alias for old code that calls downloadYtDlp — now delegates to downloadFile
async function downloadYtDlp(url: string, dest: string, digest?: string | null): Promise<void> {
  return downloadFile(url, dest, digest);
}

/**
 * Background version check — runs 5 seconds after startup.
 * Sends IPC events to the renderer with version info, but never shows a dialog.
 */
async function runBackgroundVersionCheck() {
  try {
    const check = await checkYtDlpVersion();
    if (!mainWindow) return;
    if (check.updateAvailable) {
      log.info(
        `[UPDATE] yt-dlp update available: ${check.currentVersion} -> ${check.latestVersion}`,
      );
      mainWindow.webContents.send('ytdlp-update-available', {
        currentVersion: check.currentVersion,
        latestVersion: check.latestVersion,
      });
    } else {
      log.info(`[UPDATE] yt-dlp is up to date: ${check.currentVersion}`);
      mainWindow.webContents.send('ytdlp-version-info', {
        currentVersion: check.currentVersion,
        latestVersion: check.latestVersion,
        upToDate: true,
        updateAvailable: false,
      });
    }
  } catch (err: any) {
    log.warn('[UPDATE] Background version check failed (silently ignored):', err.message);
  }
}

// ── Queue Management ─────────────────────────────────────────────────────────
async function processQueue() {
  try {
    const settings = getQuery(db, 'SELECT max_concurrent_downloads FROM settings WHERE id = 1');
    const maxConcurrent = settings?.max_concurrent_downloads || 3;
    const activeCount = activeTasks.size;

    if (activeCount >= maxConcurrent) return;

    const toStart = maxConcurrent - activeCount;
    // Get ALL queued items sorted by priority, not just the first 'toStart' ones.
    // This allows us to skip items needing FFmpeg (if it's downloading) and start others.
    const queuedItems = allQuery(
      db,
      "SELECT * FROM downloads WHERE state = 'queued' ORDER BY created_at ASC",
    );

    let startedThisLoop = 0;
    for (const item of queuedItems) {
      if (startedThisLoop >= toStart) break;

      // Check if this specific item requires FFmpeg but it isn't available yet
      if (checkFFmpegRequired(item.format_id) && !isFFmpegAvailable()) {
        log.info(`[Queue] Item ${item.id} requires FFmpeg but it's not available. Triggering background fetch.`);
        // Initiate background download (locked)
        downloadFFmpeg().catch((err: any) =>
          log.error(`[Queue] Auto-FFmpeg download failed for job ${item.id}:`, err),
        );
        // Skip this item for now, it stays 'queued' until FFmpeg is ready
        continue;
      }

      startedThisLoop++;
      updateDownloadInDb(item.id, { state: 'downloading', error: null });
      spawnDownload(item.id, item.url, item.save_path, item.format_id, !!item.received_bytes);
      if (mainWindow) {
        mainWindow.webContents.send('download-progress', {
          jobId: String(item.id),
          id: item.id,
          phase: 'Starting download...',
          status: 'downloading',
        });
      }
    }
  } catch (error) {
    log.error('[Queue Error]', error);
  }
}

/** Netscape cookie file from settings, if path exists on disk. */
function getResolvedCookiesPath(): string | null {
  if (!db) return null;
  try {
    const row = getQuery(db, 'SELECT cookies_file_path FROM settings WHERE id = 1');
    const raw = row?.cookies_file_path;
    if (typeof raw === 'string' && raw.trim()) {
      const p = raw.trim();
      if (fs.existsSync(p)) return p;
      log.warn('[Main] cookies_file_path set but file missing:', p);
    }
  } catch (e: any) {
    log.warn('[Main] getResolvedCookiesPath:', e?.message);
  }
  return null;
}

function killProcessTree(pid: number | undefined) {
  if (!pid) return;
  try {
    if (process.platform === 'win32') {
      execSync(`taskkill /pid ${pid} /T /F`, { stdio: 'ignore' });
    } else {
      process.kill(-pid, 'SIGKILL');
    }
  } catch (err) {
    log.warn('[Main] Failed to kill process tree for PID', pid);
  }
}

// ── IPC Handlers ─────────────────────────────────────────────────────────────
function setupIpcHandlers() {
  // ── fetch-video-info ──────────────────────────────────────────────────────
  ipcMain.handle('fetch-video-info', async (_: any, rawUrl: string) => {
    log.info(`[IPC] fetch-video-info called for: ${rawUrl}`);

    // Basic URL validation
    try {
      new URL(rawUrl);
    } catch {
      return {
        success: false,
        error: "That doesn't look like a valid URL. Please paste a full video link.",
      };
    }

    try {
      const settings = getQuery(db, 'SELECT detect_playlists FROM settings WHERE id = 1');
      const detectPlaylistsEnabled = settings?.detect_playlists === 1;
      const cookiesFile = getResolvedCookiesPath();

      const playlistCheck = detectPlaylist(rawUrl);

      if (playlistCheck.isPlaylist) {
        if (!detectPlaylistsEnabled) {
          // Toggle OFF: Download only single video, ignore playlist context
          const urlToUse = cleanVideoUrl(rawUrl);
          const info = await extractVideoInfo(urlToUse, {
            ytDlp: ytDlpPath,
            ffmpeg: ffmpegPath,
            streamlink: streamlinkPath,
            nm3u8dl: n_m3u8dlPath,
            galleryDl: galleryDlPath,
            cookiesFile,
          });

          return {
            success: true,
            data: Array.isArray(info) ? info[0] : info,
            meta: {
              playlistDetected: true,
              detectPlaylistsEnabled: false,
              collapsedToSingle: true,
              playlistTitle: 'Playlist',
              playlistVideoCount: 0,
            },
          };
        }

        // Toggle ON: Detect playlist and stream it
        // We do NOT await this. It runs in the background.
        streamPlaylistInfo(
          rawUrl,
          { ytDlp: ytDlpPath, cookiesFile },
          (video: any, index: number, total: number) => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('playlist-video-detected', {
                video,
                index,
                total,
              });
            }
          },
          (metadata: { title: string; uploader: string; videoCount: number }) => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('playlist-detection-complete', {
                title: metadata.title,
                count: metadata.videoCount,
                uploader: metadata.uploader,
              });
            }
          },
          (err: Error) => {
            log.error(`[Extractor] Playlist stream error: ${err.message}`);
            // Ends the dialog's loading state; without this it spun forever.
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('playlist-detection-complete', {
                title: 'Playlist',
                count: 0,
                uploader: '',
                error: translateDownloadError(err.message, null, rawUrl),
              });
            }
          }
        );

        // Notify the frontend to open the PlaylistDialog immediately
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('playlist-detected', {
            title: 'Loading Playlist...',
            count: 0,
            entries: [],
            streaming: true,
          });
        }

        return {
          success: true,
          data: { isPlaylist: true, streaming: true, videos: [] },
          meta: {
            playlistDetected: true,
            detectPlaylistsEnabled: true,
            collapsedToSingle: false,
            playlistTitle: 'Loading Playlist...',
            playlistVideoCount: 0,
          },
        };
      }

      // Treat as SINGLE video (even if the URL also contains a `list=` param).
      const urlToUse = cleanVideoUrl(rawUrl);
      const info = await extractVideoInfo(urlToUse, {
        ytDlp: ytDlpPath,
        ffmpeg: ffmpegPath,
        streamlink: streamlinkPath,
        nm3u8dl: n_m3u8dlPath,
        galleryDl: galleryDlPath,
        cookiesFile,
      });

      return {
        success: true,
        data: Array.isArray(info) ? info[0] : info,
        meta: {
          playlistDetected: false,
          detectPlaylistsEnabled,
          collapsedToSingle: false,
        },
      };
    } catch (error: any) {
      log.error(`[IPC Error] fetch-video-info failed: ${error.message}`);
      // An engine failure's message starts with the whole command line (user agent, cookie
      // file path…), which must not steer the wording; the engine's error lines do.
      const raw: string = error?.stderr || error?.stdout || error?.message || String(error);
      const errorLines = raw.split('\n').filter(isEngineErrorLine).join('\n');
      return {
        success: false,
        error: translateDownloadError(errorLines || error?.message || raw, null, rawUrl),
      };
    }
  });

  // ── start-download ────────────────────────────────────────────────────────
  ipcMain.handle('start-download', async (_: any, options: any) => {
    log.info('[DOWNLOAD] Received start-download request:', options);

    if (!options) {
      throw new Error('No download options provided');
    }

    const url = typeof options.url === 'string' && options.url.trim() ? options.url.trim() : null;

    const filename =
      typeof options.filename === 'string' && options.filename.trim()
        ? options.filename.trim()
        : null;

    // Validate required fields to prevent SQLite binding errors (undefined).
    if (!url) throw new Error('Invalid or missing URL');
    if (!filename) throw new Error('Invalid or missing filename');

    const formatId =
      typeof options.formatId === 'string' && options.formatId.trim()
        ? options.formatId.trim()
        : null;

    // FFmpeg is now handled asynchronously within processQueue.
    // The download starts instantly in the background if needed,
    // allowing this IPC handler to return a response to the UI in <10ms.

    const optionsSavePath =
      typeof options.savePath === 'string' && options.savePath.trim()
        ? options.savePath.trim()
        : undefined;

    const thumbnail =
      typeof options.thumbnail === 'string' && options.thumbnail.trim()
        ? options.thumbnail.trim()
        : null;

    const uploader =
      typeof options.uploader === 'string' && options.uploader.trim()
        ? options.uploader.trim()
        : null;

    const duration =
      typeof options.duration === 'number' && Number.isFinite(options.duration)
        ? options.duration
        : null;

    const saveFolder = optionsSavePath || getDefaultSavePath();
    const outputPath = path.join(saveFolder, filename);

    log.info('Saving download to:', outputPath);

    if (!fs.existsSync(saveFolder)) {
      fs.mkdirSync(saveFolder, { recursive: true });
    }

    // Duplicate URL detection — warn if same URL is already downloading
    const existing = allQuery(
      db,
      "SELECT id, state FROM downloads WHERE url = ? AND state IN ('downloading', 'queued', 'paused')",
      [url],
    );
    if (existing.length > 0) {
      throw new Error('This video is already in your download queue.');
    }

    // Pre-flight disk space check: ensure at least 50MB of free space
    const freeSpace = await getFreeSpace(saveFolder);
    if (freeSpace < 50 * 1024 * 1024) {
      throw new Error('Insufficient disk space. Please free up some space before downloading.');
    }

    db.run(
      `
      INSERT INTO downloads (url, filename, thumbnail, duration, uploader, format_id, state, save_path)
      VALUES (?, ?, ?, ?, ?, ?, 'queued', ?)
    `,
      [
        url,
        filename,
        thumbnail ?? null,
        duration ?? null,
        uploader ?? null,
        formatId ?? null,
        outputPath,
      ],
    );
    // Read the id before saving: sql.js export() reopens the connection, which resets it to 0.
    const downloadId = getQuery(db, 'SELECT last_insert_rowid() as id').id;
    saveDatabase(db);

    processQueue();
    return { id: downloadId };
  });

  // ── restart-download ──────────────────────────────────────────────────────

  ipcMain.handle('restart-download', async (_: any, id: number) => {
    const dl = getQuery(db, 'SELECT * FROM downloads WHERE id = ?', [id]);
    if (!dl) throw new Error('Download not found');

    // Kill existing process if any
    const existing = activeTasks.get(id);
    if (existing) {
      killProcessTree(existing.process.pid);
      activeTasks.delete(id);
    }

    updateDownloadInDb(id, { state: 'queued', error: null, received_bytes: 0 });
    processQueue();
    return { id };
  });

  // ── pause-download ────────────────────────────────────────────────────────
  ipcMain.handle('pause-download', async (_: any, id: number) => {
    // Handle both number and string conversions safely for IPC compatibility
    const numericId = Number(id);
    const job = activeTasks.get(numericId);
    if (job) {
      log.info('[PAUSE] Pausing job:', numericId);
      // Mark paused before killing to avoid race with process "close" handler.
      taskStopReasons.set(numericId, 'paused');
      updateDownloadInDb(numericId, { state: 'paused' });
      killProcessTree(job.process.pid);
      activeTasks.delete(numericId);
      updatePowerSave();

      if (mainWindow) {
        mainWindow.webContents.send('download-progress', {
          jobId: String(numericId),
          id: numericId,
          phase: 'Paused',
          status: 'paused',
        });
      }
    } else {
      log.warn('[PAUSE] No active job found for:', numericId);
      updateDownloadInDb(numericId, { state: 'paused' });
    }
    updateTaskbarProgress();
    processQueue();
    return { success: true };
  });

  // ── resume-download ───────────────────────────────────────────────────────
  ipcMain.handle('resume-download', async (_: any, id: number) => {
    const numericId = Number(id);
    log.info('[RESUME] Resuming job:', numericId);
    const dl = getQuery(db, 'SELECT * FROM downloads WHERE id = ?', [numericId]);
    if (!dl) throw new Error('Download not found');

    const existing = activeTasks.get(numericId);
    if (existing) {
      taskStopReasons.delete(numericId);
      killProcessTree(existing.process.pid);
      activeTasks.delete(numericId);
    }

    updateDownloadInDb(numericId, { state: 'queued', error: null });
    processQueue();
    return { id: numericId };
  });

  // ── cancel-download ───────────────────────────────────────────────────────
  ipcMain.handle('cancel-download', async (_: any, id: number) => {
    const numericId = Number(id);
    const job = activeTasks.get(numericId);
    if (job) {
      log.info('[CANCEL] Cancelling job:', numericId);
      taskStopReasons.set(numericId, 'cancelled');
      updateDownloadInDb(numericId, { state: 'cancelled' });
      killProcessTree(job.process.pid);
      activeTasks.delete(numericId);
      updatePowerSave();
    }

    // Queued and paused downloads have partial data too, so this does not depend on `job`.
    const dl = getQuery(db, 'SELECT save_path, state FROM downloads WHERE id = ?', [numericId]);
    if (dl && dl.state !== 'completed') discardPartialDownload(numericId, dl.save_path, job?.recording);

    updateDownloadInDb(numericId, { state: 'cancelled' });
    if (mainWindow) {
      mainWindow.webContents.send('download-progress', {
        jobId: String(numericId),
        id: numericId,
        percent: 0,
        phase: 'Cancelled',
        status: 'cancelled',
      });
    }
    updateTaskbarProgress();
    processQueue();
    return { success: true };
  });

  // ── delete-download ───────────────────────────────────────────────────────
  ipcMain.handle('delete-download', async (_: any, id: number) => {
    const job = activeTasks.get(Number(id));
    if (job) {
      taskStopReasons.set(Number(id), 'cancelled');
      killProcessTree(job.process.pid);
      activeTasks.delete(Number(id));
      updatePowerSave();
    }

    const dl = getQuery(db, 'SELECT save_path, state FROM downloads WHERE id = ?', [id]);
    if (dl && dl.state !== 'completed') discardPartialDownload(Number(id), dl.save_path, job?.recording);

    db.run('DELETE FROM downloads WHERE id = ?', [id]);
    saveDatabase(db);
    updateTaskbarProgress();
    processQueue();
    return { success: true };
  });

  // ── open-file-path ────────────────────────────────────────────────────────
  ipcMain.handle('open-file-path', async (_: any, filePath: string) => {
    // shell.openPath runs executables too, so only what this app finished downloading.
    const known = getQuery(db, "SELECT 1 AS ok FROM downloads WHERE state = 'completed' AND save_path = ?", [
      String(filePath),
    ]);
    if (!known) throw new Error('Only finished downloads can be opened from here.');
    const result = await shell.openPath(filePath);
    if (result) {
      throw new Error(`Could not open file: ${result}`);
    }
    return { success: true };
  });

  // ── open-folder ───────────────────────────────────────────────────
  ipcMain.handle('open-folder', async (_: any, targetPath: string) => {
    try {
      log.info('[Main] open-folder called with:', targetPath);

      // If path doesn't exist, open the default Downloads folder
      if (!targetPath || typeof targetPath !== 'string') {
        log.warn('[Main] No path provided, opening Downloads folder');
        await shell.openPath(app.getPath('downloads'));
        return { success: true };
      }

      if (!fs.existsSync(targetPath)) {
        log.warn('[Main] Path does not exist, opening Downloads folder:', targetPath);
        await shell.openPath(app.getPath('downloads'));
        return { success: true };
      }

      const stat = fs.statSync(targetPath);
      if (stat.isDirectory()) {
        log.info('[Main] Opening folder:', targetPath);
        await shell.openPath(targetPath);
      } else {
        log.info('[Main] Showing item in folder:', targetPath);
        shell.showItemInFolder(targetPath);
      }

      return { success: true };
    } catch (error: any) {
      log.error('[Main] Failed to open folder:', error);
      // Fallback: system Downloads folder
      await shell.openPath(app.getPath('downloads'));
      return { success: true, fallback: true };
    }
  });

  // ── choose-save-folder ────────────────────────────────────────────────────
  ipcMain.handle('choose-save-folder', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openDirectory'],
    });
    if (!result.canceled) {
      return result.filePaths[0];
    }
    return null;
  });

  ipcMain.handle('choose-cookies-file', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      title: 'Select browser cookies file',
      properties: ['openFile'],
      filters: [
        { name: 'Cookies / text', extensions: ['txt', 'cookies'] },
        { name: 'All files', extensions: ['*'] },
      ],
    });
    if (!result.canceled && result.filePaths[0]) {
      return result.filePaths[0];
    }
    return null;
  });

  // ── check-disk-space ──────────────────────────────────────────────────────
  ipcMain.handle(
    'check-disk-space',
    async (
      _: any,
      { path: targetPath, requiredBytes }: { path: string; requiredBytes: number },
    ) => {
      const freeSpace = await getFreeSpace(targetPath || getDefaultSavePath());
      const estimatedBytes =
        requiredBytes <= 0 || requiredBytes > 10 * 1024 * 1024 * 1024
          ? 500 * 1024 * 1024
          : requiredBytes;

      const buffer = 100 * 1024 * 1024; // 100MB buffer
      return {
        isEnough: freeSpace > estimatedBytes + buffer,
        freeSpace,
        required: estimatedBytes + buffer,
      };
    },
  );

  // ── get-download-history ──────────────────────────────────────────────────
  ipcMain.handle('get-download-history', async () => {
    return allQuery(db, 'SELECT * FROM downloads ORDER BY created_at DESC');
  });

  // ── clear-history ─────────────────────────────────────────────────────────
  ipcMain.handle('clear-history', async (_: any, type: 'all' | 'completed' | 'failed' = 'all') => {
    clearHistory(type);
    return { success: true };
  });

  // ── get-settings ──────────────────────────────────────────────────────────
  ipcMain.handle('get-settings', async () => {
    return getQuery(db, 'SELECT * FROM settings WHERE id = 1');
  });

  // ── save-settings ─────────────────────────────────────────────────────────
  ipcMain.handle('save-settings', async (_: any, settings: any) => {
    log.info('[IPC] save-settings called with:', settings);
    try {
      // Keys become column names in the SQL text, so only real columns get through.
      const columns = new Set(allQuery(db, 'PRAGMA table_info(settings)').map((c) => c.name));
      columns.delete('id');
      const entries = Object.entries(settings ?? {})
        .map(([k, v]) => [k.replace(/[A-Z]/g, (l) => `_${l.toLowerCase()}`), v] as const)
        .filter(([k]) => columns.has(k));

      if (entries.length > 0) {
        db.run(
          `UPDATE settings SET ${entries.map(([k]) => `${k} = ?`).join(', ')} WHERE id = 1`,
          entries.map(([, v]) => v),
        );
        saveDatabase(db);
      }
      // A higher download limit should start waiting downloads now, not after the next one ends.
      processQueue();
      return getQuery(db, 'SELECT * FROM settings WHERE id = 1');
    } catch (error: any) {
      log.error(`[IPC Error] save-settings failed: ${error.message}`);
      throw error;
    }
  });

  // ── open-external ─────────────────────────────────────────────────────────
  ipcMain.handle('open-external', async (_: any, url: string) => {
    try {
      if (isAllowedExternalUrl(url)) {
        await shell.openExternal(url);
        return { success: true };
      } else {
        log.warn(`[IPC] Blocked external URL: ${url}`);
        throw new Error('External URL not allowed');
      }
    } catch (error: any) {
      log.error(`[IPC Error] open-external failed: ${error.message}`);
      throw error;
    }
  });

  // ── get-app-version ───────────────────────────────────────────────
  ipcMain.handle('get-app-version', async () => {
    return { version: app.getVersion() };
  });

  // ── reset-settings ────────────────────────────────────────────────────────
  ipcMain.handle('reset-settings', async () => {
    const defaultPath = app.getPath('downloads').replace(/\\/g, '/');
    db.run(
      `
      UPDATE settings SET
        theme = 'system',
        max_concurrent_downloads = 3,
        auto_capture = 1,
        file_types = '["mp4","mp3","zip","exe","pdf","jpg","png"]',
        download_path = ?,
        default_quality = 'best',
        default_format = 'mp4',
        detect_playlists = 1,
        playlist_download_mode = 'all',
        create_playlist_folder = 1,
        eula_age_acknowledged = 0,
        cookies_file_path = '',
        close_to_tray = 1
      WHERE id = 1
    `,
      [defaultPath],
    );
    saveDatabase(db);
    return getQuery(db, 'SELECT * FROM settings WHERE id = 1');
  });

  // ── get-app-version ───────────────────────────────────────────────────────
  ipcMain.handle('get-default-download-path', () => app.getPath('downloads'));

  // ── update-ytdlp ──────────────────────────────────────────────────────────
  ipcMain.handle('update-ytdlp', async () => {
    try {
      log.info('[IPC] Manual update-ytdlp triggered');
      const result = await performYtDlpUpdate();
      return result; // { updated: boolean, version: string }
    } catch (error: any) {
      log.error(`[IPC Error] update-ytdlp failed: ${error.message}`);
      throw new Error(`Update failed: ${error.message}`);
    }
  });

  // ── get-ytdlp-version ─────────────────────────────────────────────────────
  ipcMain.handle('get-ytdlp-version', async () => {
    return await getCurrentYtDlpVersion();
  });

  // ── check-all-binary-updates ───────────────────────────────────────────────
  ipcMain.handle('check-all-binary-updates', async () => {
    try {
      // Check all binaries in parallel instead of sequential
      const results = await Promise.all(
        BINARIES.map(async (binary) => {
          const [installedVersion, latestVersion] = await Promise.all([
            getBinaryVersion(binary),
            getLatestBinaryVersion(binary),
          ]);

          // Compare the dotted number only: tools print "streamlink 8.2.1" or "0.5.1+c1f6…"
          // while their tags read "8.6.1-1" or "v0.6.0-beta".
          const normalizeVersion = (v: string) => v.match(/\d+(?:\.\d+)+/)?.[0] ?? v;
          const normalizedInstalled = normalizeVersion(installedVersion);
          const normalizedLatest = normalizeVersion(latestVersion);

          // For N_m3u8DL-RE, use dynamic asset finder
          let downloadUrl: string | null = null;
          if (binary.downloadUrl === null) {
            // Will be resolved during update
            downloadUrl = null;
          } else {
            downloadUrl = binary.downloadUrl(latestVersion);
          }

          return {
            name: binary.name,
            installedVersion,
            latestVersion,
            // 'Unknown' means a lookup failed; that is not evidence an update exists.
            needsUpdate:
              installedVersion !== 'Unknown' &&
              latestVersion !== 'Unknown' &&
              normalizedInstalled !== normalizedLatest,
            downloadUrl,
          };
        }),
      );

      return results;
    } catch (error: any) {
      log.error(`[IPC Error] check-all-binary-updates failed: ${error.message}`);
      throw new Error(`Failed to check updates: ${error.message}`);
    }
  });

  // ── update-binary ───────────────────────────────────────────────────────────
  ipcMain.handle('update-binary', async (_: any, binaryNameOrObj: string | { binaryName: string }) => {
    // Handle both string and object formats for backwards compatibility
    const binaryName = typeof binaryNameOrObj === 'string' ? binaryNameOrObj : binaryNameOrObj.binaryName;
    
    try {
      const binary = BINARIES.find((b) => b.name === binaryName);
      if (!binary) {
        throw new Error(`Unknown binary: ${binaryName}`);
      }

      // Windows cannot replace an executable that is running.
      const engine = binary.name === 'N_m3u8DL-RE' ? 'n-m3u8dl' : binary.name;
      if ([...activeTasks.values()].some((t) => t.engine === engine)) {
        return { success: false, newVersion: '', error: `${binary.name} is downloading right now. Pause those downloads, then update.` };
      }

      log.info(`[IPC] Updating ${binaryName}...`);
      const result = await performBinaryUpdate(binary);
      return result;
    } catch (error: any) {
      log.error(`[IPC Error] update-binary failed for ${binaryName}: ${error.message}`);
      throw new Error(`Update failed: ${error.message}`);
    }
  });

  // ── get-binary-version ───────────────────────────────────────────────────────
  async function getBinaryVersion(binary: (typeof BINARIES)[0]): Promise<string> {
    try {
      // Check userData first (updated binaries go here), then packaged resources
      const userDataBin = path.join(app.getPath('userData'), 'binaries', binary.fileName);
      const packagedBin = path.join(binariesPath, binary.fileName);
      const binaryPath = fs.existsSync(userDataBin) ? userDataBin : packagedBin;
      if (!fs.existsSync(binaryPath)) {
        return 'Not installed';
      }

      // execFileSync, not execSync: no shell parses this, so a path containing
      // a quote cannot terminate the command and start another one.
      const output = execFileSync(binaryPath, [binary.versionFlag], { encoding: 'utf8' });
      const version = output.split('\n')[0].trim();
      return version;
    } catch (error: any) {
      log.error(`Failed to get version for ${binary.name}: ${error.message}`);
      return 'Unknown';
    }
  }

  async function getLatestBinaryVersion(binary: (typeof BINARIES)[0]): Promise<string> {
    try {
      const release = await fetchJson(binary.releaseApi);
      return release.tag_name;
    } catch (error: any) {
      log.error(`Failed to fetch latest version for ${binary.name}: ${error.message}`);
      return 'Unknown';
    }
  }

  async function performBinaryUpdate(
    binary: (typeof BINARIES)[0],
  ): Promise<{ success: boolean; newVersion: string; error?: string }> {
    try {
      const release = await fetchJson(binary.releaseApi);
      const latestVersion = release.tag_name;

      // Get download URL - some asset names embed more than the tag, so find them in the release
      let downloadUrl: string;
      if (binary.downloadUrl === null) {
        const asset = binary.assetPattern && getAssetDownloadUrl(release, binary.assetPattern);
        if (!asset) {
          throw new Error(`Could not find download asset for ${binary.name}`);
        }
        downloadUrl = asset;
      } else {
        downloadUrl = binary.downloadUrl(latestVersion);
      }

      // The release listing carries a `digest` per asset ("sha256:<hex>"). Look
      // up the one we are about to fetch so the bytes can be checked before
      // anything executes them. Absent for publishers that don't emit digests,
      // in which case verifyFileDigest logs and moves on.
      const assetMeta = (release.assets || []).find(
        (a: any) => a.browser_download_url === downloadUrl,
      );

      const tempPath = path.join(app.getPath('temp'), `${binary.name}.tmp`);

      // Destination: userData/binaries (always writable, even in Program Files installs)
      const userDataBinariesPath = path.join(app.getPath('userData'), 'binaries');
      if (!fs.existsSync(userDataBinariesPath)) {
        fs.mkdirSync(userDataBinariesPath, { recursive: true });
      }
      const destPath = path.join(userDataBinariesPath, binary.fileName);

      // Download to temp
      const response = await fetch(downloadUrl);
      if (!response.ok) {
        throw new Error(`Failed to download ${binary.name}: ${response.statusText}`);
      }

      const buffer = await response.arrayBuffer();
      fs.writeFileSync(tempPath, Buffer.from(buffer));

      try {
        await verifyFileDigest(tempPath, assetMeta?.digest);
      } catch (err) {
        fs.unlinkSync(tempPath);
        throw err;
      }

      // Handle zip files
      if (binary.isZip) {
        const tempDir = path.join(app.getPath('temp'), `${binary.name}_extract`);
        // Start empty: a leftover from an interrupted update would be picked up below.
        fs.rmSync(tempDir, { recursive: true, force: true });
        fs.mkdirSync(tempDir, { recursive: true });

        // Extract using PowerShell (built-in). Paths travel in the environment
        // rather than inside the command text: execFileSync skips the shell,
        // and $env: lookups are values to PowerShell, not source it re-parses,
        // so nothing in a path can close a quote and append a second command.
        execFileSync('powershell', [...PS_FLAGS, '-Command', PS_EXPAND_ARCHIVE], {
          cwd: app.getPath('temp'),
          env: { ...process.env, IDH_ARCHIVE: tempPath, IDH_DEST: tempDir },
        });

        if (binary.keepDir) {
          const [root] = fs.readdirSync(tempDir);
          const finalDir = path.join(userDataBinariesPath, binary.keepDir);
          // Its bundled ffmpeg is 164 MB; downloads pass --ffmpeg-ffmpeg instead.
          fs.rmSync(path.join(tempDir, root, 'ffmpeg'), { recursive: true, force: true });
          fs.rmSync(finalDir, { recursive: true, force: true });
          // cpSync, not rename: temp and userData can sit on different drives.
          fs.cpSync(path.join(tempDir, root), finalDir, { recursive: true });
          fs.rmSync(tempDir, { recursive: true, force: true });
        } else {
          // Find the specific .exe file in extracted files
          const findSpecificExe = (dir: string, fileName: string): string | null => {
            const files = fs.readdirSync(dir);
            // First try exact match
            if (files.includes(fileName)) {
              return path.join(dir, fileName);
            }
            // Then search recursively
            for (const file of files) {
              const fullPath = path.join(dir, file);
              const stat = fs.statSync(fullPath);
              if (stat.isDirectory()) {
                const found = findSpecificExe(fullPath, fileName);
                if (found) return found;
              } else if (file === fileName) {
                return fullPath;
              }
            }
            return null;
          };

          const exePath = findSpecificExe(tempDir, binary.fileName);
          if (!exePath) {
            throw new Error(`Could not find ${binary.fileName} in extracted archive`);
          }

          fs.copyFileSync(exePath, destPath);

          // Clean up
          fs.rmSync(tempDir, { recursive: true, force: true });
        }
      } else {
        // Direct copy for .exe files
        fs.copyFileSync(tempPath, destPath);
      }

      // Clean up temp file
      fs.unlinkSync(tempPath);
      // Point the engine paths at the new userData copy now, not on the next launch.
      setupPaths();

      log.info(`[UPDATE] ${binary.name} successfully updated to ${latestVersion} in userData`);
      return { success: true, newVersion: latestVersion };
    } catch (error: any) {
      log.error(`Failed to update ${binary.name}: ${error.message}`);
      return { success: false, newVersion: '', error: error.message };
    }
  }

  // ── check-ytdlp-version ───────────────────────────────────────────────────────
  ipcMain.handle('check-ytdlp-version', async () => {
    return await checkYtDlpVersion();
  });

  // ── add-playlist-to-queue ───────────────────────────────────────────────────
  ipcMain.handle(
    'add-playlist-to-queue',
    async (
      _: any,
      {
        entries,
        options,
      }: {
        entries: Array<any>;
        options: {
          savePath?: string;
          createFolder?: boolean;
          playlistTitle?: string;
        };
      },
    ) => {
      log.info(`[IPC] add-playlist-to-queue called with ${entries.length} entries`);

      try {
        const settings = getQuery(db, 'SELECT * FROM settings WHERE id = 1');
        const baseSavePath = options.savePath || settings?.download_path || settings?.downloadPath;
        const createFolder = options.createFolder ?? (settings?.create_playlist_folder !== 0);

        let playlistFolderPath = baseSavePath;
        if (createFolder && options.playlistTitle) {
          const playlistFolderName = options.playlistTitle
            .replace(/[<>:"/\\|?*]/g, '')
            .trim()
            .slice(0, 100);
          playlistFolderPath = path.join(baseSavePath, playlistFolderName || 'Playlist');

          // Ensure playlist folder exists
          if (!fs.existsSync(playlistFolderPath)) {
            fs.mkdirSync(playlistFolderPath, { recursive: true });
          }
        }

        let addedCount = 0;
        for (let i = 0; i < entries.length; i++) {
          const entry = entries[i];
          try {
            // Entries can come from dialog as { index, url, title, thumbnail }
            // OR from streaming as { video: { url, title, thumbnail, formats, ... }, index }
            const video = entry.video || entry;
            const idx = entry.index || i + 1;

            // Determine format based on settings
            const prefQuality = settings?.default_quality || 'best';
            const prefFormat = settings?.default_format || 'mp4';
            // First check if the user had overridden the selection from UI
            let formatId = entry.selectedFormat || 'bestvideo+bestaudio';

            if (!entry.selectedFormat) {
              if (prefFormat === 'mp3') {
                formatId = 'bestaudio';
              } else if (prefQuality !== 'best') {
                const targetQuality = prefQuality + 'p';
                const match = video.formats?.find((f: any) => f.quality === targetQuality);
                formatId = match ? match.formatId : 'bestvideo+bestaudio';
              }
            }

            const cleanTitle = video.title || entry.title || 'video';
            const sanitizedName = cleanTitle.replace(/[^a-z0-9]/gi, '_').slice(0, 50);
            const isAudioOnly = formatId === 'bestaudio';
            const ext = isAudioOnly
              ? 'mp3'
              : video.formats?.find((f: any) => f.formatId === formatId)?.ext || 'mp4';

            // For playlist downloads, include playlist index in filename
            const filename = createFolder
              ? `${idx.toString().padStart(2, '0')} - ${sanitizedName}.${ext}`
              : `${sanitizedName}.${ext}`;

            // Create download entry directly in database
            const outputPath = path.join(playlistFolderPath, filename);
            db.run(
              `
            INSERT INTO downloads (
              url, filename, format_id, save_path, thumbnail, duration, uploader,
              state, created_at, playlist_title, playlist_index, playlist_total
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 'queued', datetime('now'), ?, ?, ?)
          `,
              [
                video.url,
                filename,
                formatId,
                outputPath,
                video.thumbnail ?? null,
                video.duration ?? null,
                video.uploader ?? null,
                options.playlistTitle ?? null,
                idx,
                entries.length,
              ],
            );
            saveDatabase(db);
            addedCount++;
          } catch (error: any) {
            log.error(`[IPC Error] Failed to add playlist entry: ${error.message}`);
          }
        }

        // Process the queue - respects max_concurrent_downloads setting
        processQueue();

        return { success: true, addedCount };
      } catch (error: any) {
        log.error(`[IPC Error] add-playlist-to-queue failed: ${error.message}`);
        throw new Error(`Failed to add playlist to queue: ${error.message}`);
      }
    },
  );

  // ── Menu-driven IPC events (main → renderer) ──────────────────────────────
  // These let menu items communicate with the React renderer

  ipcMain.on('menu:navigate', (_event, tabPath: string) => {
    if (mainWindow) mainWindow.webContents.send('navigate-to-tab', tabPath);
  });
}

// Prefixes the line yt-dlp prints with the finished file's path.
const FINAL_PATH_MARK = 'IDH_FILE:';

// yt-dlp's default favours AV1 video and Opus audio, which Windows' own player cannot play
// in an MP4 without extra codecs. Resolution still comes first; at that resolution, H.264
// and AAC win when the site offers them (yt-dlp's own `-t mp4` preset puts codec first
// and so stops at 1080p on YouTube).
const MP4_FRIENDLY_SORT = ['-S', 'lang,quality,res,fps,vcodec:h264,acodec:aac'];

/** Undoes path.toNamespacedPath: \\?\C:\x -> C:\x and \\?\UNC\host\x -> \\host\x. */
function withoutNamespace(p: string): string {
  return p.replace(/^\\\\\?\\UNC\\/, '\\\\').replace(/^\\\\\?\\/, '');
}

/** Applies cleanFilename to a finished file, unless that name is taken or comes out empty. */
function tidyFileName(file: string): string {
  const { dir, name, ext } = path.parse(file);
  const clean = cleanFilename(name);
  const target = path.join(dir, clean + ext);
  if (!clean || target === file || fs.existsSync(target)) return file;
  try {
    fs.renameSync(file, target);
    return target;
  } catch {
    return file;
  }
}

// ── Spawn Download (shared logic) ─────────────────────────────────────────────
function spawnDownload(
  downloadId: number,
  url: string,
  outputPath: string,
  formatId?: string | null,
  isResume: boolean = false,
  youtubePlayerClient?: YoutubePlayerClient,
  engineIndex: number = 0,
  primaryError: string = '',
): { id: number } {
  taskStopReasons.delete(downloadId);
  const engines = downloadEnginesFor(url, formatId);
  const current = engines[engineIndex] ?? { engine: 'yt-dlp' as Engine, binary: ytDlpPath };
  const hasNextEngine = engineIndex + 1 < engines.length;
  // Used for translating yt-dlp failures reliably (close handler only gives the exit code).
  let lastStderrOutput = '';
  let aggregatedStderr = '';
  // Failure lines from either stream: streamlink reports errors on stdout.
  const errorLines: string[] = [];
  // The finished file or folder. yt-dlp only knows it after merging, and prints it then.
  let actualFilePath: string | null = null;

  // Build the yt-dlp format argument intelligently
  let formatArg: string;
  // 'best' comes from streamlink/gallery-dl extraction; as `best+bestaudio` it fails on
  // streams that have no audio-only format, which is exactly when yt-dlp is the fallback.
  if (formatId === 'bestvideo+bestaudio' || formatId === 'best' || !formatId) {
    formatArg = 'bestvideo+bestaudio/best';
  } else if (formatId === 'bestaudio') {
    formatArg = 'bestaudio/best';
  } else if (formatId.includes('+bestaudio') || formatId.includes('bestvideo[')) {
    // Fallback formatIds like 'bestvideo[height=1080]+bestaudio/best[height=1080]'
    // are already complete yt-dlp format expressions — use as-is
    formatArg = formatId;
  } else {
    // Simple format ID (e.g., '137', '248'): merge in the best audio. Most HLS streams have
    // no audio-only format, where that selector fails, so the format alone is the fallback.
    formatArg = `${formatId}+bestaudio/${formatId}`;
  }

  const saveFolder = path.dirname(outputPath);
  const stem = path.parse(outputPath).name;
  const tempDir = jobTempDir(saveFolder, downloadId);
  let recording: string | null = null;
  // Engines get \\?\ paths: Python otherwise stops at 260 characters, which a long title
  // in a nested folder reaches. Node's fs adds the prefix itself.
  const long = path.toNamespacedPath;

  const cookiesPath = getResolvedCookiesPath();

  const binaryPath = current.binary;
  log.info(`[DOWNLOAD] Job ${downloadId} using engine ${current.engine} (${engineIndex + 1}/${engines.length})`);

  let downloadArgs: string[] = [];

  if (current.engine === 'yt-dlp') {
    downloadArgs = [
      // Without this yt-dlp prints in the system code page and silently drops every
      // character it lacks, so a non-English title came back as a path that does not exist.
      '--encoding',
      'utf-8',
      '--newline',
      '--progress',
      '--no-colors',
      '--no-warnings',
      // The finished path, after merging and audio extraction. --no-quiet: --print implies --quiet.
      '--no-quiet',
      '--print',
      `after_move:${FINAL_PATH_MARK}%(filepath)s`,
      ...ytDlpCommonArgs(url, {
        noPlaylist: true,
        ...(youtubePlayerClient !== undefined ? { youtubePlayerClient } : {}),
      }),
      ...ytDlpCookiesArgs(cookiesPath),
      '--windows-filenames',
      '--trim-filenames',
      '200',
      '-f',
      formatArg,
      // "Audio Only (MP3)" used to save whatever container the audio came in.
      ...(formatId === 'bestaudio' ? ['-x', '--audio-format', 'mp3'] : ['--merge-output-format', 'mp4', ...MP4_FRIENDLY_SORT]),
      '--ffmpeg-location',
      ffmpegPath,
      // Partial files stay in the job's scratch folder until yt-dlp moves the result home.
      // -o must be relative for -P to apply.
      '-P',
      `home:${long(saveFolder)}`,
      '-P',
      `temp:${long(tempDir)}`,
      '-o',
      '%(title)s.%(ext)s',
    ];
    if (isResume) {
      downloadArgs.unshift('--continue');
    }
    downloadArgs.push('--', url);
  } else if (current.engine === 'gallery-dl') {
    // -D, not -d: -d nests files under <category>/<id>/, so the recorded path pointed at nothing.
    // The gallery gets its own folder, and that folder is what the queue opens.
    actualFilePath = path.join(saveFolder, stem);
    // gallery-dl extends -D itself, but not the part directory.
    downloadArgs = ['-D', actualFilePath, '-o', `downloader.part-directory=${long(tempDir)}`, '--', url];
  } else if (current.engine === 'streamlink') {
    // Records straight into the save folder, so a stopped live stream still leaves a playable
    // file; a new name each run, so resuming never overwrites what was recorded before.
    recording = actualFilePath = uniquePath(path.join(saveFolder, `${stem}.ts`));
    downloadArgs = ['--progress=force', '--hls-live-restart', '--ffmpeg-ffmpeg', ffmpegPath,
      '--ffmpeg-fout', 'mpegts', '-o', long(recording), url, 'best'];
  } else if (current.engine === 'n-m3u8dl') {
    // --auto-select: without it N_m3u8DL-RE prompts for tracks, and with no terminal it exits 1.
    // --tmp-dir: the default is the working directory, i.e. the read-only install folder.
    actualFilePath = path.join(saveFolder, `${stem}.mp4`);
    downloadArgs = [url, '--save-dir', long(saveFolder), '--tmp-dir', long(tempDir), '--save-name', stem,
      '--auto-select', '--no-log', '--no-ansi-color', '--ffmpeg-binary-path', ffmpegPath, '-M', 'format=mp4'];
  }

  log.info('[PROGRESS-AUDIT] Download started for jobId:', downloadId);
  log.info('[PROGRESS-AUDIT] Download command:', binaryPath, downloadArgs.join(' '));

  const downloadProcess = spawn(binaryPath, downloadArgs);

  activeTasks.set(downloadId, { process: downloadProcess, engine: current.engine, recording });
  updatePowerSave();

  const sendProgress = (data: Record<string, unknown>) => {
    mainWindow?.webContents.send('download-progress', {
      jobId: String(downloadId),
      id: downloadId,
      phase: 'Downloading',
      status: 'downloading',
      ...data,
    });
  };
  let galleryFiles = 0;

  // stdout and stderr each keep their own unfinished line; sharing one buffer spliced them together.
  const pending = { stdout: '', stderr: '' };
  const parseYtDlpOutput = (raw: string, stream: keyof typeof pending) => {
    const jobId = downloadId;
    let combined = pending[stream] + raw;
    // N_m3u8DL-RE 0.6 writes to a pipe without line breaks; without this nothing it
    // printed would ever count as a complete line.
    if (current.engine === 'n-m3u8dl') combined = splitNm3u8dlOutput(combined);

    // Split on newlines AND carriage returns to handle both output styles
    const lines = combined.split(/[\n\r]+/);

    // Keep the last item only if it did not end with a newline (incomplete line)
    pending[stream] = combined.endsWith('\n') || combined.endsWith('\r') ? '' : lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      if (current.engine === 'yt-dlp' && trimmed.startsWith(FINAL_PATH_MARK)) {
        actualFilePath = withoutNamespace(trimmed.slice(FINAL_PATH_MARK.length));
        continue;
      }

      if (current.engine === 'gallery-dl' && stream === 'stdout' && !trimmed.startsWith('[')) {
        // One line per file: its path, or "# path" when it was already there.
        galleryFiles++;
        sendProgress({ totalSize: `${galleryFiles} file${galleryFiles === 1 ? '' : 's'} saved`, indeterminate: true });
        continue;
      }

      const engineProgress = parseEngineProgress(current.engine, trimmed);
      if (engineProgress) {
        const { percent, size, speed, eta } = engineProgress;
        const known = percent !== undefined;
        sendProgress({
          ...(known ? { percent: Math.min(percent, 99) } : { indeterminate: true }),
          totalSize: size,
          speed,
          eta: known ? formatEta(eta) : '',
        });
        if (known) mainWindow?.setProgressBar(Math.min(percent, 99) / 100);
        else mainWindow?.setProgressBar(2, { mode: 'indeterminate' });
        continue;
      }

      const progressMatch = trimmed.match(
        /\[download\]\s+([\d.]+)%(?:\s+of\s+(?:~?\s*)?([\w.\s]+?))?(?:(?:\s+in\s+[\w:]+)?\s+at\s+([\w.\s/]+?))?(?:\s+ETA\s+([\w:]+))?(?:\s+\(frag.*?\))?\s*$/i,
      );

      if (progressMatch) {
        const percent = parseFloat(progressMatch[1]);
        const totalSizeStr = progressMatch[2] ? progressMatch[2].trim() : 'Unknown';
        const speedStr = progressMatch[3] ? progressMatch[3].trim() : '';
        const etaRaw = progressMatch[4] ? progressMatch[4].trim() : '';

        const progressData = {
          jobId: String(jobId),
          id: jobId,
          percent: Math.min(percent, 99),
          totalSize: totalSizeStr,
          speed: speedStr === 'Unknown' ? '' : speedStr,
          eta: formatEta(etaRaw),
          phase: 'Downloading',
          status: 'downloading',
        };

        log.info(
          `[PROGRESS] ${jobId}: ${percent}% of ${totalSizeStr} at ${speedStr} ETA ${etaRaw}`,
        );
        if (mainWindow) {
          mainWindow.webContents.send('download-progress', progressData);
          mainWindow.setProgressBar(progressData.percent / 100);
        }

        const parseSize = (s: string): number | null => {
          const num = parseFloat(s);
          if (isNaN(num)) return null;
          const su = s.toLowerCase();
          if (su.includes('tib')) return num * 1024 * 1024 * 1024 * 1024;
          if (su.includes('gib')) return num * 1024 * 1024 * 1024;
          if (su.includes('mib')) return num * 1024 * 1024;
          if (su.includes('kib')) return num * 1024;
          return num;
        };
        const totalBytes = parseSize(totalSizeStr);
        if (totalBytes !== null) {
          const receivedBytes = Math.floor(totalBytes * (progressData.percent / 100));
          updateDownloadInDb(jobId, { totalBytes, receivedBytes });
        }
        continue;
      }

      if (trimmed.startsWith('[download] Destination:')) {
        // A scratch file in the job's temp folder; the finished path arrives with FINAL_PATH_MARK.
        if (mainWindow) {
          mainWindow.webContents.send('download-progress', {
            jobId: String(jobId),
            id: jobId,
            percent: 0,
            phase: 'Starting download...',
            status: 'downloading',
          });
        }
        continue;
      }

      if (trimmed.includes('has already been downloaded')) {
        if (mainWindow)
          mainWindow.webContents.send('download-progress', {
            jobId: String(jobId),
            id: jobId,
            percent: 100,
            phase: 'Already downloaded',
            status: 'completed',
          });
        continue;
      }

      if (
        trimmed.includes('[Merger]') ||
        trimmed.includes('Merging formats into') ||
        trimmed.includes('[ffmpeg]')
      ) {
        if (mainWindow)
          mainWindow.webContents.send('download-progress', {
            jobId: String(jobId),
            id: jobId,
            percent: 99,
            phase: 'Merging audio and video...',
            status: 'merging',
          });
        continue;
      }

      if (trimmed.includes('[ExtractAudio]')) {
        if (mainWindow)
          mainWindow.webContents.send('download-progress', {
            jobId: String(jobId),
            id: jobId,
            percent: 99,
            phase: 'Extracting audio...',
            status: 'merging',
          });
        continue;
      }

      if (isEngineErrorLine(trimmed)) {
        log.error(`[PROGRESS] Error for job ${jobId}:`, trimmed);
        errorLines.push(trimmed);
        // Same wording the close handler settles on: the first engine's error is the most specific.
        const userFriendlyError = translateDownloadError(primaryError || errorLines.join('\n'), null, url);
        const deferFailForAgeRetry =
          current.engine === 'yt-dlp' &&
          isYouTubeUrl(url) &&
          youtubePlayerClient !== 'tv_embedded' &&
          isLikelyYoutubeAgeRestrictionError(trimmed);
        if (deferFailForAgeRetry || hasNextEngine) {
          log.info(`[PROGRESS] Holding failed state for job ${jobId} pending retry`);
          if (mainWindow) {
            mainWindow.webContents.send('download-progress', {
              jobId: String(jobId),
              id: jobId,
              percent: 0,
              phase: deferFailForAgeRetry ? 'Retrying with alternate player…' : 'Trying another engine…',
              status: 'downloading',
            });
          }
        } else {
          if (mainWindow) {
            mainWindow.webContents.send('download-progress', {
              jobId: String(jobId),
              id: jobId,
              percent: 0,
              phase: userFriendlyError,
              status: 'failed',
              error: userFriendlyError,
            });
          }
          updateDownloadInDb(jobId, { state: 'failed', error: userFriendlyError });
        }
        continue;
      }
    }
  };

  // Pause, cancel, restart, delete and clear-history drop the task before killing it.
  // A process that is no longer the job's own must not report, fail, retry or complete it:
  // after a restart that would run a second engine beside the new download.
  const superseded = () => activeTasks.get(downloadId)?.process !== downloadProcess;

  downloadProcess.stdout.on('data', (data: Buffer) => {
    if (superseded()) return;
    log.info('[PROGRESS-AUDIT] STDOUT received:', data.toString());
    parseYtDlpOutput(data.toString(), 'stdout');
  });

  downloadProcess.stderr.on('data', (data: Buffer) => {
    if (superseded()) return;
    const text = data.toString();
    aggregatedStderr += text;
    log.info('[PROGRESS-AUDIT] STDERR received:', text);
    lastStderrOutput = text;
    parseYtDlpOutput(text, 'stderr');
  });

  // A failed spawn emits 'error' and then 'close'; only the first may act,
  // otherwise the job is failed and retried at the same time.
  let settled = false;

  downloadProcess.on('close', (code: number | null) => {
    if (settled) return;
    settled = true;
    if (superseded()) {
      log.info(`[PROGRESS] Job ${downloadId}: stopped process exited with ${code}`);
      processQueue();
      return;
    }
    log.info('[PROGRESS-AUDIT] Process closed with code:', code);
    // A final line without a line break (often the engine's error) still counts.
    for (const stream of ['stdout', 'stderr'] as const) {
      if (pending[stream]) parseYtDlpOutput('\n', stream);
    }
    activeTasks.delete(downloadId);
    updatePowerSave();

    const stopReason = taskStopReasons.get(downloadId);
    if (stopReason === 'paused' || stopReason === 'cancelled') {
      taskStopReasons.delete(downloadId);
      processQueue();
      return;
    }

    // If the user intentionally paused/cancelled this job, don't let yt-dlp's exit
    // overwrite the DB state back to "failed" (which can look like an auto-resume).
    try {
      const dlState = getQuery(db, 'SELECT state FROM downloads WHERE id = ?', [downloadId]);
      const state = dlState?.state;
      if (state === 'paused' || state === 'cancelled') {
        processQueue();
        return;
      }
    } catch {
      // Ignore state lookup errors and proceed with normal close handling.
    }

    if (code === 0) {
      log.info(`[PROGRESS] Job ${downloadId} completed successfully`);
      removeJobTempDir(saveFolder, downloadId);
      const finalPath = current.engine === 'yt-dlp' && actualFilePath ? tidyFileName(actualFilePath) : actualFilePath;
      // Without a reported path, keep what the row already says rather than guess.
      updateDownloadInDb(downloadId, {
        state: 'completed',
        completedAt: new Date(),
        ...(finalPath ? { savePath: finalPath } : {}),
      });
      if (mainWindow) {
        mainWindow.webContents.send('download-progress', {
          jobId: String(downloadId),
          id: downloadId,
          percent: 100,
          phase: 'Download complete',
          status: 'completed',
          // The file (or gallery folder) itself, as the history shows after a restart;
          // open-folder selects a file in Explorer and opens a folder.
          savePath: finalPath ?? saveFolder,
          filePath: finalPath,
          speed: '',
          eta: '',
          indeterminate: false,
        });
        mainWindow.setProgressBar(-1);
        try {
          const dl = getQuery(db, 'SELECT filename FROM downloads WHERE id = ?', [downloadId]);
          new Notification({
            title: 'Download Complete',
            body: dl ? dl.filename : 'Your file has been saved.',
          }).show();
        } catch (_) { /* intentional: cleanup failure is non-critical */ }
      }
    } else if (code !== null) {
      if (
        current.engine === 'yt-dlp' &&
        youtubePlayerClient !== 'tv_embedded' &&
        isYouTubeUrl(url) &&
        isLikelyYoutubeAgeRestrictionError(aggregatedStderr)
      ) {
        log.info(
          `[PROGRESS] Retrying download ${downloadId} with youtube:player_client=tv_embedded`,
        );
        spawnDownload(downloadId, url, outputPath, formatId, isResume, 'tv_embedded', engineIndex, primaryError);
        processQueue();
        return;
      }
      // Keep the first engine's error: it is the most specific ("private video", "login required"...).
      const failureText = primaryError || errorLines.join('\n') || lastStderrOutput;
      if (hasNextEngine) {
        log.warn(`[PROGRESS] Job ${downloadId}: ${current.engine} exited ${code}, falling back to ${engines[engineIndex + 1].engine}`);
        spawnDownload(downloadId, url, outputPath, formatId, isResume, undefined, engineIndex + 1, failureText);
        return;
      }
      console.error(`[PROGRESS] Job ${downloadId} failed with code ${code}`);
      const userFriendlyError = translateDownloadError(failureText, code, url);
      updateDownloadInDb(downloadId, { state: 'failed', error: userFriendlyError });
      if (mainWindow) {
        mainWindow.webContents.send('download-progress', {
          jobId: String(downloadId),
          id: downloadId,
          percent: 0,
          phase: userFriendlyError,
          status: 'failed',
          error: userFriendlyError,
        });
        mainWindow.setProgressBar(-1);
      }
    }

    processQueue();
  });

  downloadProcess.on('error', (err: any) => {
    // With a pid the process is running (e.g. a failed kill); its 'close' settles the job.
    if (settled || downloadProcess.pid !== undefined || superseded()) {
      log.warn(`[Spawn Error] downloadId=${downloadId}: ${err.message}`);
      return;
    }
    settled = true;
    activeTasks.delete(downloadId);
    updatePowerSave();
    log.error(`[Spawn Error] downloadId=${downloadId}: ${err.message}`);
    if (hasNextEngine) {
      spawnDownload(downloadId, url, outputPath, formatId, isResume, undefined, engineIndex + 1, primaryError || err.message);
      return;
    }
    const userFriendlyError = translateDownloadError(primaryError || err?.message || String(err), null, url);
    updateDownloadInDb(downloadId, { state: 'failed', error: userFriendlyError });
    if (mainWindow) {
      mainWindow.webContents.send('download-progress', {
        jobId: String(downloadId),
        id: downloadId,
        state: 'failed',
        status: 'failed',
        error: userFriendlyError,
      });
    }
    processQueue();
  });

  return { id: downloadId };
}

// ETA formatter
function formatEta(eta: string): string {
  if (!eta || eta === 'Unknown') return 'Calculating...';
  const parts = eta.split(':').map(Number);
  if (parts.length === 3) {
    const [h, m, s] = parts;
    if (h > 0) return `${h}h ${m}m left`;
    if (m > 0) return `${m}m ${s}s left`;
    return `${s}s left`;
  }
  if (parts.length === 2) {
    const [m, s] = parts;
    if (m > 0) return `${m}m ${s}s left`;
    return `${s}s left`;
  }
  return eta;
}

// ── App Lifecycle ───────────────────────────────────────────────────────────
if (app) {
  app.disableHardwareAcceleration();

  // Allow quit from tray
  (app as any).isQuitting = false;

  app.on('before-quit', () => {
    (app as any).isQuitting = true;
  });

  app
    .whenReady()
    .then(async () => {
      try {
        // Check single instance lock first - exit early if another instance is running
        if (!initializeSingleInstanceLock()) {
          return; // Exit early, app.quit() was called in the function
        }

        log.info('[Main] App ready — startup sequence begin');
        checkBinaries();
        await initDb();
        createApplicationMenu();
        setupIpcHandlers();
        createWindow();
        createTray();

        processQueue();

        setTimeout(() => runBackgroundVersionCheck(), 5000);

        try {
          await execa(ytDlpPath, ['--version'], { timeout: 5000 });
          log.info('[Main] yt-dlp pre-warmed successfully');
        } catch (err: any) {
          log.warn('[Main] yt-dlp pre-warm failed:', err?.message || err);
          log.warn('[Main] yt-dlp pre-warm stderr:', err?.stderr || 'No stderr');
          // Do NOT crash the app - pre-warm failure is not critical
        }
      } catch (err: unknown) {
        log.error('[Main] Startup error:', err);
        const text = err instanceof Error ? `${err.message}\n${err.stack ?? ''}` : String(err);
        try {
          dialog.showErrorBox(
            'Internet Download Hub — startup failed',
            `${text}\n\nDetails were written to the log file.`,
          );
        } catch {
          /* dialog may be unavailable in headless edge cases */
        }
        app.quit();
      }
    })
    .catch((err: unknown) => {
      log.error('[Main] app.whenReady() rejected:', err);
      app.quit();
    });
}

app.on('window-all-closed', () => {
  // On non-Mac, don't quit — we're minimized to tray
  if (process.platform !== 'darwin' && !(app as any).isQuitting) {
    // Stay alive in tray
    return;
  }
  app.quit();
});

app.on('activate', () => {
  if (mainWindow === null) createWindow();
  else {
    mainWindow.show();
    mainWindow.focus();
  }
});

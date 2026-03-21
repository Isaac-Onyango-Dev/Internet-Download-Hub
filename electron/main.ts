import log from 'electron-log';
import { app, BrowserWindow, ipcMain, dialog, shell, Tray, Menu, nativeImage, powerSaveBlocker, Notification } from 'electron';
import path from 'path';

import { spawn, ChildProcess } from 'child_process';
import execa from 'execa';
import { extractPlaylistInfo, extractVideoInfo } from './extractor';
import fs from 'fs';
import os from 'os';
import https from 'https';
import { promisify } from 'util';
import initSqlJs from 'sql.js';
import { translateDownloadError, isLikelyYoutubeAgeRestrictionError } from './errors';
import { ytDlpCommonArgs, ytDlpCookiesArgs, isYouTubeUrl, type YoutubePlayerClient } from './ytdlp-args';

log.transports.file.level = 'debug';
log.catchErrors();
try {
  const fileTransport = log.transports.file as { getFile?: () => { path?: string } };
  const p = fileTransport.getFile?.()?.path;
  log.info('[Main] electron-log file path:', p ?? '(default location)');
} catch {
  log.info('[Main] electron-log initialized');
}

let DB_PATH: string;
process.env.VITE_ELECTRON = 'true';

let mainWindow: any = null;
let tray: any = null;
let db: any;
const activeTasks = new Map<number, {
  process: ChildProcess;
  url: string;
  formatArg: string;
  outputTemplate: string;
  savePath: string;
  filePath?: string;
}>();
const taskStopReasons = new Map<number, 'paused' | 'cancelled'>();
let powerSaveBlockerId: number | null = null;
let minimizeToTray = false; // toggled by close event (always on for now)

let isDev: boolean;
let isTest: boolean;
let binariesPath: string;
let ytDlpPath: string;
let ffmpegPath: string;
let ffprobePath: string;
let streamlinkPath: string;
let n_m3u8dlPath: string;
let galleryDlPath: string;

// ── Single Instance Lock ─────────────────────────────────────────────────────
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  log.warn('[Main] Another instance is already running — exiting (single-instance lock).');
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

function setupPaths() {
  isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
  isTest = process.env.NODE_ENV === 'test';
  
  const userDataBinariesPath = path.join(app.getPath('userData'), 'binaries');
  binariesPath = app.isPackaged
    ? path.join(process.resourcesPath, 'binaries')
    : path.join(process.cwd(), 'binaries');

  // Binary resolution helper: check AppData first, then packaged resources
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
  streamlinkPath = getBinaryPath('streamlink.exe');
  n_m3u8dlPath = getBinaryPath('N_m3u8DL-RE.exe');
  galleryDlPath = getBinaryPath('gallery-dl.exe');
}

// Check binaries on startup
function checkBinaries() {
  setupPaths();
  const binaries = [
    { name: 'yt-dlp', path: ytDlpPath },
    { name: 'ffmpeg', path: ffmpegPath },
    { name: 'ffprobe', path: ffprobePath },
    { name: 'streamlink', path: streamlinkPath },
    { name: 'N_m3u8DL-RE', path: n_m3u8dlPath },
    { name: 'gallery-dl', path: galleryDlPath }
  ];

  log.info('--- Binary Detection ---');
  log.info(`[Main] NODE_ENV: ${process.env.NODE_ENV}`);
  log.info(`[Main] isDev: ${isDev}`);
  log.info(`[Main] isPackaged: ${app.isPackaged}`);
  log.info('[MAIN] Default save path:', app.getPath('downloads'));

  binaries.forEach(bin => {
    if (fs.existsSync(bin.path)) {
      log.info(`✅ ${bin.name} found at: ${bin.path}`);
    } else {
      log.error(`❌ ${bin.name} MISSING at: ${bin.path}`);
    }
  });
  log.info('------------------------');
}

// ── Filename Cleaning ────────────────────────────────────────────────────────
export function cleanFilename(filename: string): string {
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
  columns.forEach((col: string, i: number) => obj[col] = values[0][i]);
  return obj;
}

function allQuery(database: any, sql: string, params: any[] = []): any[] {
  const result = database.exec(sql, params);
  if (result.length === 0) return [];
  const { columns, values } = result[0];
  return values.map((row: any[]) => {
    const obj: any = {};
    columns.forEach((col: string, i: number) => obj[col] = row[i]);
    return obj;
  });
}

/** sql.js must load sql-wasm.wasm from a real path; default resolution breaks inside asar / packaged apps. */
function getSqlJsWasmDir(): string {
  const unpackedDist = path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', 'sql.js', 'dist');
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
      completed_at    TEXT
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
      detect_playlists         INTEGER NOT NULL DEFAULT 0,
      playlist_download_mode  TEXT    NOT NULL DEFAULT 'all',
      create_playlist_folder   INTEGER NOT NULL DEFAULT 1
    );
  `);

  // Run migrations for existing DBs that may be missing columns
  const migrations = [
    `ALTER TABLE downloads ADD COLUMN thumbnail TEXT`,
    `ALTER TABLE downloads ADD COLUMN duration INTEGER`,
    `ALTER TABLE downloads ADD COLUMN uploader TEXT`,
    `ALTER TABLE settings ADD COLUMN default_quality TEXT NOT NULL DEFAULT 'best'`,
    `ALTER TABLE settings ADD COLUMN default_format TEXT NOT NULL DEFAULT 'mp4'`,
    `ALTER TABLE settings ADD COLUMN detect_playlists INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE settings ADD COLUMN playlist_download_mode TEXT NOT NULL DEFAULT 'all'`,
    `ALTER TABLE settings ADD COLUMN create_playlist_folder INTEGER NOT NULL DEFAULT 1`,
    `ALTER TABLE settings ADD COLUMN eula_age_acknowledged INTEGER DEFAULT 0`,
    `ALTER TABLE settings ADD COLUMN cookies_file_path TEXT DEFAULT ''`,
  ];
  for (const sql of migrations) {
    try { db.run(sql); } catch (_) { /* column already exists */ }
  }

  // Ensure default settings row
  db.exec(`
    INSERT OR IGNORE INTO settings (id, max_concurrent_downloads, download_path, default_quality, default_format, detect_playlists, playlist_download_mode, create_playlist_folder)
    VALUES (1, 3, '${defaultPath}', 'best', 'mp4', 0, 'all', 1);
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
    detect_playlists: 0,
    playlist_download_mode: 'all',
    create_playlist_folder: 1,
    eula_age_acknowledged: 0,
    cookies_file_path: '',
  };

  for (const [key, value] of Object.entries(defaults)) {
    try {
      db.run(`UPDATE settings SET ${key} = ? WHERE id = 1 AND (${key} IS NULL OR ${key} = '')`, [value]);
    } catch (_) { /* ignore */ }
  }

  // Reset any stranded active tasks to paused so user can resume them
  try {
    db.run("UPDATE downloads SET state = 'paused' WHERE state IN ('downloading', 'merging')");
  } catch (_) { }

  saveDatabase(db);
}

// ── Helper functions ─────────────────────────────────────────────────────────
async function getFreeSpace(targetPath: string): Promise<number> {
  return new Promise((resolve) => {
    let cmd: string;
    if (os.platform() === 'win32') {
      // Use drive letter only (e.g. "C")
      const driveLetter = targetPath.split(':')[0];
      cmd = `powershell -NoProfile -Command "(Get-PSDrive -Name '${driveLetter}').Free"`;
    } else {
      cmd = `df -b1 "${targetPath}" | tail -1 | awk '{print $4}'`;
    }

    const { exec } = require('child_process');
    exec(cmd, (err: any, stdout: string) => {
      if (err) {
        log.error('Failed to get free space:', err);
        resolve(Number.MAX_SAFE_INTEGER);
        return;
      }
      const parsed = parseInt(stdout.trim().replace(/[^0-9]/g, ''), 10);
      resolve(isNaN(parsed) ? Number.MAX_SAFE_INTEGER : parsed);
    });
  });
}

function updateDownloadInDb(id: number, updates: any) {
  const fields: string[] = [];
  const values: any[] = [];
  for (const [key, val] of Object.entries(updates)) {
    fields.push(`${key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`)} = ?`);
    values.push(val instanceof Date ? val.toISOString() : val);
  }
  if (fields.length > 0) {
    db.run(`UPDATE downloads SET ${fields.join(', ')} WHERE id = ?`, [...values, id]);
    saveDatabase(db);
  }
}

function deletePartialFile(savePath: string | null) {
  if (!savePath) return;
  try {
    if (fs.existsSync(savePath)) {
      fs.unlinkSync(savePath);
      log.info(`[Cleanup] Deleted partial file: ${savePath}`);
    }
    // Also check for yt-dlp temp files (.part)
    const partFile = savePath + '.part';
    if (fs.existsSync(partFile)) {
      fs.unlinkSync(partFile);
      log.info(`[Cleanup] Deleted partial file: ${partFile}`);
    }
  } catch (err) {
    log.error(`[Cleanup] Failed to delete partial file:`, err);
  }
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
        }
      },
      {
        label: activeCount > 0 ? `Active Downloads: ${activeCount}` : 'No active downloads',
        enabled: false
      },
      { type: 'separator' },
      {
        label: 'Pause All Downloads',
        enabled: activeCount > 0,
        click: () => {
          for (const [id, job] of activeTasks.entries()) {
            job.process.kill('SIGTERM');
            updateDownloadInDb(id, { state: 'paused' });
            if (mainWindow) mainWindow.webContents.send('download-progress', { jobId: String(id), id, phase: 'Paused', status: 'paused' });
          }
          activeTasks.clear();
          updatePowerSave();
          updateTaskbarProgress();
        }
      },
      {
        label: 'Resume All Downloads',
        click: () => {
          const paused = allQuery(db, "SELECT * FROM downloads WHERE state = 'paused' ORDER BY created_at ASC");
          for (const item of paused) {
            updateDownloadInDb(item.id, { state: 'queued', error: null });
          }
          processQueue();
        }
      },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => {
          tray?.destroy();
          app.quit();
        }
      }
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

// ── Window Management ───────────────────────────────────────────────────────
const getPreloadPath = (): string => {
  if (app.isPackaged) {
    // In packaged app, preload is next to main.cjs in resources/app.asar
    return path.join(__dirname, 'preload.cjs')
  } else {
    // In development, preload is in the electron/ folder
    return path.join(process.cwd(), 'electron', 'preload.cjs')
  }
}

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
      sandbox: true
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.webContents.on('did-fail-load', (_event: unknown, errorCode: number, errorDescription: string, validatedURL: string) => {
    log.error('[MAIN] did-fail-load', { errorCode, errorDescription, validatedURL });
    const msg = `Failed to load (${errorCode}): ${validatedURL}\n${errorDescription}`;
    if (!(app as any).isPackaged) {
      dialog.showErrorBox('Load Error', msg);
    } else {
      dialog.showErrorBox('Internet Download Hub — load error', `${msg}\n\nIf this persists, check the log file from Help or %APPDATA% logs.`);
    }
  });

  // Minimize to tray instead of closing
  mainWindow.on('close', (event: any) => {
    if (tray && !(app as any).isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  const isDevRenderer = !app.isPackaged;
  if (isDevRenderer) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(getPackagedIndexHtmlPath());
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
    if (!hasV && hasList && (list.startsWith('RD') || list.startsWith('FL') || list.startsWith('PL'))) {
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

// ── Playwright Browser Check ──────────────────────────────────────────────────
async function ensurePlaywrightBrowser() {
  try {
    const playwrightCore = require('playwright-core');
    const browserPath = playwrightCore.chromium.executablePath();
    if (!fs.existsSync(browserPath)) {
      log.info('[MAIN] Playwright Chromium not found, installing...');
      const { execSync } = require('child_process');
      execSync('npx playwright install chromium', { stdio: 'pipe', timeout: 120000 });
      log.info('[MAIN] Playwright Chromium installed successfully');
    } else {
      log.info('[MAIN] Playwright Chromium found at:', browserPath);
    }
  } catch (err: any) {
    log.warn('[MAIN] Could not verify Playwright Chromium:', err?.message ?? err);
  }
}

// ── yt-dlp Helper Functions ───────────────────────────────────────────────

/** Fetch a JSON URL with a User-Agent header (follows no redirects — for API calls) */
async function fetchJson(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Internet-Download-Hub' } }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`GitHub API returned HTTP ${res.statusCode}`));
            return;
          }
          resolve(JSON.parse(data));
        } catch { reject(new Error('Failed to parse GitHub API response')); }
      });
    }).on('error', reject);
  });
}

/** Download a file, following redirects, into dest. */
async function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const doRequest = (redirectUrl: string) => {
      https.get(redirectUrl, { headers: { 'User-Agent': 'Internet-Download-Hub' } }, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          doRequest(res.headers.location!);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`Failed to download yt-dlp binary: HTTP ${res.statusCode}`));
          return;
        }
        const file = fs.createWriteStream(dest);
        res.pipe(file);
        file.on('finish', () => file.close(() => resolve()));
        file.on('error', (err) => { fs.unlink(dest, () => {}); reject(err); });
      }).on('error', reject);
    };
    doRequest(url);
  });
}

/** Get the currently installed yt-dlp version string. */
async function getCurrentYtDlpVersion(): Promise<string> {
  try {
    const { stdout } = await execa(ytDlpPath, ['--version'], { timeout: 10000 });
    return stdout.trim();
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
  await downloadFile(asset.browser_download_url, tempPath);

  // Sanity-check the downloaded file
  const stats = fs.statSync(tempPath);
  if (stats.size < 10 * 1024 * 1024) { // Increased to 10MB because yt-dlp is usually 15MB+
    fs.unlinkSync(tempPath);
    throw new Error(`Downloaded file is suspiciously small (${(stats.size / 1024 / 1024).toFixed(2)} MB) — aborting`);
  }

  // Backup existing binary in userData if it exists
  const backupPath = destPath + '.backup';
  try { if (fs.existsSync(backupPath)) fs.unlinkSync(backupPath); } catch (_) {}
  try { if (fs.existsSync(destPath)) fs.renameSync(destPath, backupPath); } catch (_) {}

  try {
    // Replace the binary
    fs.renameSync(tempPath, destPath);
    try { if (fs.existsSync(backupPath)) fs.unlinkSync(backupPath); } catch (_) {}
    
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
    } catch (_) {}
    try { if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath); } catch (_) {}
    throw new Error(`Failed to finalize update: ${err.message}`);
  }
}

// Keep old helper for backward compat (used in getLatestYtDlpRelease calls elsewhere)
async function getLatestYtDlpRelease(): Promise<{ url: string, version: string }> {
  const release = await fetchJson('https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest');
  const asset = release.assets.find((a: any) => a.name === 'yt-dlp.exe');
  if (!asset) throw new Error('yt-dlp.exe asset not found in latest release');
  return { url: asset.browser_download_url, version: release.tag_name };
}

// Alias for old code that calls downloadYtDlp — now delegates to downloadFile
async function downloadYtDlp(url: string, dest: string): Promise<void> {
  return downloadFile(url, dest);
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
      log.info(`[UPDATE] yt-dlp update available: ${check.currentVersion} -> ${check.latestVersion}`);
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
function processQueue() {
  try {
    const settings = getQuery(db, 'SELECT max_concurrent_downloads FROM settings WHERE id = 1');
    const maxConcurrent = settings?.max_concurrent_downloads || 3;
    const activeCount = activeTasks.size;

    if (activeCount >= maxConcurrent) return;

    const toStart = maxConcurrent - activeCount;
    const queuedItems = allQuery(db, "SELECT * FROM downloads WHERE state = 'queued' ORDER BY created_at ASC LIMIT ?", [toStart]);

    for (const item of queuedItems) {
      updateDownloadInDb(item.id, { state: 'downloading', error: null });
      spawnDownload(item.id, item.url, item.save_path, item.format_id, !!item.received_bytes);
      if (mainWindow) {
        mainWindow.webContents.send('download-progress', {
          jobId: String(item.id),
          id: item.id,
          phase: 'Starting download...',
          status: 'downloading'
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

// ── IPC Handlers ─────────────────────────────────────────────────────────────
function setupIpcHandlers() {
  // ── fetch-video-info ──────────────────────────────────────────────────────
  ipcMain.handle('fetch-video-info', async (_: any, rawUrl: string) => {
    log.info(`[IPC] fetch-video-info called for: ${rawUrl}`);

    // Basic URL validation
    try {
      new URL(rawUrl);
    } catch {
      return { success: false, error: 'That doesn\'t look like a valid URL. Please paste a full video link.' };
    }

    try {
      const settings = getQuery(db, 'SELECT detect_playlists FROM settings WHERE id = 1');
      const detectPlaylistsEnabled = settings?.detect_playlists === 1;
      const cookiesFile = getResolvedCookiesPath();

      const playlistCheck = detectPlaylist(rawUrl);

      if (playlistCheck.isPlaylist) {
        if (!detectPlaylistsEnabled) {
          const playlist = await extractPlaylistInfo(
            rawUrl,
            { ytDlp: ytDlpPath, ffmpeg: ffmpegPath, cookiesFile },
            { playlistItemLimit: 1 }
          );
          return {
            success: true,
            data: playlist.videos[0],
            meta: {
              playlistDetected: true,
              detectPlaylistsEnabled: false,
              collapsedToSingle: true,
              playlistTitle: playlist.title,
              playlistVideoCount: playlist.videoCount,
            },
          };
        }

        const playlist = await extractPlaylistInfo(rawUrl, {
          ytDlp: ytDlpPath,
          ffmpeg: ffmpegPath,
          cookiesFile,
        });
        return {
          success: true,
          data: { isPlaylist: true, videos: playlist.videos },
          meta: {
            playlistDetected: true,
            detectPlaylistsEnabled: true,
            collapsedToSingle: false,
            playlistTitle: playlist.title,
            playlistVideoCount: playlist.videoCount,
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
      return {
        success: false,
        error: translateDownloadError(error?.message || String(error), null, rawUrl),
      };
    }
  });

  // ── start-download ────────────────────────────────────────────────────────
  ipcMain.handle('start-download', async (_: any, options: any) => {
    log.info('[DOWNLOAD] Received start-download request:', options)

    if (!options) {
      throw new Error('No download options provided')
    }

    const url =
      typeof options.url === 'string' && options.url.trim()
        ? options.url.trim()
        : null

    const filename =
      typeof options.filename === 'string' && options.filename.trim()
        ? options.filename.trim()
        : null

    // Validate required fields to prevent SQLite binding errors (undefined).
    if (!url) throw new Error('Invalid or missing URL')
    if (!filename) throw new Error('Invalid or missing filename')

    const formatId =
      typeof options.formatId === 'string' && options.formatId.trim()
        ? options.formatId.trim()
        : null

    const optionsSavePath =
      typeof options.savePath === 'string' && options.savePath.trim()
        ? options.savePath.trim()
        : undefined

    const thumbnail =
      typeof options.thumbnail === 'string' && options.thumbnail.trim()
        ? options.thumbnail.trim()
        : null

    const uploader =
      typeof options.uploader === 'string' && options.uploader.trim()
        ? options.uploader.trim()
        : null

    const duration =
      typeof options.duration === 'number' && Number.isFinite(options.duration)
        ? options.duration
        : null

    const saveFolder = optionsSavePath || getDefaultSavePath();
    const outputPath = path.join(saveFolder, filename);

    log.info('Saving download to:', outputPath);

    if (!fs.existsSync(saveFolder)) {
      fs.mkdirSync(saveFolder, { recursive: true });
    }

    // Duplicate URL detection — warn if same URL is already downloading
    const existing = allQuery(db, "SELECT id, state FROM downloads WHERE url = ? AND state IN ('downloading', 'queued')", [url]);
    if (existing.length > 0) {
      throw new Error('This video is already in your download queue.');
    }

    db.run(`
      INSERT INTO downloads (url, filename, thumbnail, duration, uploader, format_id, state, save_path)
      VALUES (?, ?, ?, ?, ?, ?, 'queued', ?)
    `, [url, filename, thumbnail ?? null, duration ?? null, uploader ?? null, formatId ?? null, outputPath]);
    saveDatabase(db);

    const info = getQuery(db, 'SELECT last_insert_rowid() as id');
    const downloadId = info.id;

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
      existing.process.kill();
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
      job.process.kill('SIGTERM');
      activeTasks.delete(numericId);
      updatePowerSave();
      
      if (mainWindow) {
        mainWindow.webContents.send('download-progress', {
          jobId: String(numericId),
          id: numericId,
          phase: 'Paused',
          status: 'paused'
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
      existing.process.kill();
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
      job.process.kill('SIGTERM');
      activeTasks.delete(numericId);
      updatePowerSave();

      // Clean up partial files — yt-dlp leaves .part files behind
      try {
        const fileBase = path.basename(job.outputTemplate, path.extname(job.outputTemplate));
        if (job.savePath && fs.existsSync(job.savePath)) {
          const files = fs.readdirSync(job.savePath);
          for (const file of files) {
            if ((file.includes(fileBase) && file.endsWith('.part')) || file.endsWith('.ytdl')) {
              fs.unlinkSync(path.join(job.savePath, file));
              log.info('[CANCEL] Deleted partial file:', file);
            }
          }
        }
      } catch (err) {
        log.warn('[CANCEL] Could not clean up partial files:', err);
      }
    }

    // Get save path to clean up partial file directly from DB just in case it wasn't active
    const dl = getQuery(db, 'SELECT save_path FROM downloads WHERE id = ?', [numericId]);
    if (dl) deletePartialFile(dl.save_path);

    updateDownloadInDb(numericId, { state: 'cancelled' });
    if (mainWindow) {
      mainWindow.webContents.send('download-progress', {
        jobId: String(numericId),
        id: numericId,
        percent: 0,
        phase: 'Cancelled',
        status: 'cancelled'
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
      job.process.kill('SIGTERM');
      activeTasks.delete(Number(id));
      updatePowerSave();
    }

    const dl = getQuery(db, 'SELECT save_path, state FROM downloads WHERE id = ?', [id]);
    if (dl && dl.state !== 'completed') {
      deletePartialFile(dl.save_path);
    }

    db.run('DELETE FROM downloads WHERE id = ?', [id]);
    saveDatabase(db);
    updateTaskbarProgress();
    processQueue();
    return { success: true };
  });

  // ── open-file-path ────────────────────────────────────────────────────────
  ipcMain.handle('open-file-path', async (_: any, filePath: string) => {
    const result = await shell.openPath(filePath);
    if (result) {
      throw new Error(`Could not open file: ${result}`);
    }
    return { success: true };
  });

  // ── open-folder ───────────────────────────────────────────────────
  ipcMain.handle('open-folder', async (_: any, targetPath: string) => {
    try {
      if (targetPath && typeof targetPath === 'string' && fs.existsSync(targetPath)) {
        const stat = fs.statSync(targetPath);
        if (stat.isDirectory()) {
          shell.openPath(targetPath);
        } else {
          shell.showItemInFolder(targetPath);
        }
      }
    } catch (error: any) {
      log.error('Failed to open folder:', error);
      // Fallback: system Downloads folder
      await shell.openPath(app.getPath('downloads'));
      return { success: true };
    }
  });

  // ── choose-save-folder ────────────────────────────────────────────────────
  ipcMain.handle('choose-save-folder', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openDirectory']
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
  ipcMain.handle('check-disk-space', async (_: any, { path: targetPath, requiredBytes }: { path: string, requiredBytes: number }) => {
    const freeSpace = await getFreeSpace(targetPath || getDefaultSavePath());
    const estimatedBytes = (requiredBytes <= 0 || requiredBytes > 10 * 1024 * 1024 * 1024)
      ? 500 * 1024 * 1024
      : requiredBytes;

    const buffer = 100 * 1024 * 1024; // 100MB buffer
    return {
      isEnough: freeSpace > (estimatedBytes + buffer),
      freeSpace,
      required: estimatedBytes + buffer
    };
  });

  // ── get-download-history ──────────────────────────────────────────────────
  ipcMain.handle('get-download-history', async () => {
    return allQuery(db, 'SELECT * FROM downloads ORDER BY created_at DESC');
  });

  // ── clear-history ─────────────────────────────────────────────────────────
  ipcMain.handle('clear-history', async () => {
    // Stop any active tasks first
    for (const [id, job] of activeTasks.entries()) {
      job.process.kill('SIGTERM');
    }
    activeTasks.clear();
    updatePowerSave();

    db.run('DELETE FROM downloads');
    saveDatabase(db);
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
      const fields = Object.keys(settings).map(k => {
        const snakeKey = k.replace(/[A-Z]/g, l => `_${l.toLowerCase()}`);
        return `${snakeKey} = ?`;
      }).join(', ');
      const values = Object.values(settings);

      db.run(`UPDATE settings SET ${fields} WHERE id = 1`, values);
      saveDatabase(db);
      return getQuery(db, 'SELECT * FROM settings WHERE id = 1');
    } catch (error: any) {
      log.error(`[IPC Error] save-settings failed: ${error.message}`);
      throw error;
    }
  });

  // ── open-external ─────────────────────────────────────────────────────────
  ipcMain.handle('open-external', async (_: any, url: string) => {
    try {
      await shell.openExternal(url);
      return { success: true };
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
    db.run(`
      UPDATE settings SET
        theme = 'system',
        max_concurrent_downloads = 3,
        auto_capture = 1,
        file_types = '["mp4","mp3","zip","exe","pdf","jpg","png"]',
        download_path = ?,
        default_quality = 'best',
        default_format = 'mp4',
        detect_playlists = 0,
        playlist_download_mode = 'all',
        create_playlist_folder = 1,
        eula_age_acknowledged = 0,
        cookies_file_path = ''
      WHERE id = 1
    `, [defaultPath]);
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

  // ── check-ytdlp-version ─────────────────────────────────────────────────────
  ipcMain.handle('check-ytdlp-version', async () => {
    return await checkYtDlpVersion();
  });
}

// Store incomplete lines between data chunks
const lineBuffers = new Map<number, string>();

// ── Spawn Download (shared logic) ─────────────────────────────────────────────
function spawnDownload(
  downloadId: number,
  url: string,
  outputPath: string,
  formatId?: string | null,
  isResume: boolean = false,
  youtubePlayerClient?: YoutubePlayerClient
): { id: number } {
  taskStopReasons.delete(downloadId);
  // Used for translating yt-dlp failures reliably (close handler only gives the exit code).
  let lastStderrOutput = '';
  let aggregatedStderr = '';
  let actualFilePath = outputPath;
  let cleanedFilePathCandidate: string | null = null;
  const formatArg = formatId === 'bestvideo+bestaudio' || !formatId
    ? 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/bestvideo+bestaudio/best'
    : formatId === 'bestaudio'
    ? 'bestaudio/best'
    : `${formatId}+bestaudio/best`;

  const saveFolder = path.dirname(outputPath);
  const outputTemplate = path.join(saveFolder, '%(title)s.%(ext)s');
  const cleanFilename = (filename: string): string => {
    return filename
      .replace(/_{2,}/g, ' ')
      .replace(/-{2,}/g, ' - ')
      .replace(/__+/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .replace(/^\s+|\s+$/g, '')
      .replace(/[<>:"/\\|?*]/g, '');
  };

  const cookiesPath = getResolvedCookiesPath();

  const ytDlpArgs = [
    '--newline',
    '--progress',
    '--no-colors',
    '--no-warnings',
    ...ytDlpCommonArgs(url, {
      noPlaylist: true,
      ...(youtubePlayerClient !== undefined ? { youtubePlayerClient } : {}),
    }),
    ...ytDlpCookiesArgs(cookiesPath),
    '--windows-filenames',
    '--trim-filenames', '200',
    '-f', formatArg,
    '--merge-output-format', 'mp4',
    '--ffmpeg-location', ffmpegPath,
    '-o', outputTemplate,
    url
  ];

  if (isResume) {
    ytDlpArgs.unshift('--continue');
  }

  log.info('[PROGRESS-AUDIT] Download started for jobId:', downloadId);
  log.info('[PROGRESS-AUDIT] yt-dlp command:', ytDlpPath, ytDlpArgs.join(' '));

  const ytDlpProcess = spawn(ytDlpPath, ytDlpArgs);
  
  activeTasks.set(downloadId, {
    process: ytDlpProcess,
    url,
    formatArg,
    outputTemplate,
    savePath: saveFolder,
    // Helps cleanup/correct open-folder paths if we capture it.
    filePath: actualFilePath as any
  });
  updatePowerSave();

  const parseYtDlpOutput = (raw: string, jobId: number) => {
    const existing = lineBuffers.get(jobId) || '';
    const combined = existing + raw;

    // Split on newlines AND carriage returns to handle both output styles
    const lines = combined.split(/[\n\r]+/);

    // Keep the last item only if it did not end with a newline (incomplete line)
    const lastLine = combined.endsWith('\n') || combined.endsWith('\r') ? '' : lines.pop() || '';
    lineBuffers.set(jobId, lastLine);

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      const progressMatch = trimmed.match(
        /\[download\]\s+([\d.]+)%(?:\s+of\s+(?:~?\s*)?([\w.\s]+?))?(?:(?:\s+in\s+[\w:]+)?\s+at\s+([\w.\s\/]+?))?(?:\s+ETA\s+([\w:]+))?(?:\s+\(frag.*?\))?\s*$/i
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
          status: 'downloading'
        };

        log.info(`[PROGRESS] ${jobId}: ${percent}% of ${totalSizeStr} at ${speedStr} ETA ${etaRaw}`);
        if (mainWindow) {
          mainWindow.webContents.send('download-progress', progressData);
          mainWindow.setProgressBar(progressData.percent / 100);
        }
        
        const parseSize = (s: string): number => {
          const num = parseFloat(s);
          const su = s.toLowerCase();
          if (su.includes('tib')) return num * 1024 * 1024 * 1024 * 1024;
          if (su.includes('gib')) return num * 1024 * 1024 * 1024;
          if (su.includes('mib')) return num * 1024 * 1024;
          if (su.includes('kib')) return num * 1024;
          return num;
        };
        const totalBytes = parseSize(totalSizeStr);
        const receivedBytes = Math.floor(totalBytes * (progressData.percent / 100));
        updateDownloadInDb(jobId, { totalBytes, receivedBytes });
        continue;
      }

      if (trimmed.startsWith('[download] Destination:')) {
        // yt-dlp may still sanitize filenames (underscores/dashes). Fix it immediately if needed.
        const rawDestinationPath = trimmed.replace('[download] Destination:', '').trim();
        const dir = path.dirname(rawDestinationPath);
        const ext = path.extname(rawDestinationPath);
        const baseName = path.basename(rawDestinationPath, ext);
        const cleanName = cleanFilename(baseName);
        const cleanPath = path.join(dir, cleanName + ext);
        cleanedFilePathCandidate = rawDestinationPath !== cleanPath ? cleanPath : null;

        actualFilePath = rawDestinationPath;

        if (rawDestinationPath && cleanedFilePathCandidate && fs.existsSync(rawDestinationPath)) {
          try {
            fs.renameSync(rawDestinationPath, cleanedFilePathCandidate);
            actualFilePath = cleanedFilePathCandidate;
            const task = activeTasks.get(downloadId);
            if (task) (task as any).filePath = cleanedFilePathCandidate;
          } catch {
            // If rename fails (file not ready yet), we will attempt again in close handler.
          }
        }

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
        if (mainWindow) mainWindow.webContents.send('download-progress', { jobId: String(jobId), id: jobId, percent: 100, phase: 'Already downloaded', status: 'completed' });
        continue;
      }

      if (
        trimmed.includes('[Merger]') ||
        trimmed.includes('Merging formats into') ||
        trimmed.includes('[ffmpeg]')
      ) {
        if (mainWindow) mainWindow.webContents.send('download-progress', { jobId: String(jobId), id: jobId, percent: 99, phase: 'Merging audio and video...', status: 'merging' });
        continue;
      }

      if (trimmed.includes('[ExtractAudio]')) {
        if (mainWindow) mainWindow.webContents.send('download-progress', { jobId: String(jobId), id: jobId, percent: 99, phase: 'Extracting audio...', status: 'merging' });
        continue;
      }

      if (
        trimmed.includes('ERROR:') ||
        trimmed.includes('error:') ||
        trimmed.includes('Unable to download') ||
        trimmed.includes('This video is unavailable')
      ) {
        log.error(`[PROGRESS] Error for job ${jobId}:`, trimmed);
        const userFriendlyError = translateDownloadError(trimmed, null, url);
        const deferFailForAgeRetry =
          isYouTubeUrl(url) &&
          youtubePlayerClient !== 'tv_embedded' &&
          isLikelyYoutubeAgeRestrictionError(trimmed);
        if (deferFailForAgeRetry) {
          log.info(`[PROGRESS] Holding failed state for job ${jobId} pending tv_embedded retry`);
          if (mainWindow) {
            mainWindow.webContents.send('download-progress', {
              jobId: String(jobId),
              id: jobId,
              percent: 0,
              phase: 'Retrying with alternate player…',
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

  ytDlpProcess.stdout.on('data', (data: Buffer) => {
    log.info('[PROGRESS-AUDIT] STDOUT received:', data.toString());
    parseYtDlpOutput(data.toString(), downloadId);
  });

  ytDlpProcess.stderr.on('data', (data: Buffer) => {
    const text = data.toString();
    aggregatedStderr += text;
    log.info('[PROGRESS-AUDIT] STDERR received:', text);
    lastStderrOutput = text;
    parseYtDlpOutput(text, downloadId);
  });

  ytDlpProcess.on('close', (code: number | null) => {
    log.info('[PROGRESS-AUDIT] Process closed with code:', code);
    lineBuffers.delete(downloadId);
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
      // Final attempt to clean filenames now that the file should exist.
      if (cleanedFilePathCandidate && fs.existsSync(actualFilePath) && cleanedFilePathCandidate !== actualFilePath) {
        try {
          if (!fs.existsSync(cleanedFilePathCandidate)) {
            fs.renameSync(actualFilePath, cleanedFilePathCandidate);
          }
          actualFilePath = cleanedFilePathCandidate;
          const task = activeTasks.get(downloadId);
          if (task) (task as any).filePath = cleanedFilePathCandidate;
        } catch {
          // Best effort only.
        }
      }
      updateDownloadInDb(downloadId, { state: 'completed', completedAt: new Date() });
      if (mainWindow) {
        mainWindow.webContents.send('download-progress', {
          jobId: String(downloadId),
          id: downloadId,
          percent: 100,
          phase: 'Download complete',
          status: 'completed',
          // UI uses `savePath` to open the correct folder.
          savePath: saveFolder,
          filePath: actualFilePath,
          speed: '',
          eta: '',
        });
        mainWindow.setProgressBar(-1);
        try {
          const dl = getQuery(db, 'SELECT filename FROM downloads WHERE id = ?', [downloadId]);
          new Notification({
            title: 'Download Complete',
            body: dl ? dl.filename : 'Your file has been saved.'
          }).show();
        } catch (_) {}
      }
    } else if (code !== null) {
      if (
        youtubePlayerClient !== 'tv_embedded' &&
        isYouTubeUrl(url) &&
        isLikelyYoutubeAgeRestrictionError(aggregatedStderr)
      ) {
        log.info(`[PROGRESS] Retrying download ${downloadId} with youtube:player_client=tv_embedded`);
        spawnDownload(downloadId, url, outputPath, formatId, isResume, 'tv_embedded');
        processQueue();
        return;
      }
      console.error(`[PROGRESS] Job ${downloadId} failed with code ${code}`);
      const userFriendlyError = translateDownloadError(aggregatedStderr || lastStderrOutput, code, url);
      updateDownloadInDb(downloadId, { state: 'failed', error: userFriendlyError });
      if (mainWindow) {
        mainWindow.webContents.send('download-progress', {
          jobId: String(downloadId),
          id: downloadId,
          percent: 0,
          phase: userFriendlyError,
          status: 'failed',
          error: userFriendlyError
        });
        mainWindow.setProgressBar(-1);
      }
    }
    
    processQueue();
  });

  ytDlpProcess.on('error', (err: any) => {
    activeTasks.delete(downloadId);
    updatePowerSave();
    log.error(`[Spawn Error] downloadId=${downloadId}: ${err.message}`);
    const userFriendlyError = translateDownloadError(err?.message || String(err), null, url);
    updateDownloadInDb(downloadId, { state: 'failed', error: userFriendlyError });
    if (mainWindow) {
      mainWindow.webContents.send('download-progress', { jobId: String(downloadId), id: downloadId, state: 'failed', status: 'failed', error: userFriendlyError });
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

  app.whenReady().then(async () => {
    try {
      log.info('[Main] App ready — startup sequence begin');
      checkBinaries();
      await initDb();
      setupIpcHandlers();
      createWindow();
      createTray();

      processQueue();

      ensurePlaywrightBrowser();

      setTimeout(() => runBackgroundVersionCheck(), 5000);

      try {
        await execa(ytDlpPath, ['--version'], { timeout: 5000 });
        log.info('[Main] yt-dlp pre-warmed successfully');
      } catch {
        log.warn('[Main] yt-dlp pre-warm failed — binary may be missing');
      }
    } catch (err: unknown) {
      log.error('[Main] Startup error:', err);
      const text = err instanceof Error ? `${err.message}\n${err.stack ?? ''}` : String(err);
      try {
        dialog.showErrorBox(
          'Internet Download Hub — startup failed',
          `${text}\n\nDetails were written to the log file.`
        );
      } catch {
        /* dialog may be unavailable in headless edge cases */
      }
      app.quit();
    }
  }).catch((err: unknown) => {
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

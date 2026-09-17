import express from 'express';
import cors from 'cors';
import { spawn, execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import os from 'os';
import { translateDownloadError, isEngineErrorLine } from '../electron/errors';

const execFileAsync = promisify(execFile);
const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.use(cors());
app.use(express.json());

// ── Binary Path Logic ──────────────────────────────────────────────────────────
function getYtDlpPath(): string {
  if (process.env.YTDLP_PATH) return process.env.YTDLP_PATH;
  
  // Try local binaries folder first
  const isWin = process.platform === 'win32';
  const binName = isWin ? 'yt-dlp.exe' : 'yt-dlp';
  const local = path.resolve(__dirname, '..', 'binaries', binName);
  
  if (fs.existsSync(local)) return local;
  return binName; // Fallback to system PATH
}

function getFfmpegPath(): string {
  if (process.env.FFMPEG_PATH) return process.env.FFMPEG_PATH;
  
  const isWin = process.platform === 'win32';
  const binName = isWin ? 'ffmpeg.exe' : 'ffmpeg';
  const local = path.resolve(__dirname, '..', 'binaries', binName);
  
  if (fs.existsSync(local)) return local;
  return binName; // Fallback to system PATH
}

const YT_DLP = getYtDlpPath();
const FFMPEG = getFfmpegPath();
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

console.log(`[Server] Using yt-dlp: ${YT_DLP}`);
console.log(`[Server] Using ffmpeg: ${FFMPEG}`);

function formatBytes(bytes: number): string {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseYtDlpJson(info: any, fallbackUrl: string) {
  const resolvedUrl = info?.webpage_url || info?.url || info?.original_url || fallbackUrl;

  const rawFormats = info.formats || [];
  console.log(`[Server] Found ${rawFormats.length} raw formats for ${info.title || 'video'}`);

  const formats = (rawFormats)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((f: any) => {
      const hasHeight = f.height && f.height > 0;
      const hasVideo = f.vcodec && f.vcodec !== 'none';
      return hasHeight && hasVideo;
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((f: any) => {
      const fps = f.fps ? `${f.fps}fps` : '';
      const sizeInfo = f.filesize || f.filesize_approx ? formatBytes(f.filesize || f.filesize_approx) : '';

      return {
        formatId: f.format_id,
        label: `${f.height}p ${fps} ${sizeInfo}`.replace(/\s{2,}/g, ' ').trim(),
        quality: `${f.height}p`,
        ext: f.ext,
        filesize: f.filesize || f.filesize_approx || null,
        height: f.height,
      };
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .sort((a: any, b: any) => {
      if (b.height !== a.height) return (b.height || 0) - (a.height || 0);
      return (b.filesize || 0) - (a.filesize || 0);
    });

  // Keep best format per height (prefer larger file size)
  const seen = new Map();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  formats.forEach((f: any) => {
    const existing = seen.get(f.height);
    if (!existing || (f.filesize || 0) > (existing.filesize || 0)) {
      seen.set(f.height, f);
    }
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let uniqueFormats = Array.from(seen.values()).sort((a: any, b: any) => (b.height || 0) - (a.height || 0));

  // FALLBACK: If yt-dlp didn't return full formats, construct them from known heights
  if (uniqueFormats.length < 3) {
    console.log(`[Server] Limited formats detected (${uniqueFormats.length}), adding fallback quality options`);
    const commonHeights = [2160, 1440, 1080, 720, 480, 360, 240, 144];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const existingHeights = new Set(uniqueFormats.map((f: any) => f.height));
    const videoHeight = info.height || null;
    
    commonHeights.forEach(height => {
      if (!existingHeights.has(height) && (!videoHeight || height <= videoHeight)) {
        uniqueFormats.push({
          formatId: `bestvideo[height=${height}]+bestaudio/best[height=${height}]`,
          label: `${height}p (Available)`,
          quality: `${height}p`,
          ext: 'mp4',
          filesize: null,
          height: height,
        });
      }
    });
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    uniqueFormats = uniqueFormats.sort((a: any, b: any) => (b.height || 0) - (a.height || 0));
  }

  return {
    url: resolvedUrl,
    title: info.title || 'Unknown Video',
    thumbnail: info.thumbnail || '',
    duration: info.duration || 0,
    uploader: info.uploader || info.channel || '',
    extractionMethod: 'yt-dlp',
    formats: [
      {
        formatId: 'bestvideo+bestaudio',
        label: 'Best Quality (Recommended)',
        quality: 'best',
        ext: 'mp4',
        filesize: null,
        height: null,
      },
      ...uniqueFormats,
      {
        formatId: 'bestaudio',
        label: 'Audio Only (MP3)',
        quality: 'audio',
        ext: 'mp3',
        filesize: null,
        height: null,
      },
    ],
  };
}

// ── GET /api/video-info?url=... ────────────────────────────────────────────────
app.get('/api/video-info', async (req, res) => {
  const url = req.query.url as string;

  if (!url) {
    return res.status(400).json({ success: false, error: 'Missing url parameter' });
  }

  try {
    new URL(url);
  } catch {
    return res.status(400).json({
      success: false,
      error: "That doesn't look like a valid URL. Please paste a full video link.",
    });
  }

  try {
    const urlObj = new URL(url);
    const isYouTube = ['youtube.com', 'youtu.be'].includes(urlObj.hostname) || urlObj.hostname.endsWith('.youtube.com');

    // YouTube on datacenter IPs needs special handling — try multiple player clients
    const playerClients = isYouTube
      ? ['web', 'web_safari', 'ios', 'android', 'mediaconnect', 'tv']
      : [];

    let lastErr: any = null;

    // Try each player client in sequence until one works
    for (const client of playerClients.length > 0 ? playerClients : ['']) {
      try {
        const args = [
          '-J',
          '--no-warnings',
          '--no-playlist',
          '--user-agent',
          UA,
          '--add-header',
          'Accept-Language:en-US,en;q=0.9',
          '--age-limit', '99',
        ];

        if (client) {
          args.push('--extractor-args', `youtube:player_client=${client}`);
        }

        args.push('--', url);

        const { stdout } = await execFileAsync(YT_DLP, args, {
          timeout: 60000,
          maxBuffer: 50 * 1024 * 1024,
        });

        const info = JSON.parse(stdout);
        const data = parseYtDlpJson(info, url);

        if (client) console.log(`[video-info] YouTube extraction succeeded with player_client=${client}`);

        return res.json({
          success: true,
          data,
          meta: {
            playlistDetected: false,
            detectPlaylistsEnabled: false,
            collapsedToSingle: false,
          },
        });
      } catch (err: any) {
        lastErr = err;
        const msg = err.stderr || err.message || '';
        // If error looks like bot detection or consent page, try next client
        if (isYouTube && (
          msg.includes('consent') ||
          msg.includes('Sign in') ||
          msg.includes('confirm you are human') ||
          msg.includes('No video formats found') ||
          msg.includes('bot') ||
          msg.includes('robot') ||
          msg.includes('CAPTCHA') ||
          msg.includes('cookies')
        )) {
          console.warn(`[video-info] player_client=${client || 'default'} failed (bot detection), trying next...`);
          continue;
        }
        // Non-bot-detection error — don't retry, fail immediately
        throw err;
      }
    }

    // All player clients failed
    throw lastErr;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    console.error('[video-info] error:', err.message?.slice(0, 300));
    // Raw yt-dlp output means nothing to a visitor; say what went wrong instead.
    const raw: string = err.stderr || err.message || '';
    const errorLines = raw.split('\n').filter(isEngineErrorLine).join('\n');
    return res.status(500).json({ success: false, error: translateDownloadError(errorLines || raw, null, url, 'web') });
  }
});

// ── GET /api/download?url=...&formatId=...&filename=... ───────────────────────
app.get('/api/download', (req, res) => {
  const url = req.query.url as string;
  const formatId = (req.query.formatId as string) || 'bestvideo+bestaudio';
  const filename = (req.query.filename as string) || 'video.mp4';
  const isAudio = formatId === 'bestaudio' || filename.endsWith('.mp3');

  if (!url) {
    return res.status(400).send('Missing url');
  }

  const safeFilename = filename.replace(/[^\w.\- ()]/g, '_');

  // Detect YouTube for player client configuration
  let isYouTube = false;
  try {
    const urlObj = new URL(url);
    isYouTube = ['youtube.com', 'youtu.be'].includes(urlObj.hostname) || urlObj.hostname.endsWith('.youtube.com');
  } catch { /* ignore */ }

  let args: string[];

  const commonArgs = [
    '--user-agent', UA,
    '--add-header', 'Accept-Language:en-US,en;q=0.9',
    '--no-warnings',
    '--no-playlist',
    '--ffmpeg-location', FFMPEG,
  ];

  // Add YouTube player client args for datacenter IP compatibility
  if (isYouTube) {
    commonArgs.push('--extractor-args', 'youtube:player_client=web');
  }

  // yt-dlp writes a real file first. Written to stdout, a merged video came out as
  // MPEG-TS and "MP3" as AAC, because nothing can be merged or converted in a pipe.
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'idh-web-'));
  const output = ['-P', workDir, '-o', 'download.%(ext)s'];

  if (isAudio) {
    args = [
      '-f', 'bestaudio/best',
      '--extract-audio',
      '--audio-format', 'mp3',
      '--audio-quality', '0',
      ...commonArgs,
      ...output,
      '--', url,
    ];
  } else {
    // Build format argument intelligently
    let formatArg: string;
    if (formatId === 'bestvideo+bestaudio' || !formatId) {
      formatArg = 'bestvideo+bestaudio/best';
    } else if (formatId === 'bestaudio') {
      formatArg = 'bestaudio/best';
    } else if (formatId.includes('+bestaudio') || formatId.includes('bestvideo[')) {
      // Fallback formatIds like 'bestvideo[height=1080]+bestaudio/best[height=1080]'
      // are already complete yt-dlp format expressions — use as-is
      formatArg = formatId;
    } else {
      // Simple format ID (e.g., '137', '248'): merge in the best audio, or take the format
      // alone when there is no separate audio track (most HLS streams).
      formatArg = `${formatId}+bestaudio/${formatId}`;
    }

    args = [
      '-f', formatArg,
      // Best resolution first, then H.264/AAC where offered: the default AV1/Opus picks
      // make an MP4 that Windows' own player cannot open.
      '-S', 'lang,quality,res,fps,vcodec:h264,acodec:aac',
      ...commonArgs,
      '--merge-output-format', 'mp4',
      ...output,
      '--', url,
    ];
  }

  console.log(`[download] Starting: ${url} | format: ${formatId} | file: ${safeFilename}`);

  const proc = spawn(YT_DLP, args, { stdio: ['ignore', 'ignore', 'pipe'] });
  const cleanUp = () => fs.rm(workDir, { recursive: true, force: true }, () => {});

  const stderrChunks: Buffer[] = [];
  proc.stderr.on('data', (chunk: Buffer) => stderrChunks.push(chunk));

  // The browser navigated here, so a failure must be a page it can show and leave.
  const fail = (raw: string) => {
    cleanUp();
    if (res.headersSent || res.destroyed) return;
    const message = translateDownloadError(
      raw.split('\n').filter(isEngineErrorLine).join('\n') || raw,
      null,
      url,
      'web',
    );
    res
      .status(502)
      .type('html')
      .send(
        `<!doctype html><meta charset="utf-8"><title>Download failed</title>` +
          `<body style="font-family:system-ui,sans-serif;max-width:36rem;margin:4rem auto;padding:0 1rem">` +
          `<h1>Download failed</h1><p>${escapeHtml(message)}</p>` +
          `<p><a href="/" onclick="history.back();return false">Back to Internet Download Hub</a></p>`,
      );
  };

  proc.on('error', (err) => {
    console.error('[download] spawn error:', err.message);
    fail(err.message);
  });

  proc.on('close', (code) => {
    if (res.destroyed) return cleanUp(); // the visitor left; nothing to send
    const stderr = Buffer.concat(stderrChunks).toString();
    const file = fs.readdirSync(workDir).find((f) => f.startsWith('download.') && !f.endsWith('.part'));
    if (code !== 0 || !file) {
      console.error(`[download] yt-dlp exited with code ${code}: ${stderr.slice(0, 300)}`);
      return fail(stderr);
    }
    // The saved name keeps the visitor's title with the extension yt-dlp actually produced.
    const name = path.parse(safeFilename).name + path.extname(file);
    res.download(path.join(workDir, file), name, (err) => {
      cleanUp();
      if (err) console.error(`[download] Sending ${name} failed: ${err.message}`);
      else console.log(`[download] Completed: ${name}`);
    });
  });

  // 'close' on the response: the request's own 'close' fires once a GET has been read.
  res.on('close', () => {
    if (proc.exitCode !== null) return;
    // On Windows yt-dlp.exe is a launcher; killing only it leaves the download running.
    if (process.platform === 'win32') spawn('taskkill', ['/pid', String(proc.pid), '/T', '/F']);
    else proc.kill('SIGTERM');
  });
});

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, yt_dlp: YT_DLP });
});

// In production, serve the Vite-built frontend
const isProd = process.env.NODE_ENV === 'production';
if (isProd) {
  const distPath = path.resolve(__dirname, '..', 'dist');
  app.use(express.static(distPath));
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

const host = isProd ? '0.0.0.0' : 'localhost';
const PORT = parseInt(process.env.PORT || '3001', 10);

app.listen(PORT, host, () => {
  console.log(`[API] Server running on http://${host}:${PORT}`);
});

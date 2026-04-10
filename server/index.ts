import express from 'express';
import cors from 'cors';
import { spawn, execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

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
    const args = [
      '-J',
      '--no-warnings',
      '--no-playlist',
      '--user-agent',
      UA,
      '--add-header',
      'Accept-Language:en-US,en;q=0.9',
      '--',
      url,
    ];

    const { stdout } = await execFileAsync(YT_DLP, args, {
      timeout: 60000,
      maxBuffer: 50 * 1024 * 1024,
    });

    const info = JSON.parse(stdout);
    const data = parseYtDlpJson(info, url);

    return res.json({
      success: true,
      data,
      meta: {
        playlistDetected: false,
        detectPlaylistsEnabled: false,
        collapsedToSingle: false,
      },
    });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    console.error('[video-info] error:', err.message?.slice(0, 300));
    const msg = err.stderr?.slice(0, 300) || err.message || 'Failed to fetch video info';
    return res.status(500).json({ success: false, error: msg });
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

  res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
  res.setHeader('Content-Type', isAudio ? 'audio/mpeg' : 'video/mp4');

  let args: string[];

  if (isAudio) {
    args = [
      '-f', 'bestaudio',
      '--extract-audio',
      '--audio-format', 'mp3',
      '--audio-quality', '0',
      '--user-agent', UA,
      '--add-header', 'Accept-Language:en-US,en;q=0.9',
      '--no-warnings',
      '--no-playlist',
      '--ffmpeg-location', FFMPEG,
      '-o', '-',
      '--', url,
    ];
  } else {
    const formatArg =
      formatId === 'bestvideo+bestaudio' || !formatId
        ? 'bestvideo+bestaudio/best'
        : formatId === 'bestaudio'
          ? 'bestaudio/best'
          : `${formatId}+bestaudio`;

    args = [
      '-f', formatArg,
      '--user-agent', UA,
      '--add-header', 'Accept-Language:en-US,en;q=0.9',
      '--no-warnings',
      '--no-playlist',
      '--merge-output-format', 'mp4',
      '--ffmpeg-location', FFMPEG,
      '-o', '-',
      '--', url,
    ];
  }

  console.log(`[download] Starting: ${url} | format: ${formatId} | file: ${safeFilename}`);

  const proc = spawn(YT_DLP, args, { stdio: ['ignore', 'pipe', 'pipe'] });

  proc.stdout.pipe(res);

  const stderrChunks: Buffer[] = [];
  proc.stderr.on('data', (chunk: Buffer) => stderrChunks.push(chunk));

  proc.on('error', (err) => {
    console.error('[download] spawn error:', err.message);
    if (!res.headersSent) {
      res.status(500).send('Download failed');
    } else {
      res.destroy();
    }
  });

  proc.on('close', (code) => {
    if (code !== 0) {
      const stderr = Buffer.concat(stderrChunks).toString().slice(0, 300);
      console.error(`[download] yt-dlp exited with code ${code}: ${stderr}`);
    } else {
      console.log(`[download] Completed: ${safeFilename}`);
    }
  });

  req.on('close', () => {
    proc.kill('SIGTERM');
  });
});

// ── Cobalt proxy — handles JWT auth for web version ────────────────────────────
const COBALT_INSTANCES = [
  'https://cobalt-api.meowing.de',
  'https://api.cobalt.tools',
  'https://cobalt-backend.canine.tools',
];

app.post('/api/cobalt', async (req, res) => {
  const body = req.body;

  if (!body || typeof body !== 'object' || !body.url) {
    res.status(400).json({ error: { code: 'error.request.empty_url' } });
    return;
  }

  let lastError: unknown = null;

  for (const instance of COBALT_INSTANCES) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(`${instance}/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': UA,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        lastError = new Error(`Instance ${instance} returned ${response.status}`);
        continue;
      }

      const data = await response.json();
      res.json(data);
      return;
    } catch (err: unknown) {
      lastError = err;
    }
  }

  const finalMsg = lastError instanceof Error ? lastError.message : String(lastError || 'Unknown error');
  res.status(503).json({
    status: 'error',
    error: { code: 'error.cobalt.unreachable', message: finalMsg },
  });
});

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

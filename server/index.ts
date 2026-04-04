import express from 'express';
import cors from 'cors';
import { spawn, execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';

import { fileURLToPath } from 'url';

const execFileAsync = promisify(execFile);

const app = express();

app.use(cors());
app.use(express.json());

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function getYtDlpPath(): string {
  if (process.env.YTDLP_PATH) return process.env.YTDLP_PATH;
  const local = path.resolve(__dirname, '../binaries/yt-dlp');
  if (typeof fs !== 'undefined' && fs.existsSync(local)) return local;
  return 'yt-dlp'; // assumes it is on PATH (installed by Dockerfile)
}

const YT_DLP = getYtDlpPath();
const FFMPEG = 'ffmpeg';
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function formatBytes(bytes: number): string {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function parseYtDlpJson(info: any, fallbackUrl: string) {
  const resolvedUrl = info?.webpage_url || info?.url || info?.original_url || fallbackUrl;

  const formats = (info.formats || [])
    .filter((f: any) => f.height && (f.acodec !== 'none' || f.vcodec !== 'none'))
    .map((f: any) => ({
      formatId: f.format_id,
      label: `${f.height}p ${f.ext?.toUpperCase() || ''} ${
        f.filesize || f.filesize_approx
          ? '(' + formatBytes(f.filesize || f.filesize_approx) + ')'
          : ''
      }`.trim(),
      quality: `${f.height}p`,
      ext: f.ext,
      filesize: f.filesize || f.filesize_approx || null,
      height: f.height,
    }))
    .sort((a: any, b: any) => (b.height || 0) - (a.height || 0));

  const seen = new Set();
  const uniqueFormats = formats.filter((f: any) => {
    if (seen.has(f.height)) return false;
    seen.add(f.height);
    return true;
  });

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
  res.setHeader('Transfer-Encoding', 'chunked');

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
    args = [
      '-f', formatId,
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
// The web version cannot make direct Cobalt API calls because instances now require
// JWT authentication. This proxy adds the necessary auth header and forwards requests.

const COBALT_INSTANCES = [
  'https://cobalt-api.meowing.de',
  'https://api.cobalt.tools',
  'https://cobalt-backend.canine.tools',
];

app.post('/api/cobalt', async (req, res) => {
  const body = req.body;

  // Validate the request
  if (!body || typeof body !== 'object' || !body.url) {
    res.status(400).json({ error: { code: 'error.request.empty_url' } });
    return;
  }

  let lastError: unknown = null;

  // Try each Cobalt instance with fallback
  for (const instance of COBALT_INSTANCES) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

      const response = await fetch(`${instance}/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.warn(`[Cobalt] Instance ${instance} returned ${response.status}`);
        lastError = new Error(`Instance ${instance} returned ${response.status}`);
        continue;
      }

      const data = await response.json();
      res.json(data);
      return;
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.warn(`[Cobalt] Instance ${instance} failed: ${errMsg}`);
      lastError = err;
    }
  }

  // All instances failed
  const finalMsg = lastError instanceof Error ? lastError.message : String(lastError || 'Unknown error');
  console.error(`[Cobalt] All instances failed. Last error: ${finalMsg}`);
  res.status(503).json({
    status: 'error',
    error: { code: 'error.cobalt.unreachable', message: finalMsg },
  });
});

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, yt_dlp: YT_DLP });
});

// In production, serve the Vite-built frontend and handle client-side routing
const isProd = process.env.NODE_ENV === 'production';
if (isProd) {
  const appDistPath = path.resolve(process.cwd(), 'docs/app');
  app.use(express.static(appDistPath));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(appDistPath, 'index.html'));
  });
}

const host = isProd ? '0.0.0.0' : 'localhost';
const PORT = parseInt(process.env.PORT || '3001', 10);

app.listen(PORT, host, () => {
  console.log(`[API] Server running on http://${host}:${PORT}`);
});

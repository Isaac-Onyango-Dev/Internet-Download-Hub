// ============================================================================
// VIDEO METADATA EXTRACTION SYSTEM
// ============================================================================
// This module handles extracting video information from various sources using
// multiple extraction engines (yt-dlp, streamlink, playwright, etc.)
//
// It provides a unified interface for:
// - Video metadata extraction (title, duration, formats, etc.)
// - Playlist information extraction
// - Fallback extraction methods for difficult sites
// - Format standardization and validation
// ============================================================================

import fs from 'fs';
import { spawn } from 'child_process';
import execa from 'execa';

// ── Internal types for yt-dlp JSON output ─────────────────────────────────────
interface YtDlpFormat {
  format_id: string;
  ext: string;
  height: number | null;
  acodec: string;
  vcodec: string;
  filesize: number | null;
  filesize_approx: number | null;
}

interface YtDlpEntry {
  _type?: string;
  webpage_url?: string;
  url?: string;
  original_url?: string;
  title?: string;
  thumbnail?: string;
  duration?: number;
  uploader?: string;
  channel?: string;
  playlist_count?: number;
  formats?: YtDlpFormat[];
  entries?: YtDlpEntry[];
  error?: string;
  [key: string]: unknown;
}
// playwright-core is loaded dynamically only when needed (not bundled in installer)
import { analyseUrl, Engine } from './url-analyser';
import log from 'electron-log';
import {
  ytDlpCommonArgs,
  ytDlpCookiesArgs,
  isYouTubeUrl,
  type YoutubePlayerClient,
} from './ytdlp-args';
import { isLikelyYoutubeAgeRestrictionError } from './errors';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Standardized video information structure returned by all extraction engines
 */
export interface VideoInfo {
  /** The URL that yt-dlp should download from (must be defined to persist to SQLite) */
  url: string;
  /** Video title */
  title: string;
  /** Thumbnail image URL */
  thumbnail: string;
  /** Video duration in seconds */
  duration: number;
  /** Channel/uploader name */
  uploader: string;
  /** Available video formats for download */
  formats: VideoFormat[];
  /** Extracted URL if different from input (e.g., from playwright) */
  extractedUrl?: string;
  /** Which extraction engine was used */
  extractionMethod: Engine;
}

/**
 * Video format information for download selection
 */
export interface VideoFormat {
  /** Format identifier used by yt-dlp */
  formatId: string;
  /** Human-readable format label */
  label: string;
  /** Quality description (e.g., '720p', 'best') */
  quality: string;
  /** File extension */
  ext: string;
  /** File size in bytes (null if unknown) */
  filesize: number | null;
  /** Video height in pixels (null for audio-only) */
  height: number | null;
}

// ============================================================================
// MAIN EXTRACTION FUNCTIONS
// ============================================================================

/**
 * Extracts video information using multiple engines in priority order
 * Tries each engine until one succeeds, providing robust fallback support
 *
 * @param url - Video URL to extract information from
 * @param paths - Paths to binary tools and optional cookies file
 * @returns Promise with video info (single video or array for playlists)
 */
export async function extractVideoInfo(
  url: string,
  paths: {
    ytDlp: string; // Path to yt-dlp executable
    ffmpeg: string; // Path to ffmpeg executable
    streamlink: string; // Path to streamlink executable
    nm3u8dl: string; // Path to N_m3u8DL-RE executable
    galleryDl: string; // Path to gallery-dl executable
    /** Netscape cookies file (e.g. exported from browser) — optional */
    cookiesFile?: string | null;
  },
): Promise<VideoInfo | VideoInfo[]> {
  // Analyze URL to determine which engines to try and in what order
  const { engineOrder } = analyseUrl(url);
  log.info(`[Extractor] Engine order for ${url}: ${engineOrder.join(', ')}`);

  let lastError: unknown = null;

  // Try each engine in order until one succeeds
  for (const engine of engineOrder) {
    try {
      log.info(`[Extractor] Trying engine: ${engine}...`);
      let result: VideoInfo | VideoInfo[];

      switch (engine) {
        case 'yt-dlp':
          result = await runYtDlp(url, paths.ytDlp, paths.cookiesFile);
          break;
        case 'streamlink':
          result = await runStreamlink(url, paths.streamlink);
          break;
        case 'n-m3u8dl':
          result = await runNm3u8dl(url, paths.nm3u8dl);
          break;
        case 'gallery-dl':
          result = await runGalleryDl(url, paths.galleryDl);
          break;
        case 'playwright':
          result = await extractWithPlaywright(url, paths.ytDlp, paths.cookiesFile);
          break;
        default:
          continue;
      }

      log.info(`[Extractor] Success with engine: ${engine}`);
      return result;
    } catch (err: unknown) {
      log.warn(`[Extractor] Engine ${engine} failed: ${err instanceof Error ? err.message : String(err)}`);
      lastError = err;
    }
  }

  // If all engines failed, throw the last error
  throw lastError || new Error('All extraction engines failed.');
}

// ============================================================================
// YT-DLP ENGINE IMPLEMENTATION
// ============================================================================

// User agent string to mimic Chrome browser for better compatibility
const YT_DLP_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/**
 * Builds command-line arguments for yt-dlp JSON extraction
 * @param url - URL to extract from
 * @param cookiesFile - Optional cookies file path
 * @param youtubeClient - YouTube player client for age-restricted content
 * @returns Array of command-line arguments
 */
function buildYtDlpJsonArgs(
  url: string,
  cookiesFile: string | null | undefined,
  youtubeClient?: YoutubePlayerClient,
): string[] {
  return [
    '-J', // Output JSON format
    '--no-warnings', // Suppress warnings
    '--user-agent',
    YT_DLP_UA, // Set user agent
    '--add-header',
    'Accept-Language:en-US,en;q=0.9', // Set language header
    ...ytDlpCommonArgs(url, {
      // Common yt-dlp arguments
      noPlaylist: true, // Don't extract playlists
      ...(youtubeClient !== undefined ? { youtubePlayerClient: youtubeClient } : {}),
    }),
    ...ytDlpCookiesArgs(cookiesFile), // Add cookies if available
    '--', // Prevent parameter injection
    url, // Target URL
  ];
}

/**
 * Parses yt-dlp JSON output into standardized VideoInfo format
 * Handles both single videos and playlists
 * @param stdout - JSON output from yt-dlp
 * @param pageUrl - Original URL for fallback
 * @returns VideoInfo or array of VideoInfo for playlists
 */
function parseYtDlpJsonStdout(stdout: string, pageUrl: string): VideoInfo | VideoInfo[] {
  const info = JSON.parse(stdout);

  // Check if this is a playlist
  if (info._type === 'playlist' && Array.isArray(info.entries)) {
    return (info as YtDlpEntry).entries!.map((entry: YtDlpEntry) =>
      parseYtDlpInfo({ ...entry, uploader: entry.channel || info.uploader }, pageUrl),
    );
  }

  // Single video
  return parseYtDlpInfo(info, pageUrl);
}

/**
 * Executes yt-dlp for video information extraction
 * Handles age-restricted YouTube content by retrying with different client
 * @param url - Video URL to extract
 * @param ytDlpPath - Path to yt-dlp executable
 * @param cookiesFile - Optional cookies file path
 * @returns Promise with video info
 */
async function runYtDlp(
  url: string,
  ytDlpPath: string,
  cookiesFile?: string | null,
): Promise<VideoInfo | VideoInfo[]> {
  if (!fs.existsSync(ytDlpPath)) throw new Error('yt-dlp not found');

  try {
    // First attempt with standard settings
    const result = await execa(ytDlpPath, buildYtDlpJsonArgs(url, cookiesFile), {
      timeout: 120000,
    });
    return parseYtDlpJsonStdout(result.stdout, url);
  } catch (err: unknown) {
    const stderr = String((err as Record<string, unknown>).stderr ?? (err instanceof Error ? err.message : '') ?? '');

    // Special handling for YouTube age-restricted content
    if (isYouTubeUrl(url) && isLikelyYoutubeAgeRestrictionError(stderr)) {
      log.info('[Extractor] Retrying yt-dlp info with youtube:player_client=tv_embedded');
      const result = await execa(ytDlpPath, buildYtDlpJsonArgs(url, cookiesFile, 'tv_embedded'), {
        timeout: 120000,
      });
      return parseYtDlpJsonStdout(result.stdout, url);
    }

    throw err;
  }
}

// ============================================================================
// OTHER EXTRACTION ENGINES
// ============================================================================

/**
 * Extracts live stream information using streamlink
 * @param url - Live stream URL
 * @param streamlinkPath - Path to streamlink executable
 * @returns Promise with stream video info
 */
async function runStreamlink(url: string, streamlinkPath: string): Promise<VideoInfo> {
  if (!fs.existsSync(streamlinkPath)) throw new Error('streamlink not found');

  const result = await execa(streamlinkPath, ['--json', '--', url], { timeout: 30000 });
  const info = JSON.parse(result.stdout);

  if (info.error) throw new Error(info.error);

  // Get the best available stream
  const streams = info.streams || {};
  const bestStream = (streams as Record<string, unknown>).best || Object.values(streams as Record<string, unknown>)[0];
  if (!bestStream) throw new Error('No streams found for this URL.');

  return {
    url,
    title: info.metadata?.title || 'Live Stream',
    thumbnail: info.metadata?.thumbnail || '',
    duration: 0, // Live streams have no duration
    uploader: info.metadata?.author || new URL(url).hostname,
    extractionMethod: 'streamlink',
    formats: [
      {
        formatId: 'best',
        label: 'Live Stream (Best)',
        quality: 'best',
        ext: 'ts', // Typical live stream format
        filesize: null,
        height: null,
      },
    ],
  };
}

/**
 * Placeholder for N_m3u8DL-RE extraction engine
 * Currently only used as a download engine, not for metadata extraction
 * @param url - HLS/DASH stream URL
 * @param nm3u8dlPath - Path to N_m3u8DL-RE executable
 * @returns Promise with video info (not implemented)
 */
async function runNm3u8dl(url: string, nm3u8dlPath: string): Promise<VideoInfo> {
  if (!fs.existsSync(nm3u8dlPath)) throw new Error('N_m3u8DL-RE not found');

  // N_m3u8DL-RE is more of a downloader than an extractor, but we can use it to probe manifests
  // For simplicity, we'll treat it as a fallback that playwright might feed manifest URLs to
  throw new Error('N_m3u8DL-RE extraction not fully implemented — use as download engine only.');
}

/**
 * Extracts image gallery information using gallery-dl
 * @param url - Gallery URL (Twitter, Instagram, etc.)
 * @param galleryDlPath - Path to gallery-dl executable
 * @returns Promise with gallery info
 */
async function runGalleryDl(url: string, galleryDlPath: string): Promise<VideoInfo> {
  if (!fs.existsSync(galleryDlPath)) throw new Error('gallery-dl not found');

  const result = await execa(galleryDlPath, ['-j', '--', url], { timeout: 30000 });
  const info = JSON.parse(result.stdout);

  // gallery-dl output depends on the site, but usually it's an array of image data
  return {
    url,
    title: 'Image Gallery',
    thumbnail: Array.isArray(info) ? info[0]?.url || '' : '',
    duration: 0, // Images have no duration
    uploader: new URL(url).hostname,
    extractionMethod: 'gallery-dl',
    formats: [
      {
        formatId: 'best',
        label: 'Full Quality Gallery',
        quality: 'best',
        ext: 'zip', // Typically downloaded as archive
        filesize: null,
        height: null,
      },
    ],
  };
}

async function execYtDlpPlaylistJson(
  ytDlpPath: string,
  pageUrl: string,
  opts: {
    playlistItemLimit?: number;
    youtubePlayerClient?: YoutubePlayerClient;
    cookiesFile?: string | null;
  },
) {
  const args: string[] = [
    '-J',
    '--no-warnings',
    '--user-agent',
    YT_DLP_UA,
    '--add-header',
    'Accept-Language:en-US,en;q=0.9',
    ...ytDlpCommonArgs(pageUrl, {
      noPlaylist: false,
      ...(opts.youtubePlayerClient !== undefined
        ? { youtubePlayerClient: opts.youtubePlayerClient }
        : {}),
    }),
    ...ytDlpCookiesArgs(opts.cookiesFile),
  ];

  if (opts.playlistItemLimit && Number.isFinite(opts.playlistItemLimit)) {
    args.push('--playlist-items', String(opts.playlistItemLimit));
  }

  args.push('--', pageUrl);
  return execa(ytDlpPath, args, { timeout: 120000 });
}

export async function extractPlaylistInfo(
  url: string,
  paths: {
    ytDlp: string;
    ffmpeg: string;
    cookiesFile?: string | null;
  },
  opts?: { playlistItemLimit?: number },
): Promise<{
  title: string;
  uploader: string;
  videoCount: number;
  videos: VideoInfo[];
}> {
  let result;
  try {
    result = await execYtDlpPlaylistJson(paths.ytDlp, url, {
      playlistItemLimit: opts?.playlistItemLimit,
      cookiesFile: paths.cookiesFile,
    });
  } catch (err: unknown) {
    const stderr = String((err as Record<string, unknown>).stderr ?? (err instanceof Error ? err.message : '') ?? '');
    if (isYouTubeUrl(url) && isLikelyYoutubeAgeRestrictionError(stderr)) {
      log.info('[Extractor] Retrying playlist yt-dlp with youtube:player_client=tv_embedded');
      result = await execYtDlpPlaylistJson(paths.ytDlp, url, {
        playlistItemLimit: opts?.playlistItemLimit,
        youtubePlayerClient: 'tv_embedded',
        cookiesFile: paths.cookiesFile,
      });
    } else {
      throw err;
    }
  }

  const info = JSON.parse(result.stdout);

  if (info?._type !== 'playlist' || !Array.isArray(info.entries)) {
    throw new Error('This URL does not appear to be a playlist.');
  }

  const videos = (info as YtDlpEntry).entries!.map((entry: YtDlpEntry) =>
    parseYtDlpInfo({ ...entry, uploader: entry.channel || info.uploader }, url),
  );

  return {
    title: info.title || 'Playlist',
    uploader: info.uploader || info.channel || '',
    videoCount: info.playlist_count || videos.length,
    videos,
  };
}

/**
 * Streams playlist information video by video using yt-dlp --dump-json.
 * This prevents the UI from hanging on large playlists.
 */
export async function streamPlaylistInfo(
  url: string,
  paths: {
    ytDlp: string;
    cookiesFile?: string | null;
  },
  onVideoDetected: (video: VideoInfo, index: number, total: number) => void,
  onComplete: (metadata: { title: string; uploader: string; videoCount: number }) => void,
  onError: (err: Error) => void,
) {
  if (!fs.existsSync(paths.ytDlp)) {
    onError(new Error('yt-dlp not found'));
    return;
  }

  const args: string[] = [
    '--dump-json',
    '--flat-playlist',
    '--no-warnings',
    '--user-agent',
    YT_DLP_UA,
    ...ytDlpCommonArgs(url, { noPlaylist: false }),
    ...ytDlpCookiesArgs(paths.cookiesFile),
    '--',
    url,
  ];

  log.info('[Extractor] Streaming playlist info:', url);
  const process = spawn(paths.ytDlp, args);

  let incompleteLine = '';
  let playlistMetadata: { title: string; uploader: string; videoCount: number } | null = null;
  let detectedCount = 0;

  process.stdout.on('data', (data: Buffer) => {
    const chunk = data.toString();
    const lines = (incompleteLine + chunk).split('\n');
    incompleteLine = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const info = JSON.parse(line);

        // The first few lines might be playlist metadata if it's a playlist object
        if (info._type === 'playlist') {
          playlistMetadata = {
            title: info.title || 'Playlist',
            uploader: info.uploader || info.channel || '',
            videoCount: info.playlist_count || 0,
          };
          continue;
        }

        // Otherwise it's a video entry
        detectedCount++;
        const video = parseYtDlpInfo(info, url);
        onVideoDetected(video, detectedCount, playlistMetadata?.videoCount || 0);
      } catch (e) {
        log.error('[Extractor] Error parsing playlist stream line:', e);
      }
    }
  });

  process.stderr.on('data', (data: Buffer) => {
    const stderr = data.toString();
    log.warn('[Extractor] yt-dlp playlist stream stderr:', stderr);
  });

  process.on('close', (code: number | null) => {
    if (code === 0) {
      if (playlistMetadata) {
        onComplete(playlistMetadata);
      } else {
        onComplete({ title: 'Playlist', uploader: '', videoCount: detectedCount });
      }
    } else {
      onError(new Error(`yt-dlp exited with code ${code}`));
    }
  });

  process.on('error', (err: Error) => {
    onError(err);
  });
}

async function extractWithPlaywright(
  pageUrl: string,
  ytDlpPath: string,
  cookiesFile?: string | null,
): Promise<VideoInfo> {
  // Dynamically import playwright-core so it is never required at startup.
  // The package is NOT bundled inside the installer — it is an optional dependency
  // that is present only in the development node_modules tree.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let chromium: { executablePath: () => string; launch: (opts: Record<string, unknown>) => Promise<unknown> };
  try {
    // @ts-expect-error — playwright-core is an optional peer dependency loaded at runtime
    const playwrightCore = await import('playwright-core');
    chromium = playwrightCore.chromium;
  } catch {
    throw new Error(
      'The playwright-core package is not available. ' +
      'This extraction engine cannot be used in the packaged app.',
    );
  }

  // Check that Chromium is actually installed before trying to launch
  const browserPath = chromium.executablePath();
  if (!fs.existsSync(browserPath)) {
    throw new Error(
      'This site requires deeper analysis but the browser component is not installed yet. ' +
      'Please restart the app to trigger automatic installation, or try a YouTube link instead.',
    );
  }

  const browser = await chromium.launch({
    executablePath: browserPath,
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled',
    ],
  });

  try {
    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
    });

    const page = await context.newPage();
    const capturedUrls: string[] = [];

    // Intercept ALL network requests and capture video-related ones
    page.on('request', (request: { url: () => string }) => {
      const url = request.url();

      // Capture HLS manifests
      if (url.includes('.m3u8') || url.includes('manifest') || url.includes('.mpd')) {
        console.log('[Playwright] Captured manifest URL:', url);
        capturedUrls.push(url);
      }

      // Capture direct video files
      if (url.match(/\.(mp4|webm|mkv|avi|mov)(\?|$)/i)) {
        console.log('[Playwright] Captured video URL:', url);
        capturedUrls.push(url);
      }
    });

    page.on('response', async (response: { url: () => string; headers: () => Record<string, string> }) => {
      const url = response.url();
      const contentType = response.headers()['content-type'] || '';

      // Capture by content type
      if (
        contentType.includes('video/') ||
        contentType.includes('application/x-mpegURL') ||
        contentType.includes('application/vnd.apple.mpegurl') ||
        contentType.includes('application/dash+xml')
      ) {
        console.log('[Playwright] Captured by content-type:', url);
        capturedUrls.push(url);
      }
    });

    console.log('[Playwright] Loading page:', pageUrl);
    await page.goto(pageUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    // Wait a moment for JavaScript to execute and video to initialize
    await page.waitForTimeout(3000);

    // Try to click a play button if video hasn't auto-started
    const playSelectors = [
      'button[class*="play"]',
      '.play-button',
      '.jw-icon-playback',
      '.plyr__control--overlaid',
      '[aria-label*="play" i]',
      'video',
    ];
    for (const selector of playSelectors) {
      try {
        await page.click(selector, { timeout: 2000 });
        console.log('[Playwright] Clicked play button:', selector);
        await page.waitForTimeout(3000);
        break;
      } catch {
        console.debug('[Playwright] Failed to click ' + selector);
      }
    }

    // Extract page metadata for title and thumbnail
    const metadata = await page.evaluate(() => ({
      title:
        document.title ||
        document.querySelector('h1')?.textContent ||
        document.querySelector('meta[property="og:title"]')?.getAttribute('content') ||
        'Unknown Title',
      thumbnail:
        document.querySelector('meta[property="og:image"]')?.getAttribute('content') ||
        document.querySelector('video')?.getAttribute('poster') ||
        '',
      duration: (() => {
        const video = document.querySelector('video') as HTMLVideoElement;
        return video?.duration || 0;
      })(),
    }));

    await browser.close();

    if (capturedUrls.length === 0) {
      throw new Error(
        'Could not find any video stream on this page. The site may require login or use DRM protection.',
      );
    }

    // Use the first captured URL — prefer m3u8 over direct mp4
    const bestUrl =
      capturedUrls.find((u) => u.includes('.m3u8')) ||
      capturedUrls.find((u) => u.includes('.mpd')) ||
      capturedUrls[0];

    console.log('[Playwright] Best extracted URL:', bestUrl);

    // Now try yt-dlp on the extracted URL for proper format info
    try {
      const result = await execa(
        ytDlpPath,
        [
          '--dump-json',
          '--no-warnings',
          ...ytDlpCommonArgs(bestUrl, { noPlaylist: true }),
          ...ytDlpCookiesArgs(cookiesFile),
          '--',
          bestUrl,
        ],
        { timeout: 15000 },
      );
      const info = JSON.parse(result.stdout);
      return {
        ...parseYtDlpInfo(info, bestUrl),
        title: metadata.title || info.title || 'Extracted Video',
        thumbnail: metadata.thumbnail || info.thumbnail || '',
        extractedUrl: bestUrl,
        extractionMethod: 'playwright',
      };
    } catch {
      // Return basic info with the raw extracted URL
      return {
        url: bestUrl,
        title: metadata.title || 'Extracted Video',
        thumbnail: metadata.thumbnail || '',
        duration: metadata.duration || 0,
        uploader: new URL(pageUrl).hostname,
        extractedUrl: bestUrl,
        extractionMethod: 'playwright',
        formats: [
          {
            formatId: 'best',
            label: 'Best Available Quality',
            quality: 'best',
            ext: bestUrl.includes('.m3u8') ? 'mp4' : 'mp4',
            filesize: null,
            height: null,
          },
        ],
      };
    }
  } catch (error) {
    await browser.close();
    throw error;
  }
}

function parseYtDlpInfo(info: YtDlpEntry, fallbackUrl: string): VideoInfo {
  const resolvedUrl = info?.webpage_url || info?.url || info?.original_url || fallbackUrl;

  const formats = (info.formats || [])
    .filter((f: YtDlpFormat) => f.height && (f.acodec !== 'none' || f.vcodec !== 'none'))
    .map((f: YtDlpFormat) => ({
      formatId: f.format_id,
      label:
        `${f.height}p ${f.ext?.toUpperCase() || ''} ${f.filesize || f.filesize_approx ? '(' + formatBytes((f.filesize || f.filesize_approx) as number) + ')' : ''}`.trim(),
      quality: `${f.height}p`,
      ext: f.ext,
      filesize: f.filesize || f.filesize_approx || null,
      height: f.height,
    }))
    .sort((a: VideoFormat, b: VideoFormat) => (b.height ?? 0) - (a.height ?? 0));

  const seen = new Set<number | null>();
  const uniqueFormats = formats.filter((f: VideoFormat) => {
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

function formatBytes(bytes: number): string {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

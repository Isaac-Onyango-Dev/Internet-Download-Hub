import fs from 'fs';
import path from 'path';
import execa from 'execa';
import { chromium } from 'playwright-core';
import { analyseUrl, Engine } from './url-analyser';
import log from 'electron-log';
import { ytDlpCommonArgs, ytDlpCookiesArgs, isYouTubeUrl, type YoutubePlayerClient } from './ytdlp-args';
import { isLikelyYoutubeAgeRestrictionError } from './errors';

export interface VideoInfo {
  // The URL that yt-dlp should download from (must be defined to persist to SQLite).
  url: string
  title: string
  thumbnail: string
  duration: number
  uploader: string
  formats: VideoFormat[]
  extractedUrl?: string
  extractionMethod: Engine;
}

export interface VideoFormat {
  formatId: string
  label: string
  quality: string
  ext: string
  filesize: number | null
  height: number | null
}

export async function extractVideoInfo(
  url: string,
  paths: {
    ytDlp: string;
    ffmpeg: string;
    streamlink: string;
    nm3u8dl: string;
    galleryDl: string;
    /** Netscape cookies file (e.g. exported from browser) — optional */
    cookiesFile?: string | null;
  }
): Promise<VideoInfo | VideoInfo[]> {
  const { engineOrder } = analyseUrl(url);
  log.info(`[Extractor] Engine order for ${url}: ${engineOrder.join(', ')}`);

  let lastError: any = null;

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
    } catch (err: any) {
      log.warn(`[Extractor] Engine ${engine} failed: ${err.message}`);
      lastError = err;
    }
  }

  throw lastError || new Error('All extraction engines failed.');
}

const YT_DLP_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

function buildYtDlpJsonArgs(
  url: string,
  cookiesFile: string | null | undefined,
  youtubeClient?: YoutubePlayerClient
): string[] {
  return [
    '-J',
    '--no-warnings',
    '--user-agent',
    YT_DLP_UA,
    '--add-header',
    'Accept-Language:en-US,en;q=0.9',
    ...ytDlpCommonArgs(url, {
      noPlaylist: true,
      ...(youtubeClient !== undefined ? { youtubePlayerClient: youtubeClient } : {}),
    }),
    ...ytDlpCookiesArgs(cookiesFile),
    url,
  ]
}

function parseYtDlpJsonStdout(stdout: string, pageUrl: string): VideoInfo | VideoInfo[] {
  const info = JSON.parse(stdout)
  if (info._type === 'playlist' && Array.isArray(info.entries)) {
    return info.entries.map((entry: any) =>
      parseYtDlpInfo({ ...entry, uploader: entry.channel || info.uploader }, pageUrl)
    )
  }
  return parseYtDlpInfo(info, pageUrl)
}

async function runYtDlp(
  url: string,
  ytDlpPath: string,
  cookiesFile?: string | null
): Promise<VideoInfo | VideoInfo[]> {
  if (!fs.existsSync(ytDlpPath)) throw new Error('yt-dlp not found')
  try {
    const result = await execa(ytDlpPath, buildYtDlpJsonArgs(url, cookiesFile), { timeout: 120000 })
    return parseYtDlpJsonStdout(result.stdout, url)
  } catch (err: any) {
    const stderr = String(err.stderr ?? err.message ?? '')
    if (isYouTubeUrl(url) && isLikelyYoutubeAgeRestrictionError(stderr)) {
      log.info('[Extractor] Retrying yt-dlp info with youtube:player_client=tv_embedded')
      const result = await execa(ytDlpPath, buildYtDlpJsonArgs(url, cookiesFile, 'tv_embedded'), {
        timeout: 120000,
      })
      return parseYtDlpJsonStdout(result.stdout, url)
    }
    throw err
  }
}

async function runStreamlink(url: string, streamlinkPath: string): Promise<VideoInfo> {
  if (!fs.existsSync(streamlinkPath)) throw new Error('streamlink not found');
  const result = await execa(streamlinkPath, [url, '--json'], { timeout: 30000 });
  const info = JSON.parse(result.stdout);
  
  if (info.error) throw new Error(info.error);
  
  const streams = info.streams || {};
  const bestStream = streams.best || Object.values(streams)[0] as any;
  if (!bestStream) throw new Error('No streams found for this URL.');

  return {
    url,
    title: info.metadata?.title || 'Live Stream',
    thumbnail: info.metadata?.thumbnail || '',
    duration: 0,
    uploader: info.metadata?.author || new URL(url).hostname,
    extractionMethod: 'streamlink',
    formats: [{
      formatId: 'best',
      label: 'Live Stream (Best)',
      quality: 'best',
      ext: 'ts',
      filesize: null,
      height: null
    }]
  };
}

async function runNm3u8dl(url: string, nm3u8dlPath: string): Promise<VideoInfo> {
  if (!fs.existsSync(nm3u8dlPath)) throw new Error('N_m3u8DL-RE not found');
  // N_m3u8DL-RE is more of a downloader than an extractor, but we can use it to probe manifests
  // For simplicity, we'll treat it as a fallback that playwright might feed manifest URLs to
  throw new Error('N_m3u8DL-RE extraction not fully implemented — use as download engine only.');
}

async function runGalleryDl(url: string, galleryDlPath: string): Promise<VideoInfo> {
  if (!fs.existsSync(galleryDlPath)) throw new Error('gallery-dl not found');
  const result = await execa(galleryDlPath, ['-j', url], { timeout: 30000 });
  const info = JSON.parse(result.stdout);
  // gallery-dl output depends on the site, but usually it's an array of image data
  return {
    url,
    title: 'Image Gallery',
    thumbnail: Array.isArray(info) ? (info[0]?.url || '') : '',
    duration: 0,
    uploader: new URL(url).hostname,
    extractionMethod: 'gallery-dl',
    formats: [{
      formatId: 'best',
      label: 'Full Quality Gallery',
      quality: 'best',
      ext: 'zip',
      filesize: null,
      height: null
    }]
  };
}

async function execYtDlpPlaylistJson(
  ytDlpPath: string,
  pageUrl: string,
  opts: {
    playlistItemLimit?: number
    youtubePlayerClient?: YoutubePlayerClient
    cookiesFile?: string | null
  }
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
  ]

  if (opts.playlistItemLimit && Number.isFinite(opts.playlistItemLimit)) {
    args.push('--playlist-items', String(opts.playlistItemLimit))
  }

  args.push(pageUrl)
  return execa(ytDlpPath, args, { timeout: 120000 })
}

export async function extractPlaylistInfo(
  url: string,
  paths: {
    ytDlp: string;
    ffmpeg: string;
    cookiesFile?: string | null;
  },
  opts?: { playlistItemLimit?: number }
): Promise<{
  title: string;
  uploader: string;
  videoCount: number;
  videos: VideoInfo[];
}> {
  let result
  try {
    result = await execYtDlpPlaylistJson(paths.ytDlp, url, {
      playlistItemLimit: opts?.playlistItemLimit,
      cookiesFile: paths.cookiesFile,
    })
  } catch (err: any) {
    const stderr = String(err.stderr ?? err.message ?? '')
    if (isYouTubeUrl(url) && isLikelyYoutubeAgeRestrictionError(stderr)) {
      log.info('[Extractor] Retrying playlist yt-dlp with youtube:player_client=tv_embedded')
      result = await execYtDlpPlaylistJson(paths.ytDlp, url, {
        playlistItemLimit: opts?.playlistItemLimit,
        youtubePlayerClient: 'tv_embedded',
        cookiesFile: paths.cookiesFile,
      })
    } else {
      throw err
    }
  }

  const info = JSON.parse(result.stdout);

  if (info?._type !== 'playlist' || !Array.isArray(info.entries)) {
    throw new Error('This URL does not appear to be a playlist.');
  }

  const videos = info.entries.map((entry: any) =>
    parseYtDlpInfo({ ...entry, uploader: entry.channel || info.uploader }, url)
  );

  return {
    title: info.title || 'Playlist',
    uploader: info.uploader || info.channel || '',
    videoCount: info.playlist_count || videos.length,
    videos,
  };
}

async function extractWithPlaywright(
  pageUrl: string,
  ytDlpPath: string,
  cookiesFile?: string | null
): Promise<VideoInfo> {
  // Check that Chromium is actually installed before trying to launch
  const browserPath = chromium.executablePath()
  if (!fs.existsSync(browserPath)) {
    throw new Error(
      'This site requires deeper analysis but the browser component is not installed yet. ' +
      'Please restart the app to trigger automatic installation, or try a YouTube link instead.'
    )
  }

  const browser = await chromium.launch({
    executablePath: browserPath,
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled'
    ]
  })

  try {
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 }
    })

    const page = await context.newPage()
    const capturedUrls: string[] = []

    // Intercept ALL network requests and capture video-related ones
    page.on('request', request => {
      const url = request.url()

      // Capture HLS manifests
      if (url.includes('.m3u8') || url.includes('manifest') || url.includes('.mpd')) {
        console.log('[Playwright] Captured manifest URL:', url)
        capturedUrls.push(url)
      }

      // Capture direct video files
      if (url.match(/\.(mp4|webm|mkv|avi|mov)(\?|$)/i)) {
        console.log('[Playwright] Captured video URL:', url)
        capturedUrls.push(url)
      }
    })

    page.on('response', async response => {
      const url = response.url()
      const contentType = response.headers()['content-type'] || ''

      // Capture by content type
      if (
        contentType.includes('video/') ||
        contentType.includes('application/x-mpegURL') ||
        contentType.includes('application/vnd.apple.mpegurl') ||
        contentType.includes('application/dash+xml')
      ) {
        console.log('[Playwright] Captured by content-type:', url)
        capturedUrls.push(url)
      }
    })

    console.log('[Playwright] Loading page:', pageUrl)
    await page.goto(pageUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    })

    // Wait a moment for JavaScript to execute and video to initialize
    await page.waitForTimeout(3000)

    // Try to click a play button if video hasn't auto-started
    const playSelectors = [
      'button[class*="play"]',
      '.play-button',
      '.jw-icon-playback',
      '.plyr__control--overlaid',
      '[aria-label*="play" i]',
      'video'
    ]
    for (const selector of playSelectors) {
      try {
        await page.click(selector, { timeout: 2000 })
        console.log('[Playwright] Clicked play button:', selector)
        await page.waitForTimeout(3000)
        break
      } catch {}
    }

    // Extract page metadata for title and thumbnail
    const metadata = await page.evaluate(() => ({
      title: document.title ||
        document.querySelector('h1')?.textContent ||
        document.querySelector('meta[property="og:title"]')?.getAttribute('content') ||
        'Unknown Title',
      thumbnail: document.querySelector('meta[property="og:image"]')?.getAttribute('content') ||
        document.querySelector('video')?.getAttribute('poster') || '',
      duration: (() => {
        const video = document.querySelector('video') as HTMLVideoElement
        return video?.duration || 0
      })()
    }))

    await browser.close()

    if (capturedUrls.length === 0) {
      throw new Error('Could not find any video stream on this page. The site may require login or use DRM protection.')
    }

    // Use the first captured URL — prefer m3u8 over direct mp4
    const bestUrl = capturedUrls.find(u => u.includes('.m3u8')) ||
                    capturedUrls.find(u => u.includes('.mpd')) ||
                    capturedUrls[0]

    console.log('[Playwright] Best extracted URL:', bestUrl)

    // Now try yt-dlp on the extracted URL for proper format info
    try {
      const result = await execa(ytDlpPath, [
        '--dump-json',
        '--no-warnings',
        ...ytDlpCommonArgs(bestUrl, { noPlaylist: true }),
        ...ytDlpCookiesArgs(cookiesFile),
        bestUrl
      ], { timeout: 15000 })
      const info = JSON.parse(result.stdout)
      return {
        ...parseYtDlpInfo(info, bestUrl),
        title: metadata.title || info.title || 'Extracted Video',
        thumbnail: metadata.thumbnail || info.thumbnail || '',
        extractedUrl: bestUrl,
        extractionMethod: 'playwright'
      }
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
            height: null
          }
        ]
      }
    }

  } catch (error) {
    await browser.close()
    throw error
  }
}

function parseYtDlpInfo(info: any, fallbackUrl: string): VideoInfo {
  const resolvedUrl =
    info?.webpage_url ||
    info?.url ||
    info?.original_url ||
    fallbackUrl

  const formats = (info.formats || [])
    .filter((f: any) => f.height && (f.acodec !== 'none' || f.vcodec !== 'none'))
    .map((f: any) => ({
      formatId: f.format_id,
      label: `${f.height}p ${f.ext?.toUpperCase() || ''} ${f.filesize || f.filesize_approx ? '(' + formatBytes(f.filesize || f.filesize_approx) + ')' : ''}`.trim(),
      quality: `${f.height}p`,
      ext: f.ext,
      filesize: f.filesize || f.filesize_approx || null,
      height: f.height
    }))
    .sort((a: any, b: any) => (b.height || 0) - (a.height || 0))

  const seen = new Set()
  const uniqueFormats = formats.filter((f: any) => {
    if (seen.has(f.height)) return false
    seen.add(f.height)
    return true
  })

  return {
    url: resolvedUrl,
    title: info.title || 'Unknown Video',
    thumbnail: info.thumbnail || '',
    duration: info.duration || 0,
    uploader: info.uploader || info.channel || '',
    extractionMethod: 'yt-dlp',
    formats: [
      { formatId: 'bestvideo+bestaudio', label: 'Best Quality (Recommended)', quality: 'best', ext: 'mp4', filesize: null, height: null },
      ...uniqueFormats,
      { formatId: 'bestaudio', label: 'Audio Only (MP3)', quality: 'audio', ext: 'mp3', filesize: null, height: null }
    ]
  }
}

function formatBytes(bytes: number): string {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

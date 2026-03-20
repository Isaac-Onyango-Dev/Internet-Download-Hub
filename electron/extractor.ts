import fs from 'fs';
import execa from 'execa';
import { chromium } from 'playwright-core';

export interface VideoInfo {
  // The URL that yt-dlp should download from (must be defined to persist to SQLite).
  url: string
  title: string
  thumbnail: string
  duration: number
  uploader: string
  formats: VideoFormat[]
  extractedUrl?: string
  extractionMethod: 'ytdlp' | 'playwright'
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
  ytDlpPath: string,
  ffmpegPath: string
): Promise<VideoInfo | VideoInfo[]> {

  // Tier 1 — Try yt-dlp first (fast, reliable for supported sites)
  try {
    console.log('[Extractor] Trying yt-dlp...')
    const origin = new URL(url).origin;
    const result = await execa(ytDlpPath, [
      '-J',
      '--no-warnings',
      '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      '--add-header', 'Accept-Language:en-US,en;q=0.9',
      url
    ], { timeout: 120000 })

    const info = JSON.parse(result.stdout)
    if (info._type === 'playlist' && Array.isArray(info.entries)) {
      return info.entries.map((entry: any) =>
        parseYtDlpInfo({ ...entry, uploader: entry.channel || info.uploader }, url)
      );
    }
    return parseYtDlpInfo(info, url)

  } catch (ytDlpError: any) {
    console.log('[Extractor] yt-dlp failed:', ytDlpError.message)
    console.log('[Extractor] Falling back to Playwright...')
  }

  // Tier 2 — Playwright fallback for unsupported sites
  return await extractWithPlaywright(url, ytDlpPath)
}

export async function extractPlaylistInfo(
  url: string,
  ytDlpPath: string,
  ffmpegPath: string,
  opts?: { playlistItemLimit?: number }
): Promise<{
  title: string;
  uploader: string;
  videoCount: number;
  videos: VideoInfo[];
}> {
  // Use yt-dlp directly so each entry contains formats (needed for per-video quality selection).
  const args = [
    '-J',
    '--no-warnings',
    '--user-agent',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    '--add-header',
    'Accept-Language:en-US,en;q=0.9',
  ] as string[];

  if (opts?.playlistItemLimit && Number.isFinite(opts.playlistItemLimit)) {
    args.push('--playlist-items', String(opts.playlistItemLimit));
  }

  args.push(url);

  const result = await execa(ytDlpPath, args, { timeout: 120000 });
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
  ytDlpPath: string
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
    extractionMethod: 'ytdlp',
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

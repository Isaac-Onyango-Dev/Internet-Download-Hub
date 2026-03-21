/**
 * Shared yt-dlp CLI flags for consistent behaviour across info extraction and downloads.
 */

import fs from 'fs'

/** Pass Netscape-format cookies from the user's browser export when the path exists. */
export function ytDlpCookiesArgs(cookiesFile: string | null | undefined): string[] {
  if (typeof cookiesFile !== 'string') return []
  const t = cookiesFile.trim()
  if (!t) return []
  try {
    if (fs.existsSync(t)) return ['--cookies', t]
  } catch {
    /* ignore */
  }
  return []
}

export function isYouTubeUrl(url: string): boolean {
  try {
    const h = new URL(url).hostname.toLowerCase()
    return (
      h === 'youtube.com' ||
      h.endsWith('.youtube.com') ||
      h === 'youtu.be' ||
      h.endsWith('.youtu.be')
    )
  } catch {
    return false
  }
}

export type YoutubePlayerClient = 'android' | 'tv_embedded'

/**
 * @param noPlaylist - false when fetching a real playlist (extractPlaylistInfo).
 */
export function ytDlpCommonArgs(
  url: string,
  options: { noPlaylist: boolean; youtubePlayerClient?: YoutubePlayerClient }
): string[] {
  const args: string[] = ['--age-limit', '99']
  if (options.noPlaylist) {
    args.push('--no-playlist')
  }
  if (isYouTubeUrl(url)) {
    const client = options.youtubePlayerClient ?? 'android'
    args.push('--extractor-args', `youtube:player_client=${client}`)
  }
  return args
}

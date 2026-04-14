/**
 * Shared yt-dlp CLI flags for consistent behaviour across info extraction and downloads.
 */

import fs from 'fs';

/** Pass Netscape-format cookies from the user's browser export when the path exists. */
export function ytDlpCookiesArgs(cookiesFile: string | null | undefined): string[] {
  if (typeof cookiesFile !== 'string') return [];
  const t = cookiesFile.trim();
  if (!t) return [];
  try {
    if (fs.existsSync(t)) return ['--cookies', t];
  } catch {
    /* ignore */
  }
  return [];
}

export function isYouTubeUrl(url: string): boolean {
  try {
    const h = new URL(url).hostname.toLowerCase();
    return (
      h === 'youtube.com' ||
      h.endsWith('.youtube.com') ||
      h === 'youtu.be' ||
      h.endsWith('.youtu.be')
    );
  } catch {
    return false;
  }
}

export type YoutubePlayerClient = 'android' | 'tv' | 'tv_embedded';

/**
 * @param noPlaylist - false when fetching a real playlist (extractPlaylistInfo).
 * @param youtubePlayerClient - Override YouTube player client (only needed for age-restricted content).
 *   When omitted, yt-dlp uses its default multi-client strategy which returns full quality formats.
 */
export function ytDlpCommonArgs(
  url: string,
  options: { noPlaylist: boolean; youtubePlayerClient?: YoutubePlayerClient },
): string[] {
  const args: string[] = ['--age-limit', '99'];
  if (options.noPlaylist) {
    args.push('--no-playlist');
  }
  if (isYouTubeUrl(url) && options.youtubePlayerClient !== undefined) {
    // Only override player client when explicitly specified (e.g., age-restricted fallback)
    // Default yt-dlp behavior uses a multi-client strategy that returns full quality (1080p–4K)
    args.push('--extractor-args', `youtube:player_client=${options.youtubePlayerClient}`);
  }
  return args;
}

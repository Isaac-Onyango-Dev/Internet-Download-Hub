/**
 * Shared yt-dlp CLI flags for consistent behaviour across info extraction and downloads.
 */

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

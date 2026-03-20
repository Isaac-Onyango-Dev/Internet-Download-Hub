export function translateDownloadError(
  rawError: string,
  exitCode: number | null,
  url: string
): string {
  const msg = (rawError || '').toLowerCase();
  const domain = (() => {
    try {
      return new URL(url).hostname.replace('www.', '');
    } catch {
      return 'this site';
    }
  })();

  // Network errors
  if (
    msg.includes('network') ||
    msg.includes('connection') ||
    msg.includes('connect') ||
    msg.includes('unreachable') ||
    msg.includes('timeout') ||
    msg.includes('timed out') ||
    msg.includes('no route') ||
    msg.includes('enotfound') ||
    (exitCode === 1 && msg.includes('unable to download'))
  ) {
    return 'No internet connection. Please check your connection and try again.';
  }

  // Offline / no internet
  if (
    msg.includes('getaddrinfo') ||
    msg.includes('socket hang up') ||
    msg.includes('econnrefused') ||
    msg.includes('econnreset') ||
    msg.includes('etimedout')
  ) {
    return 'Could not connect to the internet. Please check your connection and try again.';
  }

  // Private or unavailable video
  if (msg.includes('private video') || msg.includes('this video is private')) {
    return 'This video is private and cannot be downloaded.';
  }

  // Age restricted
  if (
    msg.includes('sign in') ||
    msg.includes('age') ||
    msg.includes('confirm your age') ||
    msg.includes('age-restricted')
  ) {
    return 'This video requires age verification. It cannot be downloaded without a login.';
  }

  // Video removed or unavailable
  if (
    msg.includes('video unavailable') ||
    msg.includes('has been removed') ||
    msg.includes('no longer available') ||
    msg.includes('deleted')
  ) {
    return 'This video has been removed or is no longer available.';
  }

  // Geographic restriction
  if (msg.includes('not available in your country') || msg.includes('geo') || msg.includes('blocked in')) {
    return 'This video is not available in your region.';
  }

  // DRM protected
  if (msg.includes('drm') || msg.includes('widevine') || msg.includes('encrypted')) {
    return 'This video is protected by DRM and cannot be downloaded.';
  }

  // Copyright / blocked
  if (msg.includes('copyright') || msg.includes('content warning')) {
    return 'This video has been blocked due to a copyright claim.';
  }

  // Login required
  if (
    msg.includes('login') ||
    msg.includes('please log in') ||
    msg.includes('authentication') ||
    msg.includes('not logged in')
  ) {
    return 'This video requires you to be logged in. It cannot be downloaded.';
  }

  // Rate limited
  if (msg.includes('rate limit') || msg.includes('too many requests') || msg.includes('429')) {
    return 'Too many requests were sent. Please wait a few minutes and try again.';
  }

  // Unsupported site
  if (
    msg.includes('unsupported url') ||
    msg.includes('is not supported') ||
    msg.includes('no video formats found')
  ) {
    return `${domain} is not supported yet. Try updating yt-dlp in Settings or use a different link.`;
  }

  // Format not available
  if (
    msg.includes('requested format is not available') ||
    msg.includes('format not available')
  ) {
    return 'The selected quality is not available for this video. Please choose a different quality.';
  }

  // Disk space
  if (msg.includes('no space left') || msg.includes('disk full') || msg.includes('not enough space')) {
    return 'Not enough storage space. Please free up space and try again.';
  }

  // File permission
  if (msg.includes('permission denied') || msg.includes('access denied') || msg.includes('eperm')) {
    return 'Permission denied. Please check that the save folder is accessible and try again.';
  }

  // FFmpeg missing
  if (msg.includes('ffmpeg') && msg.includes('not found')) {
    return 'A required component (FFmpeg) is missing. Please reinstall the app.';
  }

  // Exit code specific fallbacks
  if (exitCode === 1) {
    return `The download failed. Please check your internet connection and try again. If the problem continues, try updating yt-dlp in Settings.`;
  }

  if (exitCode === 2) {
    return 'The download was cancelled.';
  }

  // Generic fallback — never show raw error
  return `Could not download from ${domain}. Please check your internet connection and try again. If the problem continues, try a different link or update yt-dlp in Settings.`;
}


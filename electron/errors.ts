/** True when yt-dlp stderr suggests YouTube age-gating (narrow — avoids false positives). */
export function isLikelyYoutubeAgeRestrictionError(raw: string): boolean {
  const m = (raw || '').toLowerCase();

  // Strong indicators - these phrases are specific to age restriction
  if (
    m.includes('age-restricted') ||
    m.includes('age restricted') ||
    m.includes('confirm your age') ||
    m.includes('inappropriate for some users') ||
    m.includes('this video may be inappropriate') ||
    m.includes('video is age restricted') ||
    m.includes('content is age restricted') ||
    m.includes('restricted from embedding') ||
    m.includes('age_limit')
  ) {
    return true;
  }

  // Check for specific age + sign-in combinations (more targeted)
  // Only match if "age" appears near "sign in" in the same context
  const signInAgePattern = /(?:sign\s*in|login|log\s*in).*(?:\bage\b|age\s*restricted|18\+|adult)/i;
  const ageSignInPattern = /(?:\bage\b|age\s*restricted|18\+|adult).*(?:sign\s*in|login|log\s*in)/i;

  return signInAgePattern.test(m) || ageSignInPattern.test(m);
}

export function translateDownloadError(
  rawError: string,
  _exitCode: number | null,
  url: string,
  /** The web version has no Settings, cookies file or yt-dlp updater to point at. */
  surface: 'desktop' | 'web' = 'desktop',
): string {
  const msg = (rawError || '').toLowerCase();
  const domain = (() => {
    try {
      return new URL(url).hostname.replace('www.', '');
    } catch {
      return 'this site';
    }
  })();
  const desktop = surface === 'desktop';
  const cookiesHint = desktop
    ? 'In Settings → Age eligibility & site sign-in, add a cookies file exported from your browser ' +
      'while signed in there, then try again.'
    : 'The desktop app can download it using a sign-in from your own browser.';
  const orUpdate = desktop ? 'update yt-dlp in Settings or ' : '';

  // Specific answers from the site come first: their messages often mention
  // "connection" or "timed out" in passing, which the network check would claim.

  if (msg.includes('private video') || msg.includes('this video is private')) {
    return 'This video is private and cannot be downloaded.';
  }

  if (msg.includes('not a bot')) {
    return desktop
      ? `${domain} wants to confirm you are not a bot. ${cookiesHint} Updating yt-dlp in Settings can also help.`
      : `${domain} is refusing requests from this server. ${cookiesHint}`;
  }

  // YouTube / host age-gate or sign-in (narrow detection; see isLikelyYoutubeAgeRestrictionError)
  if (isLikelyYoutubeAgeRestrictionError(rawError)) {
    return (
      'The host site is blocking this link until you sign in there (common on YouTube for some videos). ' +
      `${cookiesHint} You can also ${orUpdate}use another URL for the same content.`
    );
  }

  if (
    msg.includes('video unavailable') ||
    msg.includes('video is unavailable') ||
    msg.includes('has been removed') ||
    msg.includes('no longer available') ||
    msg.includes('has been deleted')
  ) {
    return 'This video has been removed or is no longer available.';
  }

  if (/geo.?(restrict|block)|not (made this video )?available (in|from) your (country|location|region)/.test(msg)) {
    return 'This video is not available in your region.';
  }

  if (msg.includes('drm') || msg.includes('widevine')) {
    return 'This video is protected by DRM and cannot be downloaded.';
  }

  if (msg.includes('copyright')) {
    return 'This video has been blocked due to a copyright claim.';
  }

  if (
    /\blog(ged)?[- ]?in\b|\bsign(ed)?[- ]?in\b|authenticat|account is required|members.only/.test(msg)
  ) {
    return `This content is only available to signed-in accounts on ${domain}. ${cookiesHint}`;
  }

  if (msg.includes('no playable streams')) {
    return `Nothing is streaming at ${domain} right now. A live channel can only be recorded while it is live.`;
  }

  if (/http error 404|404:? not found/.test(msg)) {
    return `Nothing was found at this address on ${domain} (404). Check that the link is complete and still works.`;
  }

  if (/http error 403|403:? forbidden/.test(msg)) {
    return desktop
      ? `${domain} refused the download (403 Forbidden). Update yt-dlp in Settings and try again; if the site needs an account, add a cookies file in Settings.`
      : `${domain} refused the download (403 Forbidden). Please try again later.`;
  }

  if (msg.includes('rate limit') || msg.includes('rate-limit') || msg.includes('too many requests')) {
    return 'Too many requests were sent. Please wait a few minutes and try again.';
  }

  if (
    msg.includes('unsupported url') ||
    msg.includes('is not supported') ||
    msg.includes('no plugin can handle') ||
    msg.includes('no video formats found')
  ) {
    return desktop
      ? `${domain} is not supported yet. Try updating yt-dlp in Settings or use a different link.`
      : `${domain} is not supported yet. Try a different link.`;
  }

  if (msg.includes('requested format is not available') || msg.includes('format not available')) {
    return 'The selected quality is not available for this video. Please choose a different quality.';
  }

  if (
    msg.includes('no space left') ||
    msg.includes('disk full') ||
    msg.includes('not enough space') ||
    msg.includes('errno 28')
  ) {
    return 'Not enough storage space. Please free up space and try again.';
  }

  if (
    msg.includes('permission denied') ||
    msg.includes('access denied') ||
    msg.includes('access is denied') ||
    msg.includes('eperm')
  ) {
    return 'Permission denied. Please check that the save folder is accessible and try again.';
  }

  if (msg.includes('ffmpeg') && msg.includes('not found')) {
    return desktop
      ? 'A required component (FFmpeg) is missing. Please reinstall the app.'
      : 'The server is missing a component it needs. Please try again later.';
  }

  // Connection problems last.
  if (
    /getaddrinfo|enotfound|econnrefused|econnreset|etimedout|socket hang up|timed out|name resolution|failed to resolve|network is unreachable|no route to host|connection (reset|refused|aborted)|remote end closed|unable to connect|no internet/.test(
      msg,
    )
  ) {
    return 'Could not connect. Please check your internet connection and try again.';
  }

  // Generic fallback — never show raw error
  return `Could not download from ${domain}. If the problem continues, ${orUpdate}try a different link.`;
}

/**
 * The lines of engine output that state a failure: yt-dlp's "ERROR:", streamlink's
 * "error:" (on stdout), gallery-dl's "[error]". Matching only these keeps progress
 * lines and URLs from tripping the checks in translateDownloadError.
 */
export function isEngineErrorLine(line: string): boolean {
  return /\berror\b\s*[:\]]/i.test(line) || /unable to download|this video is unavailable/i.test(line);
}

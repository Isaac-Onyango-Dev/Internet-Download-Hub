import { translateDownloadError, isEngineErrorLine } from '../electron/errors';

const yt = 'https://www.youtube.com/watch?v=abc429xyz';
const say = (raw: string, url = yt) => translateDownloadError(raw, 1, url);

test('site answers win over words that only look like network trouble', () => {
  expect(
    say('ERROR: [youtube] abc: Private video. Sign in if you have been granted access'),
  ).toMatch(/private/);
  expect(say("ERROR: [youtube] abc: Sign in to confirm you're not a bot. Use --cookies")).toMatch(
    /not a bot.*cookies file/,
  );
  expect(
    say('ERROR: [youtube] abc: Video unavailable. This video has been removed by the uploader'),
  ).toMatch(/removed/);
  // What yt-dlp prints for a video id that does not exist.
  expect(say('ERROR: [youtube] aaaaaaaaaaa: This video is unavailable')).toMatch(/removed/);
  expect(say('ERROR: [twitter] 1: This content is only available to logged in users')).toMatch(
    /signed-in accounts.*cookies file/,
  );
  expect(say('ERROR: [vimeo] 1: Unable to download webpage: HTTP Error 404: Not Found')).toMatch(
    /\(404\)/,
  );
  expect(say('ERROR: unable to download video data: HTTP Error 403: Forbidden')).toMatch(
    /403 Forbidden.*Update yt-dlp/,
  );
  expect(
    say('error: No playable streams found on this URL: https://kick.com/x', 'https://kick.com/x'),
  ).toMatch(/Nothing is streaming at kick\.com/);
  expect(
    say(
      'ERROR: Unsupported URL: http://127.0.0.1:50621/img/logo.png',
      'http://127.0.0.1:50621/img/logo.png',
    ),
  ).toMatch(/127\.0\.0\.1 is not supported/);
  expect(
    say('error: No plugin can handle URL: https://example.com/a', 'https://example.com/a'),
  ).toMatch(/not supported/);
  expect(say('ERROR: [generic] x: Requested format is not available. Use --list-formats')).toMatch(
    /quality is not available/,
  );
});

test('words inside other words and URLs no longer misfire', () => {
  // "appropriate" contains "rate"; the video id contains "429"; the host contains "geo".
  const extractorBug =
    'ERROR: [youtube] abc429xyz: Unable to extract player response; please report this issue on ' +
    'https://github.com/yt-dlp/yt-dlp/issues?q= , filling out the appropriate issue template.';
  expect(say(extractorBug)).toMatch(/^Could not download from youtube\.com/);
  expect(
    say(
      'ERROR: [generic] Unable to download webpage: HTTP Error 500',
      'https://geography.example/v',
    ),
  ).toMatch(/^Could not download from geography\.example/);
  expect(say('ERROR: The uploader has not made this video available in your country')).toMatch(
    /region/,
  );
});

test('connection failures are recognised, but only after everything else', () => {
  expect(
    say('ERROR: Unable to download webpage: <urlopen error [Errno 11001] getaddrinfo failed>'),
  ).toMatch(/internet connection/);
  expect(say('ERROR: [youtube] abc: Read timed out.')).toMatch(/internet connection/);
});

test('the web version never points at desktop-only Settings', () => {
  const web = (raw: string) => translateDownloadError(raw, null, 'https://vimeo.com/1', 'web');
  // The exact text the live web service returned for this video.
  const vimeo =
    'ERROR: [vimeo] 76979871: The web client only works when logged-in. Use --cookies, --cookies-from-browser';
  expect(web(vimeo)).toBe(
    'This content is only available to signed-in accounts on vimeo.com. ' +
      'The desktop app can download it using a sign-in from your own browser.',
  );
  for (const raw of [
    vimeo,
    "ERROR: Sign in to confirm you're not a bot",
    'ERROR: HTTP Error 403: Forbidden',
    'ERROR: Unsupported URL: https://vimeo.com/1',
    'ERROR: something new',
    'ERROR: ffmpeg not found',
  ]) {
    expect(web(raw)).not.toMatch(/Settings|reinstall/);
  }
});

test('only lines that state a failure are collected', () => {
  expect(isEngineErrorLine('ERROR: [youtube] abc: Private video')).toBe(true);
  expect(isEngineErrorLine('error: No playable streams found on this URL')).toBe(true);
  expect(isEngineErrorLine('[gallery-dl][error] Unsupported URL')).toBe(true);
  expect(isEngineErrorLine('12:42:12.123 ERROR: Segment download failed')).toBe(true);
  expect(isEngineErrorLine('[download][warning] FileNotFoundError: [Errno 2] No such file')).toBe(
    false,
  );
  expect(isEngineErrorLine('[download] Destination: C:\\Videos\\Terror in the night.mp4')).toBe(
    false,
  );
  expect(isEngineErrorLine('[download]  12.5% of 10.00MiB at 1.00MiB/s ETA 00:09')).toBe(false);
});

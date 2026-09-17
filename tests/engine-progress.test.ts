import { parseEngineProgress, splitNm3u8dlOutput } from '../electron/engine-progress';

// Lines captured from the bundled binaries with their output piped, as the app runs them.
test('streamlink reports bytes written and speed, never a percentage', () => {
  expect(
    parseEngineProgress('streamlink', '[download] Written 5.06 MiB to C:\u2026\\prog\\sl.ts (2s)'),
  ).toEqual({ size: '5.06 MiB written', speed: '', eta: '' });
  expect(
    parseEngineProgress(
      'streamlink',
      '[download] Written 17.63 MiB to C:\\My (1) Videos\\sl.ts (4s @ 8.70 MiB/s)',
    ),
  ).toEqual({ size: '17.63 MiB written', speed: '8.70 MiB/s', eta: '' });
  expect(parseEngineProgress('streamlink', '[cli][info] Opening stream: 1080p (hls)')).toBeNull();
});

test('N_m3u8DL-RE reports percent, sizes, speed and ETA', () => {
  expect(
    parseEngineProgress(
      'n-m3u8dl',
      'Vid 1920x1080 | 6221 Kbps \u2501\u2501\u2501      8/64 12.50% 88.37MB/706.98MB 4.34MBps 00:02:46',
    ),
  ).toEqual({ percent: 12.5, size: '88.37MB of 706.98MB', speed: '4.34MB/s', eta: '00:02:46' });
  // Before the first segment arrives.
  expect(
    parseEngineProgress('n-m3u8dl', 'Vid 1920x1080 | 6221 Kbps      0/64 0.00% - 0.00Bps --:--:--'),
  ).toEqual({ percent: 0, size: '', speed: '0.00B/s', eta: '' });
  expect(
    parseEngineProgress(
      'n-m3u8dl',
      '12:42:12.429 INFO : Vid 1920x1080 | 6221 Kbps | mp4a.40.2,avc1.640028 | 64 Segments | ~10m34s',
    ),
  ).toBeNull();
});

test('N_m3u8DL-RE 0.6 runs the fields together', () => {
  expect(
    parseEngineProgress(
      'n-m3u8dl',
      'Vid 1920x1080 | 6221 Kbps  1/64 1.56% 5.84MB/373.72MB3.43MBps00:01:26',
    ),
  ).toEqual({ percent: 1.56, size: '5.84MB of 373.72MB', speed: '3.43MB/s', eta: '00:01:26' });
  expect(
    parseEngineProgress('n-m3u8dl', 'Vid 1920x1080 | 6221 Kbps  0/64 0.00% -0.00Bps --:--:--'),
  ).toEqual({
    percent: 0,
    size: '',
    speed: '0.00B/s',
    eta: '',
  });
  expect(
    parseEngineProgress('n-m3u8dl', 'Vid 1920x1080 | 6221 Kbps  1/64 1.56% -2.40MBps00:01:26'),
  ).toMatchObject({
    percent: 1.56,
    speed: '2.40MB/s',
    eta: '00:01:26',
  });
});

test('N_m3u8DL-RE 0.6 output is split back into lines', () => {
  // Three chunks exactly as 0.6 wrote them to a pipe, one after another.
  const piped =
    '13:48:02.427 INFO : Content Matched: HTTP Live Streaming13:48:02.427 INFO : Parsing streams...\r\n' +
    '13:48:02.495 INFO : Start downloading...Vid 1920x1080 | 6221 Kbps | mp4a.40.2,avc1.640028' +
    'Vid 1920x1080 | 6221 Kbps  0/64 0.00% -0.00Bps --:--:--' +
    'Vid 1920x1080 | 6221 Kbps  1/64 1.56% 5.84MB/373.72MB3.43MBps00:01:26';
  const lines = splitNm3u8dlOutput(piped).split(/[\r\n]+/);
  expect(lines).toContain('13:48:02.427 INFO : Parsing streams...');
  expect(lines.filter((l) => parseEngineProgress('n-m3u8dl', l))).toEqual([
    'Vid 1920x1080 | 6221 Kbps  0/64 0.00% -0.00Bps --:--:--',
    'Vid 1920x1080 | 6221 Kbps  1/64 1.56% 5.84MB/373.72MB3.43MBps00:01:26',
  ]);
  // Already-split text is left alone, so it can be applied to the same buffer again.
  expect(splitNm3u8dlOutput(splitNm3u8dlOutput(piped))).toBe(splitNm3u8dlOutput(piped));
});

test('yt-dlp and gallery-dl output is left to their own handling', () => {
  expect(
    parseEngineProgress('yt-dlp', '[download]  12.5% of 10.00MiB at 1.00MiB/s ETA 00:09'),
  ).toBeNull();
  expect(parseEngineProgress('gallery-dl', 'C:\\Downloads\\Album\\1.jpg')).toBeNull();
});

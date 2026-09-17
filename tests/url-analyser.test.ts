import { analyseUrl } from '../electron/url-analyser';

const order = (url: string) => analyseUrl(url).engineOrder;

test('every site falls back through all engines, playwright last', () => {
  for (const url of [
    'https://example.com/v/1',
    'https://youtube.com/watch?v=x',
    'https://kick.com/a',
  ]) {
    expect(order(url)).toEqual(
      expect.arrayContaining(['yt-dlp', 'streamlink', 'gallery-dl', 'playwright']),
    );
    expect(order(url).at(-1)).toBe('playwright');
  }
});

test('preferred engine comes first without duplicates', () => {
  expect(order('https://kick.com/a')).toEqual(['streamlink', 'yt-dlp', 'gallery-dl', 'playwright']);
  expect(order('https://imgur.com/a/b')).toEqual([
    'gallery-dl',
    'yt-dlp',
    'streamlink',
    'playwright',
  ]);
  expect(order('https://cdn.example.com/master.m3u8?t=1')[0]).toBe('n-m3u8dl');
});

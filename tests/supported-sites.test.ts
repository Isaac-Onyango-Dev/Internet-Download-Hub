import { webBlockedSite } from '../client/src/lib/supported-sites';

test('the web version turns away every YouTube host, and only those', () => {
  for (const url of [
    'https://www.youtube.com/watch?v=mvfo3pUiCCA',
    'https://youtu.be/mvfo3pUiCCA',
    'https://music.youtube.com/watch?v=mvfo3pUiCCA',
    'https://M.YouTube.com/shorts/tPEE9ZwTmy0',
    'https://www.youtube-nocookie.com/embed/mvfo3pUiCCA',
  ]) {
    expect(webBlockedSite(url)).toBe('YouTube');
  }
  for (const url of [
    'https://www.tiktok.com/@scout2015/video/6718335390845095173',
    'https://notyoutube.com/watch?v=x',
    'https://youtube.com.example.org/watch?v=x',
  ]) {
    expect(webBlockedSite(url)).toBeNull();
  }
});

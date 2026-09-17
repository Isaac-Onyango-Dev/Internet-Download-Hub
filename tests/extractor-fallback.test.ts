import { vi, beforeEach } from 'vitest';

vi.mock('electron-log', () => ({ default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
// Mirrors the packaged app, where playwright-core is excluded from the installer.
vi.mock('playwright-core', () => {
  throw new Error('not installed in tests');
});
vi.mock('execa', () => ({ default: vi.fn() }));
vi.mock('fs', async (orig) => {
  const real = await orig<typeof import('fs')>();
  return { ...real, default: { ...real, existsSync: () => true } };
});

import execa from 'execa';
import { extractVideoInfo } from '../electron/extractor';

const paths = {
  ytDlp: 'yt-dlp',
  ffmpeg: 'ffmpeg',
  streamlink: 'streamlink',
  nm3u8dl: 'nm3u8dl',
  galleryDl: 'gallery-dl',
};
const run = vi.mocked(execa) as unknown as ReturnType<typeof vi.fn>;
const fail = (stderr: string) => Object.assign(new Error(stderr), { stderr });
const engines = () => run.mock.calls.map((c) => c[0]);

// Block body: a function returned from beforeEach is run as a cleanup hook.
beforeEach(() => {
  run.mockReset();
});

test('falls back to streamlink when yt-dlp fails', async () => {
  run.mockImplementation(async (bin: string) => {
    if (bin === 'streamlink')
      return { stdout: JSON.stringify({ streams: { best: {} }, metadata: { title: 'Live' } }) };
    throw fail(`${bin} failed`);
  });
  const info = await extractVideoInfo('https://example.com/live', paths);
  expect(info).toMatchObject({ title: 'Live', extractionMethod: 'streamlink' });
  expect(engines()).toEqual(['yt-dlp', 'streamlink']);
});

// The shape `gallery-dl -j` really prints: [2, directory], [3, url, file], [-1, error].
const galleryJson = (...messages: unknown[]) => ({ stdout: JSON.stringify(messages) });

test('falls back to gallery-dl after yt-dlp and streamlink', async () => {
  run.mockImplementation(async (bin: string) => {
    if (bin === 'gallery-dl')
      return galleryJson(
        [2, { category: 'imgur', album: { title: 'Holiday' } }],
        [3, 'https://i.example.com/clip.mp4', { extension: 'mp4' }],
        [3, 'https://i.example.com/1.jpg', { extension: 'jpg' }],
      );
    throw fail(`${bin} failed`);
  });
  const info = await extractVideoInfo('https://example.com/album', paths);
  expect(info).toMatchObject({
    title: 'Holiday',
    extractionMethod: 'gallery-dl',
    thumbnail: 'https://i.example.com/1.jpg',
    formats: [{ label: 'Full Quality Gallery (2 items)', ext: 'gallery' }],
  });
  expect(engines()).toEqual(['yt-dlp', 'streamlink', 'gallery-dl']);
});

test('a gallery is named after the collection, not its first item', async () => {
  // Shape of gallery-dl's output for a Wikimedia Commons category: each file brings its own
  // directory message, whose `title` is that file's.
  run.mockImplementation(async (bin: string) => {
    if (bin === 'gallery-dl')
      return galleryJson(
        [2, { category: 'wikimediacommons', page: 'Category:Example_images', title: 'File:1.jpg' }],
        [3, 'https://upload.wikimedia.org/1.jpg', { title: 'File:1.jpg' }],
      );
    throw fail(`${bin} failed`);
  });
  const info = await extractVideoInfo(
    'https://commons.wikimedia.org/wiki/Category:Example_images',
    paths,
  );
  expect(info).toMatchObject({ title: 'Category:Example_images', extractionMethod: 'gallery-dl' });
});

test('a gallery-dl error message or an empty gallery is a failure, not a result', async () => {
  run.mockImplementation(async (bin: string) => {
    if (bin === 'gallery-dl')
      return galleryJson([
        -1,
        { error: 'NotFoundError', message: 'Requested album could not be found' },
      ]);
    throw fail(`${bin}: no plugin`);
  });
  await expect(extractVideoInfo('https://example.com/album', paths)).rejects.toThrow(
    'yt-dlp: no plugin',
  );

  run.mockImplementation(async (bin: string) => {
    if (bin === 'gallery-dl') return galleryJson([2, { category: 'imgur' }]);
    throw fail(`${bin}: no plugin`);
  });
  await expect(extractVideoInfo('https://example.com/album', paths)).rejects.toThrow(
    'yt-dlp: no plugin',
  );
});

test('reports the first real engine error, not the later "not available" one', async () => {
  run.mockImplementation(async (bin: string) => {
    throw fail(bin === 'yt-dlp' ? 'ERROR: Private video' : `${bin}: no plugin`);
  });
  await expect(extractVideoInfo('https://example.com/v', paths)).rejects.toThrow(
    'ERROR: Private video',
  );
  expect(engines()).toEqual(['yt-dlp', 'streamlink', 'gallery-dl']);
});

test('the preferred engine runs first and its error is the one reported', async () => {
  run.mockImplementation(async (bin: string) => {
    throw fail(`${bin} failed`);
  });
  await expect(extractVideoInfo('https://kick.com/someone', paths)).rejects.toThrow(
    'streamlink failed',
  );
  expect(engines()).toEqual(['streamlink', 'yt-dlp', 'gallery-dl']);
});

test('never runs N_m3u8DL-RE for metadata; yt-dlp probes manifests', async () => {
  run.mockResolvedValue({ stdout: JSON.stringify({ title: 'HLS', formats: [] }) });
  const info = await extractVideoInfo('https://cdn.example.com/master.m3u8', paths);
  expect(info).toMatchObject({ title: 'HLS', extractionMethod: 'yt-dlp' });
  expect(engines()).toEqual(['yt-dlp']);
});

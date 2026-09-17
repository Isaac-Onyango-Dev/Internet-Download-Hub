import { vi, beforeEach } from 'vitest';
import { EventEmitter } from 'events';

vi.mock('electron-log', () => ({ default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('fs', async (orig) => {
  const real = await orig<typeof import('fs')>();
  return { ...real, default: { ...real, existsSync: () => true } };
});
const fakeYtDlp = { stdout: '', stderr: '', code: 0 };
vi.mock('child_process', async (orig) => ({
  ...(await orig<typeof import('child_process')>()),
  spawn: () => {
    const proc = Object.assign(new EventEmitter(), {
      stdout: new EventEmitter(),
      stderr: new EventEmitter(),
    });
    setImmediate(() => {
      if (fakeYtDlp.stdout) proc.stdout.emit('data', Buffer.from(fakeYtDlp.stdout));
      if (fakeYtDlp.stderr) proc.stderr.emit('data', Buffer.from(fakeYtDlp.stderr));
      proc.emit('close', fakeYtDlp.code);
    });
    return proc;
  },
}));

import { streamPlaylistInfo } from '../electron/extractor';

// Two entries exactly as `yt-dlp --dump-json --flat-playlist` printed them (trimmed to the
// fields it had): there is no separate playlist line, and thumbnails come as a list.
const entry = (i: number, id: string) =>
  JSON.stringify({
    _type: 'url',
    title: `Video ${i}`,
    url: `https://www.youtube.com/watch?v=${id}`,
    playlist: 'Uploads from Google for Developers',
    playlist_title: 'Uploads from Google for Developers',
    playlist_count: 6095,
    playlist_index: i,
    playlist_uploader: 'Google for Developers',
    thumbnails: [
      { url: `https://i.ytimg.com/vi/${id}/small.jpg` },
      { url: `https://i.ytimg.com/vi/${id}/hq.jpg` },
    ],
  });

const run = () =>
  new Promise<{ videos: unknown[]; done?: unknown; error?: Error }>((resolve) => {
    const videos: unknown[] = [];
    streamPlaylistInfo(
      'https://www.youtube.com/playlist?list=UU_x5XG1OV2P6uZZ5FSM9Ttw',
      { ytDlp: 'yt-dlp' },
      (video, index, total) =>
        videos.push({ title: video.title, thumbnail: video.thumbnail, index, total }),
      (done) => resolve({ videos, done }),
      (error) => resolve({ videos, error }),
    );
  });

beforeEach(() => Object.assign(fakeYtDlp, { stdout: '', stderr: '', code: 0 }));

test('the playlist title, size and thumbnails come from the entries', async () => {
  fakeYtDlp.stdout = `${entry(1, 'FVkp6tc2rNY')}\n${entry(2, '3CyW24Pkz4o')}\n`;
  const { videos, done } = await run();
  expect(done).toEqual({
    title: 'Uploads from Google for Developers',
    uploader: 'Google for Developers',
    videoCount: 6095,
  });
  expect(videos).toEqual([
    {
      title: 'Video 1',
      thumbnail: 'https://i.ytimg.com/vi/FVkp6tc2rNY/hq.jpg',
      index: 1,
      total: 6095,
    },
    {
      title: 'Video 2',
      thumbnail: 'https://i.ytimg.com/vi/3CyW24Pkz4o/hq.jpg',
      index: 2,
      total: 6095,
    },
  ]);
});

test('a failed or empty playlist reports why, so the dialog stops loading', async () => {
  Object.assign(fakeYtDlp, {
    code: 1,
    stderr:
      'WARNING: something\nERROR: [youtube:tab] PLx: YouTube said: The playlist does not exist.\n',
  });
  expect((await run()).error?.message).toBe(
    'ERROR: [youtube:tab] PLx: YouTube said: The playlist does not exist.',
  );

  Object.assign(fakeYtDlp, { code: 0, stderr: '' });
  expect((await run()).error?.message).toMatch(/no videos/);
});

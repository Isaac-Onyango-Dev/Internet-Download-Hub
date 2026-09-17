// End-to-end check of the download code in electron/main.ts against the real engines in
// binaries/. The main process is bundled with Electron stubbed out (electron-stub.cjs) and
// driven through its IPC handlers; media comes from a local server, so nothing leaves the
// machine unless --network is passed.
//
//   npm run test:engines              Windows, after `npm run setup:binaries`
//   npm run test:engines -- --network also fetches FFmpeg (~190 MB) and updates yt-dlp
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const cp = require('child_process');

const repo = path.resolve(__dirname, '..', '..');
process.chdir(repo); // the main process looks for ./binaries in development
const bin = (name) => path.join(repo, 'binaries', name);

if (process.platform !== 'win32') {
  console.log('test:engines needs the Windows engine binaries; skipped.');
  process.exit(0);
}
for (const name of [
  'yt-dlp.exe',
  'ffmpeg.exe',
  'ffprobe.exe',
  'gallery-dl.exe',
  'N_m3u8DL-RE.exe',
  'streamlink/bin/streamlink.exe',
]) {
  if (!fs.existsSync(bin(name))) {
    console.error(`binaries/${name} is missing. Run \`npm run setup:binaries\` first.`);
    process.exit(1);
  }
}

const home = fs.mkdtempSync(path.join(os.tmpdir(), 'idh-engines-'));
process.env.IDH_ENGINES_HOME = home;
const dl = path.join(home, 'downloads');
const media = path.join(home, 'media');
for (const d of ['userData', 'downloads', 'temp', 'media/hls'])
  fs.mkdirSync(path.join(home, d), { recursive: true });

// ── Fixtures ─────────────────────────────────────────────────────────────────
const ffmpeg = (cwd, ...args) =>
  cp.execFileSync(bin('ffmpeg.exe'), ['-v', 'error', '-y', ...args], { cwd });
ffmpeg(
  media,
  '-f',
  'lavfi',
  '-i',
  'testsrc=duration=5:size=320x240:rate=25',
  '-f',
  'lavfi',
  '-i',
  'sine=duration=5',
  '-c:v',
  'libx264',
  '-c:a',
  'aac',
  '-shortest',
  'clip.mp4',
);
ffmpeg(media, '-f', 'lavfi', '-i', 'testsrc=size=64x64', '-frames:v', '1', 'logo.png');
// Separate video and audio renditions, as most real HLS streams have.
ffmpeg(
  path.join(media, 'hls'),
  '-f',
  'lavfi',
  '-i',
  'testsrc=duration=6:size=320x240:rate=25',
  '-f',
  'lavfi',
  '-i',
  'sine=duration=6',
  '-map',
  '0:v',
  '-map',
  '1:a',
  '-c:v',
  'libx264',
  '-c:a',
  'aac',
  '-f',
  'hls',
  '-hls_time',
  '2',
  '-hls_playlist_type',
  'vod',
  '-master_pl_name',
  'master.m3u8',
  '-var_stream_map',
  'v:0,agroup:aud a:0,agroup:aud,default:yes',
  '-hls_segment_filename',
  's%v_%03d.ts',
  'p%v.m3u8',
);

// ── Bundle the main process ──────────────────────────────────────────────────
// Inside node_modules so the bundle's require('sql.js') resolves.
const bundle = path.join(repo, 'node_modules', '.cache', 'idh-engines', 'main.cjs');
const stub = path.join(__dirname, 'electron-stub.cjs');
require('esbuild').buildSync({
  entryPoints: [path.join(repo, 'electron', 'main.ts')],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: bundle,
  alias: { electron: stub, 'electron-log': stub, 'electron-updater': stub },
  external: ['sql.js', 'playwright-core'],
  logLevel: 'warning',
});

// Spawn spy (ignores the startup `--version` pre-warm).
let spawns = [];
const realSpawn = cp.spawn;
cp.spawn = (file, args, ...rest) => {
  if (!args?.includes('--version')) spawns.push(path.basename(file));
  return realSpawn(file, args, ...rest);
};
// Lets a scenario pretend an engine is not installed.
const hidden = new Set();
const realExists = fs.existsSync;
fs.existsSync = (p) =>
  typeof p === 'string' && [...hidden].some((h) => p.includes(h)) ? false : realExists(p);

// ── Media server ─────────────────────────────────────────────────────────────
const clip = fs.readFileSync(path.join(media, 'clip.mp4'));
const logo = fs.readFileSync(path.join(media, 'logo.png'));
const types = { '.m3u8': 'application/vnd.apple.mpegurl', '.ts': 'video/mp2t' };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let body;
  let type = 'video/mp4';
  if (u.startsWith('/hls/') || u.startsWith('/hls-slow/')) {
    body = fs.readFileSync(path.join(media, 'hls', path.basename(u)));
    type = types[path.extname(u)];
  } else if (u.startsWith('/img/')) {
    // yt-dlp (Chrome user agent) gets a page with no media, so the job has to fall back.
    if (/Chrome\//.test(req.headers['user-agent'] || '')) {
      return res.writeHead(200, { 'Content-Type': 'text/html' }).end('<html>nothing</html>');
    }
    body = logo;
    type = 'image/png';
  } else if (u.endsWith('.mp4')) body = clip;
  else return res.writeHead(404).end();
  res.writeHead(200, { 'Content-Type': type, 'Content-Length': body.length });
  if (!u.includes('slow')) return res.end(body);
  // /slow…: ~10 s per file; /hls-slow/: ~2 s per file, so a stream reports progress midway.
  let i = 0;
  const step = Math.ceil(body.length / (u.startsWith('/hls-slow/') ? 10 : 50));
  const t = setInterval(
    () =>
      i >= body.length ? (clearInterval(t), res.end()) : res.write(body.subarray(i, (i += step))),
    200,
  );
  req.on('close', () => clearInterval(t));
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, timeout = 120000) {
  const end = Date.now() + timeout;
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() > end) throw new Error(`timed out waiting for ${fn}`);
    await sleep(100);
  }
}
const tree = (dir) =>
  realExists(dir)
    ? fs
        .readdirSync(dir, { recursive: true })
        .map((f) => f.replace(/\\/g, '/'))
        .sort()
    : [];

server.listen(0, '127.0.0.1', async () => {
  const base = `http://127.0.0.1:${server.address().port}`;
  process.resourcesPath = home;
  require(bundle);
  const st = globalThis.__idh;
  const h = (name, ...args) => st.handlers[name]({}, ...args);
  const row = async (id) => (await h('get-download-history')).find((x) => x.id === id);
  const settled = (id) => async () => {
    const r = await row(id);
    return r && ['completed', 'failed'].includes(r.state) && r;
  };
  const events = (id) =>
    st.sent.filter(([ch, d]) => ch === 'download-progress' && d.id === id).map(([, d]) => d);
  const start = (folder, opts) => h('start-download', { savePath: folder, ...opts });
  const network = process.argv.includes('--network');
  let passed = 0;
  const scenario = async (name, fn) => {
    if (name.startsWith('network') && !network) return;
    spawns = [];
    // 240-character folders, so every engine meets file paths past the old 260 limit.
    const room = 240 - dl.length - 1;
    const folder = path.join(dl, name.replace(/\W+/g, '_').padEnd(room, '_').slice(0, room));
    fs.mkdirSync(folder, { recursive: true });
    await fn(folder);
    passed++;
    console.log(`ok   ${name}   [${spawns.join(' -> ')}]`);
  };

  try {
    await until(() => st.handlers['start-download']);

    await scenario(
      'a merged download records the merged file, not its audio part',
      async (folder) => {
        const { id } = await start(folder, {
          url: `${base}/hls/master.m3u8`,
          filename: 'master.mp4',
          formatId: '64',
        });
        assert.ok(id > 0, `start-download returned id ${id}`);
        const r = await until(settled(id));
        assert.strictEqual(r.state, 'completed', r.error);
        assert.deepStrictEqual(spawns, ['yt-dlp.exe'], 'a chosen quality starts with yt-dlp');
        assert.strictEqual(r.save_path, path.join(folder, 'master.mp4'));
        assert.deepStrictEqual(tree(folder), ['master.mp4'], 'scratch folder removed');
        assert.strictEqual(events(id).at(-1).savePath, r.save_path);
      },
    );

    await scenario('a non-English title keeps its real path', async (folder) => {
      const { id } = await start(folder, {
        url: `${base}/${encodeURIComponent('日本語 テスト')}.mp4`,
        filename: '_______.mp4',
      });
      const r = await until(settled(id));
      assert.strictEqual(r.state, 'completed', r.error);
      assert.strictEqual(r.save_path, path.join(folder, '日本語 テスト.mp4'));
      assert.ok(realExists(r.save_path));
    });

    await scenario('Audio Only (MP3) produces an mp3', async (folder) => {
      const { id } = await start(folder, {
        url: `${base}/hls/master.m3u8`,
        filename: 'master.mp3',
        formatId: 'bestaudio',
      });
      const r = await until(settled(id));
      assert.strictEqual(r.state, 'completed', r.error);
      assert.strictEqual(r.save_path, path.join(folder, 'master.mp3'));
      const probe = cp.execFileSync(bin('ffprobe.exe'), [
        '-v',
        'error',
        '-show_entries',
        'stream=codec_name',
        '-of',
        'csv=p=0',
        r.save_path,
      ]);
      assert.strictEqual(probe.toString().trim(), 'mp3');
    });

    await scenario(
      'N_m3u8DL-RE takes a manifest at best quality and reports percent',
      async (folder) => {
        const { id } = await start(folder, {
          url: `${base}/hls-slow/master.m3u8`,
          filename: 'Stream Title.mp4',
          formatId: 'bestvideo+bestaudio',
        });
        const r = await until(settled(id));
        assert.strictEqual(r.state, 'completed', r.error);
        assert.deepStrictEqual(spawns, ['N_m3u8DL-RE.exe']);
        assert.strictEqual(r.save_path, path.join(folder, 'Stream Title.mp4'));
        assert.deepStrictEqual(tree(folder), ['Stream Title.mp4']);
        assert.ok(
          events(id).some((e) => e.percent > 0 && e.percent < 100),
          'percent events',
        );
      },
    );

    await scenario('streamlink records a new .ts with size-only progress', async (folder) => {
      hidden.add('N_m3u8DL-RE.exe');
      hidden.add('yt-dlp.exe');
      try {
        fs.writeFileSync(path.join(folder, 'Live.ts'), 'an earlier recording');
        const { id } = await start(folder, {
          url: `${base}/hls/master.m3u8`,
          filename: 'Live.ts',
          formatId: 'best',
        });
        const r = await until(settled(id));
        assert.strictEqual(r.state, 'completed', r.error);
        assert.deepStrictEqual(spawns, ['streamlink.exe']);
        assert.strictEqual(r.save_path, path.join(folder, 'Live (2).ts'), 'never overwrites');
        assert.strictEqual(
          fs.readFileSync(path.join(folder, 'Live.ts'), 'utf8'),
          'an earlier recording',
        );
        assert.ok(fs.statSync(r.save_path).size > 50000);
        assert.ok(
          events(id).some((e) => e.indeterminate === true && /written/.test(e.totalSize)),
          'written events',
        );
        assert.strictEqual(events(id).at(-1).indeterminate, false);
      } finally {
        hidden.clear();
      }
    });

    await scenario('restart runs one engine; cancel removes only partial data', async (folder) => {
      fs.writeFileSync(path.join(folder, 'mine.txt'), 'a user file');
      // The name the queue gave the job; yt-dlp saves under the title (slow-clip) instead.
      fs.writeFileSync(
        path.join(folder, 'queued-name.mp4'),
        'a finished download with the queued name',
      );
      const { id } = await start(folder, {
        url: `${base}/slow-clip.mp4`,
        filename: 'queued-name.mp4',
      });
      await until(() => spawns.length === 1);
      await sleep(2500);
      const before = events(id).length;
      await h('restart-download', id);
      await until(() => events(id).length > before + 3);
      const guard = await h('update-binary', 'yt-dlp');
      assert.strictEqual(guard.success, false);
      assert.match(guard.error, /downloading right now/);
      assert.ok(
        tree(folder).some((f) => f.startsWith('.idh-temp/')),
        'the partial lives in the scratch folder',
      );
      await h('cancel-download', id);
      await sleep(1500);
      assert.deepStrictEqual(spawns, ['yt-dlp.exe', 'yt-dlp.exe']);
      assert.strictEqual((await row(id)).state, 'cancelled');
      assert.deepStrictEqual(tree(folder), ['mine.txt', 'queued-name.mp4']);
      assert.strictEqual(
        fs.readFileSync(path.join(folder, 'queued-name.mp4'), 'utf8'),
        'a finished download with the queued name',
      );
    });

    await scenario(
      'a gallery is read from real gallery-dl output and saved into a folder',
      async (folder) => {
        const info = await h('fetch-video-info', `${base}/img/logo.png`);
        assert.ok(info.success, info.error);
        assert.strictEqual(info.data.extractionMethod, 'gallery-dl');
        assert.strictEqual(info.data.title, 'logo');
        assert.strictEqual(info.data.formats[0].label, 'Full Quality Gallery (1 items)');
        spawns = [];
        const { id } = await start(folder, {
          url: `${base}/img/logo.png`,
          filename: 'logo.gallery',
          formatId: 'best',
        });
        const r = await until(settled(id));
        assert.strictEqual(r.state, 'completed', r.error);
        assert.deepStrictEqual(spawns, ['yt-dlp.exe', 'streamlink.exe', 'gallery-dl.exe']);
        assert.strictEqual(r.save_path, path.join(folder, 'logo'));
        assert.deepStrictEqual(tree(folder), [
          'logo',
          `logo/127.0.0.1_${server.address().port}_img_logo.png`,
        ]);
        assert.ok(events(id).some((e) => e.totalSize === '1 file saved'));
      },
    );

    await scenario(
      'a failure shows the first engine’s reason; clearing it removes its partial data',
      async (folder) => {
        hidden.add('streamlink'); // keeps the failure quick: yt-dlp, then gallery-dl
        try {
          const { id } = await start(folder, {
            url: `${base}/missing/nothing-here.bin`,
            filename: 'gone.mp4',
          });
          fs.mkdirSync(path.join(folder, '.idh-temp', String(id)), { recursive: true });
          fs.writeFileSync(path.join(folder, '.idh-temp', String(id), 'x.part'), 'partial');
          const r = await until(settled(id));
          assert.strictEqual(r.state, 'failed');
          assert.match(r.error, /Nothing was found at this address on 127\.0\.0\.1 \(404\)/);
          assert.ok(
            tree(folder).includes(`.idh-temp/${id}/x.part`),
            'a failure keeps partials for a retry',
          );
          await h('clear-history', 'failed');
          assert.deepStrictEqual(tree(folder), []);
        } finally {
          hidden.clear();
        }
      },
    );

    await scenario(
      'network: a missing FFmpeg is fetched, then the waiting download starts',
      async (folder) => {
        hidden.add(bin('ffmpeg.exe'));
        try {
          const { id } = await start(folder, {
            url: `${base}/hls/master.m3u8`,
            filename: 'after-ffmpeg.mp4',
            formatId: '64',
          });
          await sleep(1000);
          assert.strictEqual((await row(id)).state, 'queued', 'waits for FFmpeg');
          const r = await until(settled(id), 900000);
          assert.strictEqual(r.state, 'completed', r.error);
          assert.ok(realExists(path.join(home, 'userData', 'binaries', 'ffmpeg.exe')));
          const progress = st.sent
            .filter(([ch]) => ch === 'ffmpeg-download-progress')
            .map(([, d]) => d);
          assert.ok(
            progress.length > 50 && progress.length < 200,
            `throttled progress (${progress.length} events)`,
          );
          assert.strictEqual(progress.at(-1).phase, 'completed');
        } finally {
          hidden.clear();
        }
      },
    );

    await scenario('network: the yt-dlp updater follows GitHub redirects', async () => {
      const r = await h('update-ytdlp');
      console.log(`     update-ytdlp -> ${JSON.stringify(r)}`);
      assert.ok(fs.statSync(path.join(home, 'userData', 'binaries', 'yt-dlp.exe')).size > 10e6);
    });

    console.log(`PASS (${passed} scenarios)`);
    fs.rmSync(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    process.exit(0);
  } catch (err) {
    console.error(`FAIL: ${err.message}`);
    console.error(
      st.logs
        .filter((l) => !/PROGRESS-AUDIT|BINARY OK|✅|\[PROGRESS\] \d+:/.test(l))
        .slice(-25)
        .join('\n'),
    );
    console.error(`Files kept for inspection: ${home}`);
    process.exit(1);
  }
});

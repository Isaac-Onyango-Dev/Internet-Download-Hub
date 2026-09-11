/**
 * Generates the NSIS installer sidebar artwork.
 *
 *   npm run generate:installer-art
 *
 * The bitmaps are checked into `build/` rather than produced during the
 * release build, because this needs a local Chromium and the release runner
 * should not have to install a browser to package an installer. Re-run this
 * whenever the brand changes, then commit the result.
 *
 * The page is rendered against a server rooted at `client/`, so it reads the
 * same `brand.css`, the same bundled fonts and the same `public/mark.svg` as
 * the app and the splash window. There is no second copy of the palette here.
 *
 * Output is 24-bit BMP because that is what NSIS accepts. `sharp` can neither
 * write nor read that format, so the encoder below is written out longhand and
 * the result is validated by parsing the header back.
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLIENT = path.join(ROOT, 'client');
const OUT_DIR = path.join(ROOT, 'build');
const PORT = 4712;

// NSIS welcome/finish page bitmaps are exactly this size. electron-builder
// rejects anything else.
const WIDTH = 164;
const HEIGHT = 314;

const MIME: Record<string, string> = {
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.html': 'text/html',
};

const PAGE = `<!DOCTYPE html><html><head>
<base href="http://localhost:${PORT}/" />
<link rel="stylesheet" href="brand.css" />
<style>
  *{box-sizing:border-box;margin:0}
  html,body{width:${WIDTH}px;height:${HEIGHT}px;overflow:hidden}
  body{background:var(--brand-ink);color:var(--brand-text);font-family:var(--brand-body);
       position:relative;-webkit-font-smoothing:antialiased}
  .glow{position:absolute;border-radius:58% 42% 37% 63% / 46% 55% 45% 54%;filter:blur(44px)}
  .g1{width:170px;height:150px;background:var(--brand-magenta);opacity:.34;top:-54px;left:-56px}
  .g2{width:150px;height:170px;background:var(--brand-cyan);opacity:.22;bottom:-60px;right:-52px}
  .g3{width:140px;height:140px;background:var(--brand-violet);opacity:.26;top:120px;left:-50px}
  .stack{position:relative;height:100%;padding:26px 18px 22px;display:flex;flex-direction:column;
         align-items:center;text-align:center}
  .mark{width:62px;height:62px;filter:drop-shadow(0 8px 20px rgba(139,47,224,.6))}
  .kicker{margin-top:18px;font-size:7px;font-weight:700;letter-spacing:.28em;text-transform:uppercase;
          color:var(--brand-text-faint)}
  .name{margin-top:4px;font-family:var(--brand-display);font-weight:800;font-size:17px;
        letter-spacing:-.035em;line-height:1;background:var(--brand-prism);
        -webkit-background-clip:text;background-clip:text;color:transparent}
  .o{display:inline-block;width:.64em;height:.64em;border-radius:50%;background:var(--brand-prism);
     position:relative;vertical-align:-.03em;margin:0 .035em}
  .o::after{content:"";position:absolute;inset:0;margin:auto;width:0;height:0;
     border-left:.21em solid var(--brand-ink);border-top:.125em solid transparent;
     border-bottom:.125em solid transparent;transform:translateX(.04em)}
  .tagline{margin-top:14px;font-size:10px;line-height:1.45;color:var(--brand-text-dim)}
  .spacer{flex:1}
  .facts{display:grid;gap:6px;width:100%}
  .fact{font-size:8px;color:var(--brand-text-faint);display:flex;align-items:center;gap:6px;
        justify-content:center}
  .fact i{width:4px;height:4px;border-radius:50%;background:var(--brand-prism);flex:none}
  .rule{margin-top:14px;width:44px;height:2px;border-radius:999px;background:var(--brand-prism)}
</style></head><body>
  <div class="glow g1"></div><div class="glow g2"></div><div class="glow g3"></div>
  <div class="stack">
    <img class="mark" src="public/mark.svg" alt="" />
    <div class="kicker">Internet</div>
    <div class="name">D<span class="o"></span>wnload Hub</div>
    <p class="tagline">Grab any video,<br />anywhere.</p>
    <div class="spacer"></div>
    <div class="facts">
      <div class="fact"><i></i>1000+ sites</div>
      <div class="fact"><i></i>No ads, no account</div>
      <div class="fact"><i></i>Free and open source</div>
    </div>
    <div class="rule"></div>
  </div>
</body></html>`;

/** 24-bit uncompressed BMP: bottom-up rows, BGR, each row padded to 4 bytes. */
function encodeBmp24(rgb: Buffer, width: number, height: number): Buffer {
  const pad = (4 - ((width * 3) % 4)) % 4;
  const rowSize = width * 3 + pad;
  const imageSize = rowSize * height;
  const out = Buffer.alloc(54 + imageSize, 0);

  out.write('BM', 0, 'ascii');
  out.writeUInt32LE(54 + imageSize, 2);
  out.writeUInt32LE(54, 10);
  out.writeUInt32LE(40, 14); // BITMAPINFOHEADER
  out.writeInt32LE(width, 18);
  out.writeInt32LE(height, 22); // positive height = bottom-up
  out.writeUInt16LE(1, 26);
  out.writeUInt16LE(24, 28);
  out.writeUInt32LE(0, 30); // BI_RGB
  out.writeUInt32LE(imageSize, 34);
  out.writeInt32LE(2835, 38); // 72 DPI
  out.writeInt32LE(2835, 42);

  for (let y = 0; y < height; y += 1) {
    const src = (height - 1 - y) * width * 3;
    const dst = 54 + y * rowSize;
    for (let x = 0; x < width; x += 1) {
      out[dst + x * 3] = rgb[src + x * 3 + 2];
      out[dst + x * 3 + 1] = rgb[src + x * 3 + 1];
      out[dst + x * 3 + 2] = rgb[src + x * 3];
    }
  }
  return out;
}

function assertValidBmp(file: string): void {
  const b = fs.readFileSync(file);
  const pad = (4 - ((WIDTH * 3) % 4)) % 4;
  const expected = 54 + (WIDTH * 3 + pad) * HEIGHT;
  const checks: [string, boolean][] = [
    ['magic is BM', b.toString('ascii', 0, 2) === 'BM'],
    ['declared size matches file', b.readUInt32LE(2) === b.length],
    ['file size is as computed', b.length === expected],
    [`dimensions are ${WIDTH}x${HEIGHT}`, b.readInt32LE(18) === WIDTH && b.readInt32LE(22) === HEIGHT],
    ['24 bits per pixel', b.readUInt16LE(28) === 24],
    ['uncompressed', b.readUInt32LE(30) === 0],
  ];
  const failed = checks.filter(([, ok]) => !ok).map(([name]) => name);
  if (failed.length) throw new Error(`${path.basename(file)} failed: ${failed.join(', ')}`);
}

async function main(): Promise<void> {
  let chromium: typeof import('playwright-core').chromium;
  try {
    ({ chromium } = await import('playwright-core'));
  } catch {
    throw new Error('playwright-core is not installed. Run `npm install` first.');
  }
  const sharp = (await import('sharp')).default;

  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent((req.url ?? '/').split('?')[0]);
    const file = path.join(CLIENT, rel);
    if (!file.startsWith(CLIENT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404);
      res.end('not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] ?? 'application/octet-stream' });
    res.end(fs.readFileSync(file));
  });
  await new Promise<void>((resolve) => server.listen(PORT, resolve));

  // Prefer the installed Edge/Chrome; playwright-core ships no browser itself.
  let browser;
  try {
    browser = await chromium.launch({ channel: 'msedge' });
  } catch {
    try {
      browser = await chromium.launch({ channel: 'chrome' });
    } catch {
      server.close();
      throw new Error('No Chromium-based browser found. Install Edge or Chrome, or run `npx playwright-core install chromium`.');
    }
  }

  const page = await browser.newPage({
    viewport: { width: WIDTH, height: HEIGHT },
    deviceScaleFactor: 1,
  });
  const failures: string[] = [];
  page.on('response', (r) => {
    if (r.status() >= 400) failures.push(`${r.status()} ${r.url()}`);
  });

  await page.setContent(PAGE, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  const png = await page.screenshot({ type: 'png' });
  await browser.close();
  server.close();

  if (failures.length) throw new Error(`assets failed to load: ${failures.join(', ')}`);

  const { data, info } = await sharp(png)
    .flatten({ background: '#0B0B12' }) // BMP carries no alpha
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  if (info.width !== WIDTH || info.height !== HEIGHT) {
    throw new Error(`expected ${WIDTH}x${HEIGHT}, rendered ${info.width}x${info.height}`);
  }

  const bmp = encodeBmp24(data, WIDTH, HEIGHT);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  for (const name of ['installerSidebar.bmp', 'uninstallerSidebar.bmp']) {
    const file = path.join(OUT_DIR, name);
    fs.writeFileSync(file, bmp);
    assertValidBmp(file);
    console.log(`Generated ${path.relative(ROOT, file)} (${WIDTH}x${HEIGHT}, ${bmp.length} bytes)`);
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

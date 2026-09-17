import { exec as execCallback } from 'node:child_process';
import { promisify } from 'node:util';
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  renameSync,
  unlinkSync,
  readdirSync,
  lstatSync,
  rmSync,
} from 'node:fs';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';

const exec = promisify(execCallback);
const BINARIES_DIR = 'binaries';

/**
 * gallery-dl moved off GitHub Releases to Codeberg (its GitHub releases
 * stopped shipping binary assets entirely as of mid-2026 — see the release
 * notes on https://github.com/mikf/gallery-dl/releases/latest). Codeberg
 * (Forgejo) has no GitHub-style "/releases/latest/download/<name>" alias,
 * so the current release's exact asset URL has to be resolved via its API
 * first.
 */
async function resolveGalleryDlUrl(): Promise<string> {
  const apiUrl = 'https://codeberg.org/api/v1/repos/mikf/gallery-dl/releases/latest';
  const res = await fetch(apiUrl, { headers: { Accept: 'application/json' } });
  if (!res.ok) {
    throw new Error(`Failed to resolve gallery-dl latest release: ${res.status} ${res.statusText}`);
  }
  const release = (await res.json()) as { assets?: { name: string; browser_download_url: string }[] };
  const asset = release.assets?.find((a) => a.name === 'gallery-dl.exe');
  if (!asset) {
    throw new Error('gallery-dl.exe asset not found in the latest Codeberg release');
  }
  return asset.browser_download_url;
}

const BINARIES = [
  {
    names: ['yt-dlp.exe'],
    url: 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe',
    isZip: false,
  },
  {
    names: ['gallery-dl.exe'],
    url: resolveGalleryDlUrl,
    isZip: false,
    // Codeberg's bot-protection blocks the spoofed browser UA used for the
    // GitHub-hosted downloads below; a default/no UA passes through fine.
    noSpoofedUserAgent: true,
  },
  {
    names: ['ffmpeg.exe', 'ffprobe.exe'],
    url: 'https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip',
    isZip: true,
    searchFiles: ['ffmpeg.exe', 'ffprobe.exe'],
  },
  {
    names: ['streamlink/bin/streamlink.exe'],
    url: 'https://github.com/streamlink/windows-builds/releases/download/8.2.1-1/streamlink-8.2.1-1-py314-x86_64.zip',
    isZip: true,
    // bin/streamlink.exe is a launcher that loads ../Python and ../pkgs, so the
    // whole portable build is kept. Its own 164 MB ffmpeg is dropped: the app
    // passes --ffmpeg-ffmpeg pointing at the ffmpeg it already ships.
    keepDir: 'streamlink',
    dropDirs: ['ffmpeg'],
  },
  {
    names: ['N_m3u8DL-RE.exe'],
    url: 'https://github.com/nilaoda/N_m3u8DL-RE/releases/download/v0.5.1-beta/N_m3u8DL-RE_v0.5.1-beta_win-x64_20251029.zip',
    isZip: true,
    searchFiles: ['N_m3u8DL-RE.exe'],
  },
];

async function downloadFile(url: string, dest: string, noSpoofedUserAgent = false): Promise<void> {
  console.log(`Downloading ${url} -> ${dest}...`);
  const response = await fetch(url, {
    headers: noSpoofedUserAgent
      ? {}
      : {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        },
  });
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`);
  }

  const writeStream = createWriteStream(dest);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await pipeline(response.body as any, writeStream);
}

function findFile(dir: string, fileName: string): string | null {
  const files = readdirSync(dir);
  for (const file of files) {
    const fullPath = join(dir, file);
    if (lstatSync(fullPath).isDirectory()) {
      const found = findFile(fullPath, fileName);
      if (found) return found;
    } else if (file.toLowerCase() === fileName.toLowerCase()) {
      return fullPath;
    }
  }
  return null;
}

async function extractZip(zipPath: string, extractTo: string): Promise<void> {
  console.log(`Extracting ${zipPath}...`);
  try {
    await exec(`powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${extractTo}' -Force"`);
  } catch (err) {
    console.error(`Failed to extract ${zipPath}:`, (err as Error).message);
    throw err;
  }
}

async function main() {
  const force = process.argv.includes('--force');

  if (!existsSync(BINARIES_DIR)) {
    mkdirSync(BINARIES_DIR);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const binary of BINARIES as any) {
    const allExist = binary.names.every((name: string) => existsSync(join(BINARIES_DIR, name)));

    if (allExist && !force) {
      console.log(`${binary.names.join(', ')} already exist(s), skipping...`);
      continue;
    }

    try {
      const url: string = typeof binary.url === 'function' ? await binary.url() : binary.url;

      if (binary.isZip) {
        const baseName = binary.keepDir ?? binary.names[0].replace('.exe', '');
        const zipDest = join(BINARIES_DIR, `${baseName}.zip`);
        const tempExtractDir = join(BINARIES_DIR, `temp_${baseName}`);

        await downloadFile(url, zipDest);
        if (existsSync(tempExtractDir)) {
          await exec(`powershell -Command "Remove-Item -Recurse -Force '${tempExtractDir}'"`);
        }
        mkdirSync(tempExtractDir);

        // The archive and its extraction directory are scratch space. Clean them
        // up in a finally block so a missing file inside the archive cannot leave
        // a stray temp_*/ directory (and a multi-hundred-MB zip) behind.
        try {
          await extractZip(zipDest, tempExtractDir);

          if (binary.keepDir) {
            const [root] = readdirSync(tempExtractDir);
            const rootPath = join(tempExtractDir, root);
            for (const dir of binary.dropDirs ?? []) rmSync(join(rootPath, dir), { recursive: true, force: true });
            const finalDir = join(BINARIES_DIR, binary.keepDir);
            rmSync(finalDir, { recursive: true, force: true });
            renameSync(rootPath, finalDir);
            // Older setups copied the bare launcher here; it cannot run on its own.
            rmSync(join(BINARIES_DIR, `${binary.keepDir}.exe`), { force: true });
            console.log(`Extracted ${binary.keepDir}/`);
            continue;
          }

          for (let i = 0; i < binary.searchFiles!.length; i++) {
            const searchFile = binary.searchFiles![i];
            const name = binary.names[i];
            const finalDest = join(BINARIES_DIR, name);
            const foundPath = findFile(tempExtractDir, searchFile);
            if (foundPath) {
              if (existsSync(finalDest)) {
                unlinkSync(finalDest);
              }
              renameSync(foundPath, finalDest);
              console.log(`Extracted and moved ${name}`);
            } else {
              throw new Error(`Could not find ${searchFile} in extracted archive`);
            }
          }
        } finally {
          if (existsSync(zipDest)) unlinkSync(zipDest);
          if (existsSync(tempExtractDir)) {
            await exec(`powershell -Command "Remove-Item -Recurse -Force '${tempExtractDir}'"`);
          }
        }
      } else {
        const finalDest = join(BINARIES_DIR, binary.names[0]);
        if (existsSync(finalDest)) unlinkSync(finalDest);
        await downloadFile(url, finalDest, !!binary.noSpoofedUserAgent);
        console.log(`Downloaded ${binary.names[0]}`);
      }
    } catch (err) {
      console.error(`Failed to setup ${binary.names.join(', ')}:`, (err as Error).message);
    }
  }

  console.log('Validating binaries...');
  let missing = false;
  for (const binary of BINARIES) {
    for (const name of binary.names) {
      const finalPath = join(BINARIES_DIR, name);
      if (!existsSync(finalPath)) {
        console.error(`ERROR: Required binary ${name} was not created!`);
        missing = true;
      }
    }
  }

  if (missing) {
    console.error('Binary setup failed. Exiting with error.');
    process.exit(1);
  }

  console.log('Done.');
}

main();

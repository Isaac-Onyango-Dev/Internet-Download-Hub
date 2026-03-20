import { exec } from 'node:child_process';
import { createWriteStream, existsSync, mkdirSync, renameSync, unlinkSync, readdirSync, lstatSync } from 'node:fs';
import { join, basename, dirname } from 'node:path';
import { pipeline } from 'node:stream/promises';

const BINARIES_DIR = 'binaries';

const BINARIES = [
  {
    name: 'yt-dlp.exe',
    url: 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe',
    isZip: false
  },
  {
    name: 'gallery-dl.exe',
    url: 'https://github.com/mikf/gallery-dl/releases/latest/download/gallery-dl.exe',
    isZip: false
  },
  {
    name: 'ffmpeg.exe',
    url: 'https://github.com/BtbN/ffmpeg-static-builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip',
    isZip: true,
    searchFile: 'ffmpeg.exe'
  },
  {
    name: 'ffprobe.exe',
    url: 'https://github.com/BtbN/ffmpeg-static-builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip',
    isZip: true,
    searchFile: 'ffprobe.exe'
  },
  {
    name: 'streamlink.exe',
    url: 'https://github.com/streamlink/windows-builds/releases/download/8.2.1-1/streamlink-8.2.1-1-py314-x86_64.zip',
    isZip: true,
    searchFile: 'streamlink.exe'
  },
  {
    name: 'N_m3u8DL-RE.exe',
    url: 'https://github.com/nilaoda/N_m3u8DL-RE/releases/download/v0.5.1-beta/N_m3u8DL-RE_v0.5.1-beta_win-x64_20251029.zip',
    isZip: true,
    searchFile: 'N_m3u8DL-RE.exe'
  }
];

async function downloadFile(url: string, dest: string): Promise<void> {
  console.log(`Downloading ${url} -> ${dest}...`);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.statusText}`);
  }
  
  const writeStream = createWriteStream(dest);
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
  return new Promise((resolve, reject) => {
    exec(`powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${extractTo}' -Force"`, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

async function main() {
  const force = process.argv.includes('--force');

  if (!existsSync(BINARIES_DIR)) {
    mkdirSync(BINARIES_DIR);
  }

  for (const binary of BINARIES) {
    const finalDest = join(BINARIES_DIR, binary.name);
    
    if (existsSync(finalDest) && !force) {
      console.log(`${binary.name} already exists, skipping...`);
      continue;
    }

    try {
      if (binary.isZip) {
        const zipDest = join(BINARIES_DIR, `${binary.name}.zip`);
        const tempExtractDir = join(BINARIES_DIR, `temp_${binary.name}`);
        
        await downloadFile(binary.url, zipDest);
        if (existsSync(tempExtractDir)) {
          exec(`powershell -Command "Remove-Item -Recurse -Force '${tempExtractDir}'"`);
        }
        mkdirSync(tempExtractDir);
        await extractZip(zipDest, tempExtractDir);
        
        const foundPath = findFile(tempExtractDir, binary.searchFile!);
        if (foundPath) {
          renameSync(foundPath, finalDest);
          console.log(`Extracted and moved ${binary.name}`);
        } else {
          throw new Error(`Could not find ${binary.searchFile} in extracted archive`);
        }
        
        // Cleanup
        unlinkSync(zipDest);
        exec(`powershell -Command "Remove-Item -Recurse -Force '${tempExtractDir}'"`);
      } else {
        await downloadFile(binary.url, finalDest);
        console.log(`Downloaded ${binary.name}`);
      }
    } catch (err) {
      console.error(`Failed to setup ${binary.name}:`, (err as Error).message);
    }
  }

  console.log('Done.');
}

main();

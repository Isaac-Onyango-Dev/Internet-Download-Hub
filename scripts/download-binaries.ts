import { exec } from 'node:child_process';
import { createWriteStream, createReadStream } from 'node:fs';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';

const BINARIES = [
  {
    name: 'yt-dlp.exe',
    url: 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe',
    dest: 'binaries/yt-dlp.exe'
  },
  {
    name: 'ffmpeg.exe',
    url: 'https://github.com/BtbN/ffmpeg-static-builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip',
    dest: 'binaries/ffmpeg.zip',
    extract: true
  },
  {
    name: 'ffprobe.exe',
    url: 'https://github.com/BtbN/ffmpeg-static-builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip',
    dest: 'binaries/ffprobe.zip',
    extract: true
  }
];

async function downloadFile(url: string, dest: string): Promise<void> {
  console.log(`Downloading ${url}...`);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download: ${response.statusText}`);
  }
  
  const writeStream = createWriteStream(dest);
  await pipeline(response.body as any, writeStream);
  console.log(`Downloaded ${dest}`);
}

async function extractZip(zipPath: string, extractTo: string): Promise<void> {
  console.log(`Extracting ${zipPath} to ${extractTo}...`);
  return new Promise((resolve, reject) => {
    exec(`powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${extractTo}' -Force"`, (error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

async function main() {
  try {
    console.log('Downloading required binaries...');
    
    // Create binaries directory if it doesn't exist
    await new Promise<void>((resolve, reject) => {
      exec('powershell -Command "New-Item -ItemType Directory -Force -Path \\"binaries\\""', (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
    
    for (const binary of BINARIES) {
      await downloadFile(binary.url, binary.dest);
      
      if (binary.extract) {
        await extractZip(binary.dest, binary.dest.replace('.zip', ''));
      }
    }
    
    console.log('All binaries downloaded successfully');
  } catch (error) {
    console.error('Error downloading binaries:', error);
    process.exit(1);
  }
}

if (import.meta.url === undefined) {
  main();
}

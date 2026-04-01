import { extractVideoInfo } from './electron/extractor';
import path from 'path';

async function run() {
  try {
    const info = await extractVideoInfo('https://www.youtube.com/watch?v=dQw4w9WgXcQ', {
      ytDlp: path.join(process.cwd(), 'binaries/yt-dlp.exe'),
      ffmpeg: path.join(process.cwd(), 'binaries/ffmpeg.exe'),
      streamlink: path.join(process.cwd(), 'binaries/streamlink.exe'),
      nm3u8dl: path.join(process.cwd(), 'binaries/N_m3u8DL-RE.exe'),
      galleryDl: path.join(process.cwd(), 'binaries/gallery-dl.exe')
    });
    console.log('SUCCESS:', info ? 'got info' : 'no info');
  } catch (e) {
    console.error('ERROR OCCURRED:', Object(e).message || String(e));
  }
}

run();

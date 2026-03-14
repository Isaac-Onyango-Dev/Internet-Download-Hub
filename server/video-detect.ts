import { storage } from "./storage";
import { exec } from "child_process";
import fs from "fs";
import path from "path";

export interface DetectedVideoFormat {
  formatId: string;
  ext: string;
  resolution: string;
  filesize: number;
  vcodec: string;
  acodec: string;
}

export interface DetectedVideo {
  url: string;
  title: string;
  mimeType: string;
  sourceType: "yt-dlp";
  formats: DetectedVideoFormat[];
  thumbnail?: string;
  duration?: number;
  uploader?: string;
  description?: string;
}

let activeDetectProcess: any = null;

export async function detectVideos(pageUrl: string): Promise<DetectedVideo[]> {
  // If there's an active process from a previous user click, kill it to prevent hanging
  if (activeDetectProcess) {
    try {
      activeDetectProcess.kill();
      console.log(`[video-detect] Killed previous pending yt-dlp detect process.`);
    } catch (e) {
      console.error(`[video-detect] Failed to kill previous process`, e);
    }
  }

  try {
    const ytdlModule = await import('youtube-dl-exec');
    const youtubedl = (ytdlModule.default || ytdlModule) as any;
    
    console.log(`[video-detect] Running yt-dlp for ${pageUrl}`);
    // Spawn a direct child process so we can kill it
    activeDetectProcess = youtubedl.exec(pageUrl, {
      dumpSingleJson: true,
      noWarnings: true,
      noCallHome: true,
      noCheckCertificate: true,
      preferFreeFormats: true,
      youtubeSkipDashManifest: true,
    } as any, { timeout: 30000 }); // strict 30 second timeout

    const { stdout } = await activeDetectProcess;
    activeDetectProcess = null; // reset lock
    
    if (!stdout) return [];
    
    let output;
    try {
      output = JSON.parse(stdout as string);
    } catch (e) {
      return [];
    }

    if (!output) {
      return [];
    }

    const title = output.title || "Unknown Video";
    const thumbnail = output.thumbnail;
    const url = output.webpage_url || pageUrl;
    const duration = output.duration;
    const uploader = output.uploader || output.channel;
    const description = output.description;

    const formats: DetectedVideoFormat[] = [];

    // Process formats returned by yt-dlp
    if (output.formats && Array.isArray(output.formats)) {
      output.formats.forEach((f: any) => {
        // We only care about viable downloadable media, skip ones without size maybe or just filter sensibly
        if (f.format_id && f.ext && f.ext !== "mhtml") {
          formats.push({
            formatId: f.format_id,
            ext: f.ext,
            resolution: f.resolution || (f.width && f.height ? `${f.width}x${f.height}` : 'unknown'),
            filesize: f.filesize || f.filesize_approx || 0,
            vcodec: f.vcodec || "none",
            acodec: f.acodec || "none",
          });
        }
      });
    }

    // Sort by best resolution/filesize generally (simplistic sort)
    formats.sort((a, b) => b.filesize - a.filesize);

    return [{
      url,
      title,
      mimeType: "video/mp4",
      sourceType: "yt-dlp",
      formats,
      thumbnail,
      duration,
      uploader,
      description
    }];

  } catch (err: any) {
    if (err.killed || err.signal === 'SIGTERM' || err.code === 'ABORT_ERR') {
      console.log("[video-detect] Process abortion caught gracefully. Returning empty array.");
      return [];
    }
    console.error("yt-dlp detection error:", err.message);
    throw new Error(`Failed to extract video details: ${err.message}`);
  }
}

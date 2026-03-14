import { storage } from "./storage";
import { spawn, exec } from "child_process";
import fs from "fs";
import path from "path";
import https from "https";
import http from "http";
import { broadcastProgress } from "./ws";
import ytDlpWrap from "youtube-dl-exec";

// A basic downloader service that handles actually fetching the files
// In a real production app we'd use a more robust queue (e.g. BullMQ)
export class DownloaderService {
    private activeTasks: Map<number, { abort?: () => void }> = new Map();
    // We'll save files to a relative Downloads/ folder by default for local simulation
    private downloadDir = path.join(process.cwd(), "Downloads");

    constructor() {
        this.ensureDir();
    }

    private ensureDir() {
        if (!fs.existsSync(this.downloadDir)) {
            fs.mkdirSync(this.downloadDir, { recursive: true });
        }
    }

    private async getFreeSpace(): Promise<number> {
        return new Promise((resolve) => {
            // Check free space on the drive containing the download directory
            const drive = path.parse(this.downloadDir).root;
            exec(`powershell -Command "Get-PSDrive ${drive.replace(/[\\:]/g, '')} | Select-Object -ExpandProperty Free"`, (err: any, stdout: string) => {
                if (err) {
                    console.error("Failed to get free space:", err);
                    resolve(Number.MAX_SAFE_INTEGER); // Assume enough space if check fails to avoid blocking user unnecessarily
                    return;
                }
                resolve(parseInt(stdout.trim(), 10) || 0);
            });
        });
    }

    private isYtDlpUrl(url: string): boolean {
        // Check if URL is from a platform that requires yt-dlp
        const ytDlpDomains = ['youtube.com', 'youtu.be', 'vimeo.com', 'dailymotion.com', 'twitch.tv', 'instagram.com', 'tiktok.com'];
        try {
            const hostname = new URL(url).hostname;
            return ytDlpDomains.some(domain => hostname.includes(domain));
        } catch {
            return false;
        }
    }

    public async startDownload(downloadId: number) {
        if (this.activeTasks.has(downloadId)) return;

        const download = await storage.getDownload(downloadId);
        if (!download) return;

        // Disk space check (Step 8)
        const freeSpace = await this.getFreeSpace();
        const estimatedSize = download.totalBytes || 0;
        const buffer = 500 * 1024 * 1024; // 500MB buffer

        if (freeSpace < (estimatedSize + buffer)) {
            const errorMsg = `Insufficient disk space. Available: ${Math.floor(freeSpace / (1024 * 1024))}MB, Required: ${Math.floor((estimatedSize + buffer) / (1024 * 1024))}MB (including 500MB buffer)`;
            console.error(`[downloader] ${errorMsg}`);
            await storage.updateDownload(downloadId, {
                state: "error",
                error: errorMsg
            });
            return;
        }

        await storage.updateDownload(downloadId, { state: "downloading", error: null });

        const outputPath = path.join(this.downloadDir, download.filename || `download_${downloadId}.mp4`);
        await storage.updateDownload(downloadId, { savePath: outputPath });

        try {
            if (this.isYtDlpUrl(download.url)) {
                // Use yt-dlp for known video platforms
                await this.downloadWithYtDlp(downloadId, download.url, outputPath, download.formatId ?? undefined);
            } else {
                // Use simple HTTP download for direct media files
                await this.downloadWithHttp(downloadId, download.url, outputPath);
            }
        } catch (err: any) {
            this.activeTasks.delete(downloadId);
            await storage.updateDownload(downloadId, {
                state: "error",
                error: err.message || "Unknown download error"
            });
        }
    }

    private downloadWithHttp(downloadId: number, url: string, outputPath: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const protocol = url.startsWith('https') ? https : http;
            const file = fs.createWriteStream(outputPath, { flags: 'a' }); // Open in append mode
            let lastUpdate = Date.now();
            let totalBytes = 0;
            let aborted = false;

            const req = protocol.get(url, { timeout: 30000 }, async (res) => {
                // Get content length from headers
                const contentLength = parseInt(res.headers['content-length'] || '0', 10);
                if (contentLength > 0) {
                    totalBytes = contentLength;
                    await storage.updateDownload(downloadId, { totalBytes });
                }

                let receivedBytes = 0;

                res.on('data', async (chunk) => {
                    if (aborted) return;
                    receivedBytes += chunk.length;

                    // Throttle updates to 1 per second
                    if (Date.now() - lastUpdate > 1000) {
                        lastUpdate = Date.now();
                        const percent = totalBytes > 0 ? Math.floor((receivedBytes / totalBytes) * 100) : 0;
                        await storage.updateDownload(downloadId, {
                            receivedBytes,
                            totalBytes: totalBytes || receivedBytes
                        }).catch(console.error);
                        
                        broadcastProgress(downloadId, {
                            totalBytes: totalBytes || receivedBytes,
                            receivedBytes,
                            percent,
                            state: "downloading"
                        });
                    }
                });

                res.pipe(file);

                file.on('finish', async () => {
                    file.close();
                    if (aborted) return;
                    await storage.updateDownload(downloadId, {
                        state: "completed",
                        receivedBytes: totalBytes || receivedBytes,
                        totalBytes: totalBytes || receivedBytes,
                        completedAt: new Date()
                    });
                    this.activeTasks.delete(downloadId);
                    resolve();
                });

                file.on('error', async (err) => {
                    if (aborted) return;
                    fs.unlink(outputPath, () => { }); // Delete incomplete file
                    await storage.updateDownload(downloadId, {
                        state: "error",
                        error: err.message
                    });
                    this.activeTasks.delete(downloadId);
                    reject(err);
                });

            }).on('error', async (err) => {
                if (aborted) return;
                fs.unlink(outputPath, () => { }); // Delete incomplete file
                await storage.updateDownload(downloadId, {
                    state: "error",
                    error: err.message
                });
                this.activeTasks.delete(downloadId);
                reject(err);
            });

            this.activeTasks.set(downloadId, {
                abort: () => {
                    aborted = true;
                    req.destroy();
                    file.close();
                    resolve();
                }
            });
        });
    }

    private downloadWithYtDlp(downloadId: number, url: string, outputPath: string, formatId?: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const args = [
                url,
                "-o", outputPath,
                "--no-playlist"
            ];

            if (formatId) {
                args.push("-f", formatId);
            } else {
                args.push("-f", "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best");
            }

            try {
                const ytDlpPath = (ytDlpWrap as any).constants.YOUTUBE_DL_PATH;
                console.log(`\n[downloader] --- EXECUTING YT-DLP ---`);
                console.log(`[downloader] Path: ${ytDlpPath}`);
                console.log(`[downloader] Args: ${args.join(' ')}`);
                console.log(`[downloader] -------------------------\n`);

                // Use spawn instead of exec to avoid shell injection and parsing issues with URLs on Windows
                const child = spawn(ytDlpPath, args);

                let lastUpdate = Date.now();
                let currentTotalBytes = 0;
                let errorMessage = "";

                let aborted = false;

                child.stdout?.on("data", async (data) => {
                    if (aborted) return;
                    const text = data.toString();
                    const progressMatch = text.match(/\[download\]\s+([\d\.]+)\%\s+of\s+[~]?\s*([\d\.]+[KMG]?iB)/);

                    if (progressMatch) {
                        const percent = parseFloat(progressMatch[1]);
                        const sizeStr = progressMatch[2];

                        let sizeBytes = 0;
                        if (sizeStr.includes("GiB")) sizeBytes = parseFloat(sizeStr) * 1024 * 1024 * 1024;
                        else if (sizeStr.includes("MiB")) sizeBytes = parseFloat(sizeStr) * 1024 * 1024;
                        else if (sizeStr.includes("KiB")) sizeBytes = parseFloat(sizeStr) * 1024;
                        else sizeBytes = parseFloat(sizeStr);

                        currentTotalBytes = sizeBytes;
                        const receivedBytes = Math.floor(sizeBytes * (percent / 100));

                        if (Date.now() - lastUpdate > 1000) {
                            lastUpdate = Date.now();
                            await storage.updateDownload(downloadId, {
                                totalBytes: currentTotalBytes,
                                receivedBytes: receivedBytes
                            }).catch(console.error);

                            broadcastProgress(downloadId, {
                                totalBytes: currentTotalBytes,
                                receivedBytes: receivedBytes,
                                percent: Math.floor(percent),
                                state: "downloading"
                                // speed and eta could be parsed from yt-dlp output if more complex regex is used
                            });
                        }
                    }
                });

                child.stderr?.on("data", (data) => {
                    if (aborted) return;
                    const text = data.toString();
                    console.error(`yt-dlp error [${downloadId}]:`, text);
                    errorMessage += text;
                });

                child.on("close", async (code) => {
                    this.activeTasks.delete(downloadId);
                    if (aborted) return;

                    if (code === 0) {
                        await storage.updateDownload(downloadId, {
                            state: "completed",
                            receivedBytes: currentTotalBytes,
                            completedAt: new Date()
                        });
                        resolve();
                    } else {
                        await storage.updateDownload(downloadId, {
                            state: "error",
                            error: errorMessage || `yt-dlp exited with code ${code}`
                        });
                        reject(new Error(errorMessage || `yt-dlp exited with code ${code}`));
                    }
                });

                this.activeTasks.set(downloadId, {
                    abort: () => {
                        aborted = true;
                        child.kill();
                        resolve();
                    }
                });
            } catch (err) {
                reject(err);
            }
        });
    }

    public async cancelDownload(downloadId: number) {
        const task = this.activeTasks.get(downloadId);
        if (task?.abort) {
            task.abort();
        }
        this.activeTasks.delete(downloadId);
        await storage.updateDownload(downloadId, { state: "paused" });
    }

    public streamDownload(
        url: string,
        formatId: string | undefined,
        audioOnly: boolean,
        res: http.ServerResponse,
        onStart?: () => void,
        onProgress?: (total: number, received: number) => void,
        onError?: (err: Error) => void,
        onComplete?: () => void
    ) {
        return new Promise<void>((resolve, reject) => {
            const ytDlpPath = (ytDlpWrap as any).constants.YOUTUBE_DL_PATH;
            
            const args = [url, "-o", "-", "--no-playlist"];
            
            if (audioOnly) {
                args.push("-x", "--audio-format", "mp3");
            } else if (formatId) {
                args.push("-f", `${formatId}+bestaudio/best`);
            } else {
                args.push("-f", "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best");
            }

            console.log(`\n[downloader stream] --- EXECUTING YT-DLP STREAM ---`);
            console.log(`[downloader stream] Path: ${ytDlpPath}`);
            console.log(`[downloader stream] Args: ${args.join(' ')}`);
            console.log(`[downloader stream] --------------------------------\n`);

            const child = spawn(ytDlpPath, args, { stdio: ['ignore', 'pipe', 'pipe'] });

            let aborted = false;
            if (onStart) onStart();

            // Note: when streaming to stdout (-o -), yt-dlp output goes to stdout.
            // But if it's binary data, it just goes to stdout. We can't parse logs from stdout easily if it's binary.
            // Actually, yt-dlp prints progress to stderr when stdout is redirected to a file or pipe.
            
            let currentTotalBytes = 0;
            let receivedBytes = 0;
            let lastUpdate = Date.now();
            let errorMessage = "";

            child.stdout.pipe(res);

            child.stderr.on("data", (data) => {
                if (aborted) return;
                const text = data.toString();
                // When stdout is a pipe, yt-dlp outputs progress to stderr
                const progressMatch = text.match(/\[download\]\s+([\d\.]+)\%\s+of\s+[~]?\s*([\d\.]+[KMG]?iB)/);
                if (progressMatch) {
                    const percent = parseFloat(progressMatch[1]);
                    const sizeStr = progressMatch[2];

                    let sizeBytes = 0;
                    if (sizeStr.includes("GiB")) sizeBytes = parseFloat(sizeStr) * 1024 * 1024 * 1024;
                    else if (sizeStr.includes("MiB")) sizeBytes = parseFloat(sizeStr) * 1024 * 1024;
                    else if (sizeStr.includes("KiB")) sizeBytes = parseFloat(sizeStr) * 1024;
                    else sizeBytes = parseFloat(sizeStr);

                    currentTotalBytes = sizeBytes;
                    receivedBytes = Math.floor(sizeBytes * (percent / 100));

                    if (onProgress && Date.now() - lastUpdate > 1000) {
                        lastUpdate = Date.now();
                        onProgress(currentTotalBytes, receivedBytes);
                        
                        // We don't have a downloadId here easily if we didn't pass it
                        // But we can infer it or just rely on onProgress which is called in routes.ts
                    }
                } else if (!text.includes("[download]") && !text.includes("[ffmpeg]")) {
                    // Collect potential errors
                    errorMessage += text;
                }
            });

            res.on("close", () => {
                // Browser canceled or disconnected
                aborted = true;
                child.kill();
                if (onError) onError(new Error("Client disconnected"));
                resolve();
            });

            child.on("close", (code) => {
                if (aborted) return;
                if (code === 0) {
                    if (onComplete) onComplete();
                    res.end();
                    resolve();
                } else {
                    const err = new Error(errorMessage || `yt-dlp exited with code ${code}`);
                    if (onError) onError(err);
                    if (!res.headersSent) {
                        res.destroy(err);
                    } else {
                        res.end();
                    }
                    resolve();
                }
            });
        });
    }
}

export const downloader = new DownloaderService();

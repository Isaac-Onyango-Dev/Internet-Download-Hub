import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { detectVideos } from "./video-detect";
import { downloader } from "./downloader";
import { broadcastProgress } from "./ws";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // === Downloads API ===

  app.get(api.downloads.list.path, async (req, res) => {
    try {
      const downloads = await storage.getDownloads();
      res.json(downloads);
    } catch (err: any) {
      console.error(err.stack || err);
      res.status(500).json({ error: true, message: err.message, details: err.stack });
    }
  });

  app.get(api.downloads.get.path, async (req, res) => {
    try {
      const download = await storage.getDownload(Number(req.params.id));
      if (!download) {
        return res.status(404).json({ error: true, message: 'Download not found' });
      }
      res.json(download);
    } catch (err: any) {
      console.error(err.stack || err);
      res.status(500).json({ error: true, message: err.message, details: err.stack });
    }
  });

  app.post(api.downloads.create.path, async (req, res) => {
    try {
      const input = api.downloads.create.input.parse(req.body);
      const download = await storage.createDownload(input);
      // Let the worker handle it async
      downloader.startDownload(download.id).catch(console.error);
      res.status(201).json(download);
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          error: true,
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      console.error(err.stack || err);
      res.status(500).json({ error: true, message: err.message, details: err.stack });
    }
  });

  app.patch(api.downloads.update.path, async (req, res) => {
    try {
      const input = api.downloads.update.input.parse(req.body);
      const download = await storage.updateDownload(Number(req.params.id), input);
      if (!download) {
        return res.status(404).json({ message: 'Download not found' });
      }

      // If pausing or resuming via UI
      if (input.state === "paused") {
        await downloader.cancelDownload(download.id);
      } else if (input.state === "downloading") {
        downloader.startDownload(download.id).catch(console.error);
      }

      res.json(download);
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          error: true,
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      console.error(err.stack || err);
      res.status(500).json({ error: true, message: 'Internal Server Error', details: err.stack });
    }
  });

  app.delete(api.downloads.delete.path, async (req, res) => {
    try {
      await storage.deleteDownload(Number(req.params.id));
      res.status(204).end();
    } catch (err: any) {
      console.error(err.stack || err);
      res.status(500).json({ error: true, message: err.message, details: err.stack });
    }
  });

  app.post(api.downloads.clearCompleted.path, async (req, res) => {
    try {
      await storage.clearCompletedDownloads();
      res.status(204).end();
    } catch (err: any) {
      console.error(err.stack || err);
      res.status(500).json({ error: true, message: err.message, details: err.stack });
    }
  });

  app.get(api.downloads.stream.path, async (req, res) => {
    try {
      const url = req.query.url as string;
      const formatId = req.query.formatId as string | undefined;
      const audioOnly = req.query.audioOnly === 'true';

      if (!url) {
        return res.status(400).json({ error: true, message: 'URL is required' });
      }

      const filename = (req.query.filename as string) || "download" + (audioOnly ? ".mp3" : ".mp4");

      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
      res.setHeader('Content-Type', audioOnly ? 'audio/mpeg' : 'video/mp4');

      if (req.method === 'HEAD') {
        // Just return headers for the frontend's connection check without starting the download process
        return res.status(200).end();
      }

      const download = await storage.createDownload({
        url,
        filename,
        state: "downloading",
        formatId: formatId || null,
        mimeType: audioOnly ? 'audio/mpeg' : 'video/mp4'
      });

      await downloader.streamDownload(
        url,
        formatId,
        audioOnly,
        res,
        () => {}, 
        async (total: number, received: number) => {
          try {
            const percent = total > 0 ? Math.floor((received / total) * 100) : 0;
            await storage.updateDownload(download.id, { totalBytes: total, receivedBytes: received });
            broadcastProgress(download.id, {
              totalBytes: total,
              receivedBytes: received,
              percent,
              state: "downloading"
            });
          } catch (err) {}
        },
        async (err: Error) => {
          console.error(`Stream error for DL ${download.id}:`, err);
          try {
            await storage.updateDownload(download.id, { state: "error", error: err.message });
          } catch (e) {}
        },
        async () => {
          try {
            const finalDL = await storage.getDownload(download.id);
            await storage.updateDownload(download.id, {
              state: "completed",
              completedAt: new Date(),
              receivedBytes: finalDL?.totalBytes || 0
            });
            broadcastProgress(download.id, {
              totalBytes: finalDL?.totalBytes || 0,
              receivedBytes: finalDL?.totalBytes || 0,
              percent: 100,
              state: "completed"
            });
          } catch (e) {}
        }
      );
    } catch (err: any) {
      console.error(err.stack || err);
      if (!res.headersSent) {
        res.status(500).json({ error: true, message: err.message, details: err.stack });
      }
    }
  });



  // === Video Detection API ===
  
  app.post(api.downloads.fetchInfo.path, async (req, res) => {
    try {
      const { url } = req.body;
      if (!url) return res.status(400).json({ message: "URL is required" });
      console.log(`[api] Fetching info for URL: ${url}`);
      const videos = await detectVideos(url);
      console.log(`[api] Detected ${videos.length} videos`);
      res.json(videos[0] || null);
    } catch (err: any) {
      console.error(err.stack || err);
      res.status(500).json({ error: true, message: err.message, details: err.stack });
    }
  });

  app.post(api.videoDetect.path, async (req, res) => {
    try {
      const { pageUrl } = api.videoDetect.input.parse(req.body);
      const videos = await detectVideos(pageUrl);
      res.json(videos);
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: true, message: err.errors[0].message });
      }
      console.error(err.stack || err);
      res.status(500).json({ error: true, message: err.message ?? "Detection failed", details: err.stack });
    }
  });

  // === Settings API ===

  app.get(api.settings.get.path, async (req, res) => {
    try {
      const settings = await storage.getSettings();
      res.json(settings);
    } catch (err: any) {
      console.error(err.stack || err);
      res.status(500).json({ error: true, message: err.message, details: err.stack });
    }
  });

  app.patch(api.settings.update.path, async (req, res) => {
    try {
      const input = api.settings.update.input.parse(req.body);
      const settings = await storage.updateSettings(input);
      res.json(settings);
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          error: true,
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      console.error("Settings Update Error:", err.stack || err);
      res.status(500).json({ error: true, message: 'Internal Server Error', details: err.stack });
    }
  });

  // === Startup Recovery ===
  storage.getDownloads().then(downloads => {
    downloads.forEach(d => {
      if (d.state === "downloading" || d.state === "queued") {
        console.log(`[Startup] Resuming download: ${d.filename} (${d.id})`);
        downloader.startDownload(d.id).catch(err => {
          console.error(`Failed to resume download ${d.id}:`, err);
        });
      }
    });
  }).catch(console.error);

  return httpServer;
}


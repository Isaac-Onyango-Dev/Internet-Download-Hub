import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // === Downloads API ===
  
  app.get(api.downloads.list.path, async (req, res) => {
    const downloads = await storage.getDownloads();
    // Optional filtering if needed, though mostly handled by frontend for this simulation
    res.json(downloads);
  });

  app.get(api.downloads.get.path, async (req, res) => {
    const download = await storage.getDownload(Number(req.params.id));
    if (!download) {
      return res.status(404).json({ message: 'Download not found' });
    }
    res.json(download);
  });

  app.post(api.downloads.create.path, async (req, res) => {
    try {
      const input = api.downloads.create.input.parse(req.body);
      const download = await storage.createDownload(input);
      res.status(201).json(download);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.patch(api.downloads.update.path, async (req, res) => {
    try {
      const input = api.downloads.update.input.parse(req.body);
      const download = await storage.updateDownload(Number(req.params.id), input);
      if (!download) {
        return res.status(404).json({ message: 'Download not found' });
      }
      res.json(download);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      // If error is because record didn't exist (though updateDownload throws/returns undefined usually)
      res.status(500).json({ message: 'Internal Server Error' });
    }
  });

  app.delete(api.downloads.delete.path, async (req, res) => {
    await storage.deleteDownload(Number(req.params.id));
    res.status(204).end();
  });

  app.post(api.downloads.clearCompleted.path, async (req, res) => {
    await storage.clearCompletedDownloads();
    res.status(204).end();
  });

  // === Settings API ===

  app.get(api.settings.get.path, async (req, res) => {
    const settings = await storage.getSettings();
    res.json(settings);
  });

  app.patch(api.settings.update.path, async (req, res) => {
    try {
      const input = api.settings.update.input.parse(req.body);
      const settings = await storage.updateSettings(input);
      res.json(settings);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      res.status(500).json({ message: 'Internal Server Error' });
    }
  });

  // Seed data on startup
  await seedDatabase();

  return httpServer;
}

// Seed function to populate some initial data for the simulator
export async function seedDatabase() {
  const existing = await storage.getDownloads();
  if (existing.length === 0) {
    await storage.createDownload({
      url: "https://example.com/movie_4k.mp4",
      filename: "movie_4k.mp4",
      mimeType: "video/mp4",
      totalBytes: 2500000000,
      receivedBytes: 1200000000,
      state: "downloading",
      savePath: "Downloads/Movies"
    });
    
    await storage.createDownload({
      url: "https://example.com/archive.zip",
      filename: "project_backup_2024.zip",
      mimeType: "application/zip",
      totalBytes: 50000000,
      receivedBytes: 50000000,
      state: "completed",
      savePath: "Downloads/Backups"
    });

    await storage.createDownload({
      url: "https://example.com/installer.exe",
      filename: "setup_v2.exe",
      mimeType: "application/x-msdownload",
      totalBytes: 15000000,
      receivedBytes: 0,
      state: "paused",
      savePath: "Downloads/Software"
    });
  }
}

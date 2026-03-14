import { z } from "zod";

// === TYPE DEFINITIONS ===

export type DownloadState = "queued" | "downloading" | "paused" | "completed" | "error" | "interrupted";
export type Theme = "light" | "dark" | "system";

export interface Download {
  id: number;
  url: string;
  filename: string;
  mimeType: string | null;
  totalBytes: number;
  receivedBytes: number;
  formatId: string | null;
  state: DownloadState;
  error: string | null;
  savePath: string | null;
  createdAt: Date;
  completedAt: Date | null;
}

export interface Settings {
  id: number;
  theme: Theme;
  maxConcurrentDownloads: number;
  autoCapture: boolean;
  fileTypes: string[];
  downloadPath: string;
}

// === ZOD SCHEMAS ===

export const insertDownloadSchema = z.object({
  url: z.string().url("Must be a valid URL"),
  filename: z.string().min(1, "Filename is required"),
  mimeType: z.string().nullable().optional(),
  totalBytes: z.number().optional(),
  receivedBytes: z.number().optional(),
  formatId: z.string().nullable().optional(),
  state: z.enum(["queued", "downloading", "paused", "completed", "error", "interrupted"]).optional(),
  error: z.string().nullable().optional(),
  savePath: z.string().nullable().optional(),
});

export const insertSettingsSchema = z.object({
  theme: z.enum(["light", "dark", "system"]).optional(),
  maxConcurrentDownloads: z.number().int().min(1).max(10).optional(),
  autoCapture: z.boolean().optional(),
  fileTypes: z.array(z.string()).optional(),
  downloadPath: z.string().optional(),
});

// === INFERRED TYPES ===

export type InsertDownload = z.infer<typeof insertDownloadSchema>;
export type InsertSettings = z.infer<typeof insertSettingsSchema>;

// API Types
export type CreateDownloadRequest = InsertDownload;
export type UpdateDownloadRequest = Partial<InsertDownload>;
export type UpdateSettingsRequest = Partial<InsertSettings>;

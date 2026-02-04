import { pgTable, text, serial, integer, boolean, timestamp, jsonb, bigint } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// === TABLE DEFINITIONS ===

export const downloads = pgTable("downloads", {
  id: serial("id").primaryKey(),
  url: text("url").notNull(),
  filename: text("filename").notNull(),
  mimeType: text("mime_type"),
  totalBytes: bigint("total_bytes", { mode: "number" }).default(0),
  receivedBytes: bigint("received_bytes", { mode: "number" }).default(0),
  state: text("state", { enum: ["queued", "downloading", "paused", "completed", "error", "interrupted"] }).default("queued").notNull(),
  error: text("error"),
  savePath: text("save_path"),
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  theme: text("theme", { enum: ["light", "dark", "system"] }).default("system"),
  maxConcurrentDownloads: integer("max_concurrent_downloads").default(3),
  autoCapture: boolean("auto_capture").default(true),
  fileTypes: jsonb("file_types").$type<string[]>().default(["mp4", "mp3", "zip", "exe", "pdf", "jpg", "png"]),
  downloadPath: text("download_path").default("Downloads/"),
});

// === SCHEMAS ===

export const insertDownloadSchema = createInsertSchema(downloads).omit({ 
  id: true, 
  createdAt: true, 
  completedAt: true 
});

export const insertSettingsSchema = createInsertSchema(settings).omit({ 
  id: true 
});

// === TYPES ===

export type Download = typeof downloads.$inferSelect;
export type InsertDownload = z.infer<typeof insertDownloadSchema>;
export type Settings = typeof settings.$inferSelect;
export type InsertSettings = z.infer<typeof insertSettingsSchema>;

// API Types
export type CreateDownloadRequest = InsertDownload;
export type UpdateDownloadRequest = Partial<InsertDownload>;
export type UpdateSettingsRequest = Partial<InsertSettings>;

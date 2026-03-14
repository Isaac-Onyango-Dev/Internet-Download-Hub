import Database from "better-sqlite3";
import path from "path";
import {
  type Download,
  type InsertDownload,
  type Settings,
  type InsertSettings,
} from "@shared/schema";

// ── Database setup ────────────────────────────────────────────────────────────
const DB_PATH = path.join(process.cwd(), "downloads.db");
const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent read performance
db.pragma("journal_mode = WAL");

// Create tables if they don't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS downloads (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    url             TEXT    NOT NULL,
    filename        TEXT    NOT NULL,
    mime_type       TEXT,
    total_bytes     INTEGER NOT NULL DEFAULT 0,
    received_bytes  INTEGER NOT NULL DEFAULT 0,
    format_id       TEXT,
    state           TEXT    NOT NULL DEFAULT 'queued',
    error           TEXT,
    save_path       TEXT,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
    completed_at    TEXT
  );

  CREATE TABLE IF NOT EXISTS settings (
    id                       INTEGER PRIMARY KEY DEFAULT 1,
    theme                    TEXT NOT NULL DEFAULT 'system',
    max_concurrent_downloads INTEGER NOT NULL DEFAULT 3,
    auto_capture             INTEGER NOT NULL DEFAULT 1,
    file_types               TEXT    NOT NULL DEFAULT '["mp4","mp3","zip","exe","pdf","jpg","png"]',
    download_path            TEXT    NOT NULL DEFAULT 'Downloads/'
  );

  -- Ensure a single settings row always exists
  INSERT OR IGNORE INTO settings (id) VALUES (1);
`);

// ── Row → Domain mappers ──────────────────────────────────────────────────────
function rowToDownload(row: any): Download {
  return {
    id: row.id,
    url: row.url,
    filename: row.filename,
    mimeType: row.mime_type ?? null,
    totalBytes: row.total_bytes ?? 0,
    receivedBytes: row.received_bytes ?? 0,
    formatId: row.format_id ?? null,
    state: row.state,
    error: row.error ?? null,
    savePath: row.save_path ?? null,
    createdAt: new Date(row.created_at),
    completedAt: row.completed_at ? new Date(row.completed_at) : null,
  };
}

function rowToSettings(row: any): Settings {
  let fileTypes: string[] = ["mp4", "mp3", "zip", "exe", "pdf", "jpg", "png"];
  try {
    fileTypes = JSON.parse(row.file_types);
  } catch {}
  return {
    id: row.id,
    theme: row.theme,
    maxConcurrentDownloads: row.max_concurrent_downloads,
    autoCapture: row.auto_capture === 1 || row.auto_capture === true,
    fileTypes,
    downloadPath: row.download_path,
  };
}

// ── Storage interface ─────────────────────────────────────────────────────────
export interface IStorage {
  getDownloads(): Promise<Download[]>;
  getDownload(id: number): Promise<Download | undefined>;
  createDownload(download: InsertDownload): Promise<Download>;
  updateDownload(id: number, updates: Partial<Download>): Promise<Download>;
  deleteDownload(id: number): Promise<void>;
  clearCompletedDownloads(): Promise<void>;
  getSettings(): Promise<Settings>;
  updateSettings(updates: Partial<InsertSettings>): Promise<Settings>;
}

// ── SQLiteStorage ─────────────────────────────────────────────────────────────
export class SQLiteStorage implements IStorage {
  async getDownloads(): Promise<Download[]> {
    const rows = db.prepare("SELECT * FROM downloads ORDER BY created_at ASC").all();
    return rows.map(rowToDownload);
  }

  async getDownload(id: number): Promise<Download | undefined> {
    const row = db.prepare("SELECT * FROM downloads WHERE id = ?").get(id);
    return row ? rowToDownload(row) : undefined;
  }

  async createDownload(insert: InsertDownload): Promise<Download> {
    const stmt = db.prepare(`
      INSERT INTO downloads (url, filename, mime_type, total_bytes, received_bytes, format_id, state, error, save_path)
      VALUES (@url, @filename, @mimeType, @totalBytes, @receivedBytes, @formatId, @state, @error, @savePath)
    `);
    const info = stmt.run({
      url: insert.url,
      filename: insert.filename,
      mimeType: insert.mimeType ?? null,
      totalBytes: insert.totalBytes ?? 0,
      receivedBytes: insert.receivedBytes ?? 0,
      formatId: insert.formatId ?? null,
      state: insert.state ?? "queued",
      error: insert.error ?? null,
      savePath: insert.savePath ?? null,
    });
    const row = db.prepare("SELECT * FROM downloads WHERE id = ?").get(info.lastInsertRowid);
    return rowToDownload(row);
  }

  async updateDownload(id: number, updates: Partial<Download>): Promise<Download> {
    const existing = db.prepare("SELECT * FROM downloads WHERE id = ?").get(id);
    if (!existing) throw new Error(`Download ${id} not found`);

    const fields: string[] = [];
    const values: Record<string, any> = { id };

    if (updates.url !== undefined)           { fields.push("url = @url");                       values.url = updates.url; }
    if (updates.filename !== undefined)      { fields.push("filename = @filename");              values.filename = updates.filename; }
    if (updates.mimeType !== undefined)      { fields.push("mime_type = @mimeType");             values.mimeType = updates.mimeType; }
    if (updates.totalBytes !== undefined)    { fields.push("total_bytes = @totalBytes");         values.totalBytes = updates.totalBytes; }
    if (updates.receivedBytes !== undefined) { fields.push("received_bytes = @receivedBytes");   values.receivedBytes = updates.receivedBytes; }
    if (updates.formatId !== undefined)      { fields.push("format_id = @formatId");             values.formatId = updates.formatId; }
    if (updates.state !== undefined)         { fields.push("state = @state");                    values.state = updates.state; }
    if (updates.error !== undefined)         { fields.push("error = @error");                    values.error = updates.error; }
    if (updates.savePath !== undefined)      { fields.push("save_path = @savePath");             values.savePath = updates.savePath; }
    if (updates.completedAt !== undefined)   { fields.push("completed_at = @completedAt");       values.completedAt = updates.completedAt ? updates.completedAt.toISOString() : null; }

    if (fields.length > 0) {
      db.prepare(`UPDATE downloads SET ${fields.join(", ")} WHERE id = @id`).run(values);
    }

    const row = db.prepare("SELECT * FROM downloads WHERE id = ?").get(id);
    return rowToDownload(row);
  }

  async deleteDownload(id: number): Promise<void> {
    db.prepare("DELETE FROM downloads WHERE id = ?").run(id);
  }

  async clearCompletedDownloads(): Promise<void> {
    db.prepare("DELETE FROM downloads WHERE state = 'completed'").run();
  }

  async getSettings(): Promise<Settings> {
    const row = db.prepare("SELECT * FROM settings WHERE id = 1").get();
    return rowToSettings(row);
  }

  async updateSettings(updates: Partial<InsertSettings>): Promise<Settings> {
    const fields: string[] = [];
    const values: Record<string, any> = {};

    if (updates.theme !== undefined)                    { fields.push("theme = @theme");                                       values.theme = updates.theme; }
    if (updates.maxConcurrentDownloads !== undefined)   { fields.push("max_concurrent_downloads = @maxConcurrentDownloads");   values.maxConcurrentDownloads = updates.maxConcurrentDownloads; }
    if (updates.autoCapture !== undefined)              { fields.push("auto_capture = @autoCapture");                          values.autoCapture = updates.autoCapture ? 1 : 0; }
    if (updates.fileTypes !== undefined)                { fields.push("file_types = @fileTypes");                              values.fileTypes = JSON.stringify(updates.fileTypes); }
    if (updates.downloadPath !== undefined)             { fields.push("download_path = @downloadPath");                        values.downloadPath = updates.downloadPath; }

    if (fields.length > 0) {
      db.prepare(`UPDATE settings SET ${fields.join(", ")} WHERE id = 1`).run(values);
    }

    const row = db.prepare("SELECT * FROM settings WHERE id = 1").get();
    return rowToSettings(row);
  }
}

export const storage = new SQLiteStorage();

import { db } from "./db";
import {
  downloads,
  settings,
  type Download,
  type InsertDownload,
  type Settings,
  type InsertSettings,
} from "@shared/schema";
import { eq } from "drizzle-orm";

export interface IStorage {
  // Downloads
  getDownloads(): Promise<Download[]>;
  getDownload(id: number): Promise<Download | undefined>;
  createDownload(download: InsertDownload): Promise<Download>;
  updateDownload(id: number, updates: Partial<InsertDownload>): Promise<Download>;
  deleteDownload(id: number): Promise<void>;
  clearCompletedDownloads(): Promise<void>;

  // Settings
  getSettings(): Promise<Settings>;
  updateSettings(updates: Partial<InsertSettings>): Promise<Settings>;
}

export class DatabaseStorage implements IStorage {
  async getDownloads(): Promise<Download[]> {
    return await db.select().from(downloads).orderBy(downloads.createdAt);
  }

  async getDownload(id: number): Promise<Download | undefined> {
    const [download] = await db.select().from(downloads).where(eq(downloads.id, id));
    return download;
  }

  async createDownload(insertDownload: InsertDownload): Promise<Download> {
    const [download] = await db.insert(downloads).values(insertDownload).returning();
    return download;
  }

  async updateDownload(id: number, updates: Partial<InsertDownload>): Promise<Download> {
    const [download] = await db
      .update(downloads)
      .set(updates)
      .where(eq(downloads.id, id))
      .returning();
    return download;
  }

  async deleteDownload(id: number): Promise<void> {
    await db.delete(downloads).where(eq(downloads.id, id));
  }

  async clearCompletedDownloads(): Promise<void> {
    await db.delete(downloads).where(eq(downloads.state, "completed"));
  }

  async getSettings(): Promise<Settings> {
    const [existing] = await db.select().from(settings).limit(1);
    if (existing) return existing;
    
    // Create default settings if none exist
    const [created] = await db.insert(settings).values({}).returning();
    return created;
  }

  async updateSettings(updates: Partial<InsertSettings>): Promise<Settings> {
    const current = await this.getSettings();
    const [updated] = await db
      .update(settings)
      .set(updates)
      .where(eq(settings.id, current.id))
      .returning();
    return updated;
  }
}

export const storage = new DatabaseStorage();

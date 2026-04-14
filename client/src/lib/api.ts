/**
 * Unified API layer — works in both Electron (desktop) and browser (web).
 *
 * Desktop: Routes through window.electronAPI IPC to the Electron main process
 *          (yt-dlp, streamlink, gallery-dl, etc.).
 *
 * Web:     All sites → server yt-dlp endpoint (rich metadata, full quality)
 */

import { isElectron } from './utils/env';

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  meta?: Record<string, unknown>;
}

// ── Main API ──────────────────────────────────────────────────────────────

export const api = {
  // ── Video info ──────────────────────────────────────────────────────────
  fetchVideoInfo: async (url: string): Promise<ApiResponse> => {
    if (isElectron()) {
      return await window.electronAPI.fetchVideoInfo(url);
    }

    // WEB MODE: Server yt-dlp endpoint for all sites
    const response = await fetch(`/api/video-info?url=${encodeURIComponent(url)}`);
    return response.json();
  },

  // ── Download ────────────────────────────────────────────────────────────
  startDownload: async (data: {
    url: string;
    filename: string;
    formatId?: string;
    savePath?: string;
    thumbnail?: string;
    duration?: number;
    uploader?: string;
  }): Promise<{ success: boolean; id?: number }> => {
    if (isElectron()) {
      const result = await window.electronAPI.startDownload(data);
      return { success: true, ...result };
    }

    // WEB MODE: Server yt-dlp stream endpoint for all sites
    const query = new URLSearchParams({
      url: data.url,
      formatId: data.formatId || 'bestvideo+bestaudio',
      filename: data.filename,
    }).toString();
    window.location.href = `/api/download?${query}`;
    return { success: true };
  },

  // ── Settings ────────────────────────────────────────────────────────────
  getSettings: async (): Promise<Record<string, unknown>> => {
    if (isElectron()) {
      if (!window.electronAPI.getSettings) return {};
      return await window.electronAPI.getSettings();
    }
    return JSON.parse(localStorage.getItem('web-settings') || '{}');
  },

  saveSettings: async (settings: Record<string, unknown>): Promise<{ success: boolean }> => {
    if (isElectron()) {
      return await window.electronAPI.saveSettings(settings);
    }
    localStorage.setItem('web-settings', JSON.stringify(settings));
    return { success: true };
  },

  // ── History ─────────────────────────────────────────────────────────────
  getDownloadHistory: async (): Promise<unknown[]> => {
    if (isElectron()) {
      return await window.electronAPI.getDownloadHistory();
    }
    return [];
  },

  // ── External links ──────────────────────────────────────────────────────
  openExternal: (url: string) => {
    if (isElectron()) {
      window.electronAPI.openExternal(url);
    } else {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  },
};

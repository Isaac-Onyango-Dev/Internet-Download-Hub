/**
 * Unified API layer — works in both Electron (desktop) and browser (web).
 *
 * Desktop: Routes through window.electronAPI IPC to the Electron main process
 *          (yt-dlp, streamlink, gallery-dl, etc.).
 *
 * Web:     Falls back to the Express server endpoints on the same host
 *          (POST /api/cobalt proxy or GET /api/video-info via yt-dlp).
 */

import { isElectron } from './utils/env';

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  meta?: Record<string, unknown>;
}

export const api = {
  // ── Video info ──────────────────────────────────────────────────────────
  fetchVideoInfo: async (url: string): Promise<ApiResponse> => {
    if (isElectron()) {
      return await window.electronAPI.fetchVideoInfo(url);
    }
    // Web: server runs yt-dlp -J to extract metadata
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
    // Web: redirect to server stream endpoint (yt-dlp pipes stdout to browser)
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
    // Web: localStorage
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
    return []; // Web version has no persistent history
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

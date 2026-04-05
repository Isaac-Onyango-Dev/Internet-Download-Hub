/* eslint-disable @typescript-eslint/no-explicit-any */
import { isElectron } from './utils/env';

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export const api = {
  fetchVideoInfo: async (url: string): Promise<any> => {
    if (isElectron()) {
      return await window.electronAPI.fetchVideoInfo(url);
    }
    const response = await fetch(`/api/video-info?url=${encodeURIComponent(url)}`);
    return await response.json();
  },

  startDownload: async (data: any): Promise<any> => {
    if (isElectron()) {
      return await window.electronAPI.startDownload(data);
    }
    // Web path: Trigger browser download via stream
    const query = new URLSearchParams({
      url: data.url,
      formatId: data.formatId || 'bestvideo+bestaudio',
      filename: data.filename
    }).toString();
    window.location.href = `/api/download?${query}`;
    return { success: true };
  },

  getSettings: async (): Promise<any> => {
    if (isElectron()) {
      if (!window.electronAPI.getSettings) return {};
      return await window.electronAPI.getSettings();
    }
    // Web version currently doesn't have persistent settings
    return JSON.parse(localStorage.getItem('web-settings') || '{}');
  },

  saveSettings: async (settings: any): Promise<any> => {
    if (isElectron()) {
      return await window.electronAPI.saveSettings(settings);
    }
    localStorage.setItem('web-settings', JSON.stringify(settings));
    return { success: true };
  },

  getDownloadHistory: async (): Promise<any[]> => {
    if (isElectron()) {
      return await window.electronAPI.getDownloadHistory();
    }
    return []; // Web version is currently stateless
  },

  // Fallback for generic IPC calls that don't have a web equivalent
  openExternal: (url: string) => {
    if (isElectron()) {
      window.electronAPI.openExternal(url);
    } else {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }
};

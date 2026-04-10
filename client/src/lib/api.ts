/**
 * Unified API layer — works in both Electron (desktop) and browser (web).
 *
 * Desktop: Routes through window.electronAPI IPC to the Electron main process
 *          (yt-dlp, streamlink, gallery-dl, etc.).
 *
 * Web:     Smart per-site routing:
 *          - YouTube/YouTube Music → Cobalt API (bypasses YouTube bot detection)
 *          - All other sites       → server yt-dlp endpoint (rich metadata)
 */

import { isElectron } from './utils/env';

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  meta?: Record<string, unknown>;
}

// ── YouTube URL detection ──────────────────────────────────────────────────

function isYouTubeUrl(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return (
      hostname === 'youtube.com' ||
      hostname === 'www.youtube.com' ||
      hostname === 'youtu.be' ||
      hostname === 'm.youtube.com' ||
      hostname === 'music.youtube.com'
    );
  } catch {
    return false;
  }
}

// ── Cobalt API helpers (for YouTube in web mode) ──────────────────────────

const COBALT_INSTANCES = [
  'https://cobalt-api.meowing.de',
  'https://api.cobalt.tools',
  'https://cobalt-backend.canine.tools',
];

/**
 * Try the server-side Cobalt proxy first, then fall back to direct instances.
 * The server proxy adds a proper User-Agent header and avoids CORS issues.
 */
async function cobaltFetch(url: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  let lastError: unknown = null;

  // Tier 1: Server proxy (avoids CORS, adds User-Agent)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    const resp = await fetch('/api/cobalt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (resp.ok) {
      const data = await resp.json();
      if ((data as Record<string, unknown>).status !== 'error') return data;
      lastError = new Error(`Cobalt error: ${(data as Record<string, unknown>).error ? JSON.stringify((data as Record<string, unknown>).error) : 'unknown'}`);
    } else {
      lastError = new Error(`Server proxy returned ${resp.status}`);
    }
  } catch (err: unknown) {
    lastError = err;
  }

  // Tier 2: Direct Cobalt instances
  for (const instance of COBALT_INSTANCES) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);
      const resp = await fetch(`${instance}/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!resp.ok) { lastError = new Error(`${instance} returned ${resp.status}`); continue; }
      const data = await resp.json();
      if ((data as Record<string, unknown>).status === 'error') {
        lastError = new Error(`Cobalt: ${(data as Record<string, unknown>).error ? JSON.stringify((data as Record<string, unknown>).error) : 'unknown'}`);
        continue;
      }
      return data;
    } catch (err: unknown) {
      lastError = err;
    }
  }

  throw lastError || new Error('All Cobalt instances failed');
}

/**
 * Extracts video metadata for YouTube via Cobalt API.
 * Cobalt handles YouTube's bot detection on their infrastructure,
 * so this works from any server IP without cookies.
 */
async function fetchYoutubeViaCobalt(url: string): Promise<ApiResponse> {
  const data = await cobaltFetch(url, { url });

  // Cobalt returns filename which we parse for metadata
  const filename = data.filename as string | undefined;
  const downloadUrl = data.url as string | undefined;

  // Derive title from filename (Cobalt doesn't return raw metadata like yt-dlp)
  const rawTitle = filename
    ? filename.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' ').trim()
    : 'YouTube Video';

  return {
    success: true,
    data: {
      url,
      title: rawTitle,
      thumbnail: '',
      duration: 0,
      uploader: '',
      formats: [
        { formatId: 'best-video', label: 'Best Video (1080p)', quality: '1080p', ext: 'mp4', filesize: null, height: 1080 },
        { formatId: 'best-720', label: 'Standard Quality (720p)', quality: '720p', ext: 'mp4', filesize: null, height: 720 },
        { formatId: 'best-480', label: '480p', quality: '480p', ext: 'mp4', filesize: null, height: 480 },
        { formatId: 'audio-only', label: 'Audio Only (MP3)', quality: 'audio', ext: 'mp3', filesize: null, height: null },
      ],
      _cobaltDownloadUrl: downloadUrl,
    },
    meta: { playlistDetected: false, detectPlaylistsEnabled: false, collapsedToSingle: false },
  };
}

// ── Main API ──────────────────────────────────────────────────────────────

export const api = {
  // ── Video info ──────────────────────────────────────────────────────────
  fetchVideoInfo: async (url: string): Promise<ApiResponse> => {
    if (isElectron()) {
      return await window.electronAPI.fetchVideoInfo(url);
    }

    // WEB MODE: Smart routing
    // YouTube → Cobalt API (bypasses bot detection on datacenter IPs)
    // Everything else → server yt-dlp endpoint (rich metadata)
    if (isYouTubeUrl(url)) {
      return fetchYoutubeViaCobalt(url);
    }

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

    // WEB MODE: Smart routing for downloads too
    // YouTube → Cobalt API (bypasses bot detection)
    // Everything else → server yt-dlp stream endpoint
    if (isYouTubeUrl(data.url)) {
      const isAudioOnly = data.formatId === 'audio-only' || data.formatId === 'bestaudio';

      const respData = await cobaltFetch(data.url, {
        url: data.url,
        videoQuality: isAudioOnly ? '720' : '1080',
        downloadMode: isAudioOnly ? 'audio' : 'auto',
        audioFormat: isAudioOnly ? 'mp3' : undefined,
      });

      const downloadUrl = respData.url as string
        || (respData.picker as Array<{ url: string }> | undefined)?.[0]?.url;

      if (!downloadUrl) throw new Error('Cobalt did not return a download URL.');

      // Trigger browser download
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = data.filename;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { if (a.parentNode) a.parentNode.removeChild(a); }, 1000);

      return { success: true, id: Date.now() };
    }

    // Non-YouTube: server stream endpoint
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

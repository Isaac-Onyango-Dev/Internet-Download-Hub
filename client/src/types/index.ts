export interface Download {
  id: number;
  jobId: string;
  filename: string;
  url: string;
  format?: string;
  quality?: string;
  status: 'queued' | 'downloading' | 'completed' | 'failed' | 'paused' | 'cancelled';
  phase: string;
  percent: number;
  speed?: string;
  eta?: string;
  error?: string;
  savePath: string;
  createdAt: Date;
  completedAt?: Date;
  totalBytes?: number;
  receivedBytes?: number;
}

export interface VideoInfo {
  id: string;
  title: string;
  description?: string;
  duration?: number;
  uploader?: string;
  uploadDate?: string;
  thumbnail?: string;
  formats?: VideoFormat[];
  extractedUrl?: string;
  isPlaylist?: boolean;
  playlistTitle?: string;
  playlistVideos?: VideoInfo[];
}

export interface VideoFormat {
  formatId: string;
  ext: string;
  resolution?: string;
  fps?: number;
  filesize?: number;
  tbr?: number;
  vbr?: number;
  abr?: number;
  acodec?: string;
  vcodec?: string;
  container?: string;
  quality?: string;
  formatNote?: string;
}

export interface Settings {
  downloadPath: string;
  maxConcurrentDownloads: number;
  defaultQuality: string;
  defaultFormat: string;
  theme: 'light' | 'dark' | 'system';
  detectPlaylists: boolean;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

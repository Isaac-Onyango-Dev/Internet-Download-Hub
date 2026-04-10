import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface DetectedVideoFormat {
  formatId: string;
  ext: string;
  label: string;
  quality: string;
  filesize: number | null;
  height: number | null;
}

export interface DetectedVideo {
  url: string;
  title: string;
  thumbnail?: string;
  duration?: number;
  uploader?: string;
  formats: DetectedVideoFormat[];
  extractionMethod?: string;
}

export interface PlaylistData {
  isPlaylist: true;
  videos: DetectedVideo[];
}

export interface VideoDetectMeta {
  playlistDetected?: boolean;
  detectPlaylistsEnabled?: boolean;
  collapsedToSingle?: boolean;
  playlistTitle?: string;
  playlistVideoCount?: number;
}

export interface VideoDetectResponse {
  data: DetectedVideo | PlaylistData;
  meta?: VideoDetectMeta;
}

export function useVideoDetect() {
  return useMutation<VideoDetectResponse, Error, string>({
    mutationFn: async (url: string) => {
      const result = await api.fetchVideoInfo(url);
      if (!result.success) {
        throw new Error(result.error || 'Could not fetch video information.');
      }
      if (!result.data) {
        throw new Error('No video information was returned.');
      }
      return { data: result.data as DetectedVideo | PlaylistData, meta: result.meta as VideoDetectMeta | undefined };
    },
  });
}

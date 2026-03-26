import { useMutation } from "@tanstack/react-query";

export interface DetectedVideoFormat {
    formatId: string;
    ext: string;
    resolution: string;
    filesize: number;
    vcodec: string;
    acodec: string;
}

export interface DetectedVideo {
    url: string;
    title: string;
    mimeType: string;
    sourceType: "yt-dlp";
    thumbnail?: string;
    duration?: number;
    uploader?: string;
    description?: string;
    formats: DetectedVideoFormat[];
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
            if (!window.electronAPI) {
                throw new Error("Electron API not available");
            }
            const result = await window.electronAPI.fetchVideoInfo(url);
            if (!result.success) {
                throw new Error(result.error || "Could not fetch video information.");
            }
            if (!result.data) {
                throw new Error("No video information was returned.");
            }
            return { data: result.data, meta: (result as any).meta };
        },
    });
}

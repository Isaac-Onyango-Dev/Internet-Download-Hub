import { useMutation } from "@tanstack/react-query";
import { api } from "@shared/routes";

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

export function useVideoDetect() {
    return useMutation<DetectedVideo[], Error, string>({
        mutationFn: async (url: string) => {
            const res = await fetch(api.downloads.fetchInfo.path, {
                method: api.downloads.fetchInfo.method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url }),
                credentials: "include",
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({ message: "Detection failed" }));
                throw new Error(err.message ?? "Detection failed");
            }
            const data = await res.json();
            // The endpoint returns a single video object, but the component expects an array or we wrap it
            return Array.isArray(data) ? data : [data];
        },
    });
}

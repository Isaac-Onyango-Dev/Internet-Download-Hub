import { useEffect, useState } from "react";

export interface ProgressData {
  downloadId: number;
  jobId?: number;
  totalBytes: number;
  receivedBytes: number;
  percent: number;
  speed?: string;
  eta?: string;
  state?: string;
  phase?: string;
  status?: string;
  totalSize?: string;
}

export function useDownloadProgress() {
  const [progressMap, setProgressMap] = useState<Record<number, ProgressData>>({});

  useEffect(() => {
    if (!window.electronAPI) return;

    // Remove any existing listeners first to prevent duplicates
    if (window.electronAPI.removeProgressListener) {
      window.electronAPI.removeProgressListener();
    }

    window.electronAPI.onDownloadProgress((data: any) => {
      const key = data.id ?? data.downloadId;
      setProgressMap((prev) => {
        // Remove completed / error / cancelled from live map
        if (data.state === 'completed' || data.state === 'error' || data.state === 'cancelled') {
          const next = { ...prev };
          delete next[key];
          return next;
        }
        return {
          ...prev,
          [key]: {
            ...data,
            downloadId: key,
          },
        };
      });
    });

    return () => {
      if (window.electronAPI?.removeProgressListener) {
        window.electronAPI.removeProgressListener();
      }
    };
  }, []);

  return progressMap;
}

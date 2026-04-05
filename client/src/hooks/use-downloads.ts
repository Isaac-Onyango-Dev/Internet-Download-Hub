import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { isElectron } from '@/lib/utils/env';

const DOWNLOADS_KEY = ['/api/downloads'];

// ============================================
// DOWNLOADS HOOKS
// ============================================

export function useDownloads() {
  return useQuery({
    queryKey: DOWNLOADS_KEY,
    queryFn: async () => {
      if (!isElectron()) return []; // Web version is currently stateless
      const downloads = await window.electronAPI.getDownloadHistory();
      return downloads.map((dl: any) => ({
        ...dl,
        mimeType: dl.mime_type,
        duration: dl.duration,
        uploader: dl.uploader,
        totalBytes: dl.total_bytes,
        receivedBytes: dl.received_bytes,
        formatId: dl.format_id,
        savePath: dl.save_path,
        thumbnail: dl.thumbnail,
        createdAt: new Date(dl.created_at),
        completedAt: dl.completed_at ? new Date(dl.completed_at) : null,
      }));
    },
    refetchInterval: isElectron() ? 2000 : false,
  });
}

export function useCreateDownload() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      url: string;
      filename: string;
      formatId?: string;
      savePath?: string;
      thumbnail?: string;
    }) => {
      // 1. Electron Path
      if (isElectron()) {
        return await window.electronAPI.startDownload(data);
      }

      // 2. Web Path: Trigger browser download via stream
      const query = new URLSearchParams({
        url: data.url,
        formatId: data.formatId || 'bestvideo+bestaudio',
        filename: data.filename
      }).toString();
      
      // In a real web app, we redirect to the download endpoint which returns an attachment
      window.location.href = `/api/download?${query}`;
      return { success: true };
    },
    onSuccess: () => {
      if (isElectron()) {
        queryClient.invalidateQueries({ queryKey: DOWNLOADS_KEY });
      }
    },
  });
}

export function useDeleteDownload() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      if (!isElectron()) return;
      return await window.electronAPI.deleteDownload(id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: DOWNLOADS_KEY }),
  });
}

export function useCancelDownload() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      if (!isElectron()) return;
      return await window.electronAPI.cancelDownload(id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: DOWNLOADS_KEY }),
  });
}

export function useRestartDownload() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      if (!isElectron()) return;
      return await window.electronAPI.restartDownload(id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: DOWNLOADS_KEY }),
  });
}

export function usePauseDownload() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      if (!isElectron()) return;
      return await window.electronAPI.pauseDownload(id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: DOWNLOADS_KEY }),
  });
}

export function useResumeDownload() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      if (!isElectron()) return;
      return await window.electronAPI.resumeDownload(id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: DOWNLOADS_KEY }),
  });
}

export function useClearCompletedDownloads() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (type: 'all' | 'completed' | 'failed' = 'all') => {
      if (!isElectron()) return;
      await window.electronAPI.clearHistory(type);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: DOWNLOADS_KEY }),
  });
}

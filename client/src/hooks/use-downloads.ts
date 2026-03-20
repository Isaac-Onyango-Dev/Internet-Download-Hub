import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const DOWNLOADS_KEY = ["/api/downloads"];

// ============================================
// DOWNLOADS HOOKS
// ============================================

export function useDownloads() {
  return useQuery({
    queryKey: DOWNLOADS_KEY,
    queryFn: async () => {
      if (!window.electronAPI) return [];
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
    refetchInterval: 2000,
  });
}

export function useCreateDownload() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { url: string; filename: string; formatId?: string; savePath?: string; thumbnail?: string }) => {
      if (!window.electronAPI) throw new Error("Electron API not available");
      return await window.electronAPI.startDownload(data);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: DOWNLOADS_KEY }),
  });
}

export function useDeleteDownload() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      if (!window.electronAPI) throw new Error("Electron API not available");
      return await window.electronAPI.deleteDownload(id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: DOWNLOADS_KEY }),
  });
}

export function useCancelDownload() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      if (!window.electronAPI) throw new Error("Electron API not available");
      return await window.electronAPI.cancelDownload(id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: DOWNLOADS_KEY }),
  });
}

export function useRestartDownload() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      if (!window.electronAPI) throw new Error("Electron API not available");
      return await window.electronAPI.restartDownload(id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: DOWNLOADS_KEY }),
  });
}

export function usePauseDownload() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      if (!window.electronAPI) throw new Error("Electron API not available");
      return await window.electronAPI.pauseDownload(id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: DOWNLOADS_KEY }),
  });
}

export function useResumeDownload() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      if (!window.electronAPI) throw new Error("Electron API not available");
      return await window.electronAPI.resumeDownload(id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: DOWNLOADS_KEY }),
  });
}

export function useClearCompletedDownloads() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!window.electronAPI) return;
      await window.electronAPI.clearHistory();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: DOWNLOADS_KEY }),
  });
}

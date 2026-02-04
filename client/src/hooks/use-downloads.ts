import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl, type CreateDownloadRequest, type UpdateDownloadRequest } from "@shared/routes";

// ============================================
// DOWNLOADS HOOKS
// ============================================

export function useDownloads(state?: string) {
  return useQuery({
    queryKey: [api.downloads.list.path, state],
    queryFn: async () => {
      const url = state 
        ? buildUrl(api.downloads.list.path) + `?state=${state}`
        : api.downloads.list.path;
      
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error('Failed to fetch downloads');
      return api.downloads.list.responses[200].parse(await res.json());
    },
    // Poll more frequently for downloads to simulate real-time updates
    refetchInterval: 1000, 
  });
}

export function useCreateDownload() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateDownloadRequest) => {
      const validated = api.downloads.create.input.parse(data);
      const res = await fetch(api.downloads.create.path, {
        method: api.downloads.create.method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validated),
        credentials: "include",
      });
      if (!res.ok) {
        if (res.status === 400) {
          const error = api.downloads.create.responses[400].parse(await res.json());
          throw new Error(error.message);
        }
        throw new Error('Failed to create download');
      }
      return api.downloads.create.responses[201].parse(await res.json());
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.downloads.list.path] }),
  });
}

export function useUpdateDownload() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: number } & UpdateDownloadRequest) => {
      const validated = api.downloads.update.input.parse(updates);
      const url = buildUrl(api.downloads.update.path, { id });
      const res = await fetch(url, {
        method: api.downloads.update.method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validated),
        credentials: "include",
      });
      if (!res.ok) throw new Error('Failed to update download');
      return api.downloads.update.responses[200].parse(await res.json());
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.downloads.list.path] }),
  });
}

export function useDeleteDownload() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.downloads.delete.path, { id });
      const res = await fetch(url, { method: api.downloads.delete.method, credentials: "include" });
      if (!res.ok) throw new Error('Failed to delete download');
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.downloads.list.path] }),
  });
}

export function useClearCompletedDownloads() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch(api.downloads.clearCompleted.path, {
        method: api.downloads.clearCompleted.method,
        credentials: "include"
      });
      if (!res.ok) throw new Error('Failed to clear downloads');
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.downloads.list.path] }),
  });
}

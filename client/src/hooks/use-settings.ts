import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export type UpdateSettingsRequest = {
  theme?: "light" | "dark" | "system";
  maxConcurrentDownloads?: number;
  autoCapture?: boolean;
  fileTypes?: string[];
  downloadPath?: string;
};

const SETTINGS_KEY = ["/api/settings"];

// ============================================
// SETTINGS HOOKS
// ============================================

export function useSettings() {
  return useQuery({
    queryKey: SETTINGS_KEY,
    queryFn: async () => {
      if (!window.electronAPI) return null;
      return await window.electronAPI.getSettings();
    },
  });
}

export function useUpdateSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (updates: UpdateSettingsRequest) => {
      if (!window.electronAPI) throw new Error("Electron API not available");
      return await window.electronAPI.saveSettings(updates);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SETTINGS_KEY }),
  });
}

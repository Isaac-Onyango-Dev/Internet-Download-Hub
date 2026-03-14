import { useEffect, useState } from "react";

export interface ProgressData {
  downloadId: number;
  totalBytes: number;
  receivedBytes: number;
  percent: number;
  speed?: string;
  eta?: string;
  state?: string;
}

export function useDownloadProgress() {
  const [progressMap, setProgressMap] = useState<Record<number, ProgressData>>({});

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    // Vite proxy handles the routing from 5173 to 5005 automatically
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    let socket: WebSocket | null = null;
    let reconnectTimeout: any = null;

    function connect() {
      socket = new WebSocket(wsUrl);

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "download_progress") {
            setProgressMap((prev) => ({
              ...prev,
              [data.downloadId]: data
            }));
          }
        } catch (err) {
          console.error("Failed to parse WS message", err);
        }
      };

      socket.onclose = () => {
        reconnectTimeout = setTimeout(connect, 3000);
      };

      socket.onerror = (err) => {
        console.error("WebSocket error", err);
        socket?.close();
      };
    }

    connect();

    return () => {
      if (socket) {
        socket.onclose = null;
        socket.close();
      }
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, []);

  return progressMap;
}

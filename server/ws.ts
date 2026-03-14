import { WebSocketServer, WebSocket } from "ws";
import { Server } from "http";

let wss: WebSocketServer | null = null;
const clients: Set<WebSocket> = new Set();

export function setupWebSockets(server: Server) {
  wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws) => {
    clients.add(ws);

    ws.on("close", () => {
      clients.delete(ws);
    });
    
    ws.on("error", (err) => {
      console.error("WebSocket error:", err);
      clients.delete(ws);
    });
  });

  return wss;
}

export function broadcastProgress(downloadId: number, data: {
  totalBytes: number;
  receivedBytes: number;
  percent: number;
  speed?: string;
  eta?: string;
  state?: string;
}) {
  const payload = JSON.stringify({
    type: "download_progress",
    downloadId,
    ...data
  });

  // Use Array.from for older TS targets or set iteration configurations
  Array.from(clients).forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}

import { WebSocketServer } from "ws";
import { port } from "./config.js";

const wsClients = new Map();

function setupWebSocket(server) {
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws, req) => {
    const url = new URL(req.url, `http://localhost:${port}`);
    const userId = Number(url.searchParams.get("userId"));
    if (!userId) return ws.close();

    if (!wsClients.has(userId)) wsClients.set(userId, new Set());
    wsClients.get(userId).add(ws);

    ws.on("close", () => {
      const clients = wsClients.get(userId);
      if (clients) {
        clients.delete(ws);
        if (clients.size === 0) wsClients.delete(userId);
      }
    });
  });
}

function notifyUser(userId, type) {
  const clients = wsClients.get(userId);
  if (clients) {
    const msg = JSON.stringify({ type });
    for (const ws of clients) ws.send(msg);
  }
}

export { setupWebSocket, notifyUser };

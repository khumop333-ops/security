/**
 * WebSocket hub — pushes live alert/status events to every connected client
 * (mobile app screens and the dispatch dashboard).
 *
 * Clients that cannot keep a WebSocket open (e.g. restrictive proxies) fall
 * back to polling the REST API; see client/src/lib/live.js.
 */
import { WebSocketServer } from 'ws';

const clients = new Set();
let wss = null;

/** Attach the hub to the HTTP server on path /ws. */
export function attachWs(server) {
  wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (socket) => {
    clients.add(socket);
    socket.isAlive = true;
    socket.on('pong', () => { socket.isAlive = true; });

    socket.on('close', () => clients.delete(socket));
    socket.on('error', () => clients.delete(socket));

    // Greet the client so it can confirm the connection is live.
    safeSend(socket, { type: 'hello', serverTime: new Date().toISOString() });
  });

  // Drop dead connections so the client can reconnect / fall back to polling.
  const heartbeat = setInterval(() => {
    for (const socket of clients) {
      if (!socket.isAlive) {
        clients.delete(socket);
        socket.terminate();
        continue;
      }
      socket.isAlive = false;
      socket.ping();
    }
  }, 30_000);
  wss.on('close', () => clearInterval(heartbeat));
}

function safeSend(socket, message) {
  try {
    if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(message));
  } catch {
    /* socket will be cleaned up on close */
  }
}

/** Broadcast a typed event (e.g. { type: 'alert.created', alert }) to all clients. */
export function broadcast(message) {
  for (const socket of clients) safeSend(socket, message);
}

export function clientCount() {
  return clients.size;
}

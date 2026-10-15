import { Request, Response } from 'express';
import { Dish } from './types.js';

interface SSEClient {
  id: string;
  res: Response;
}

const clients = new Map<string, SSEClient>();
let heartbeatTimer: NodeJS.Timeout | null = null;

/**
 * Initializes periodic heartbeat to prevent proxy and browser socket timeouts.
 */
function ensureHeartbeat(): void {
  if (heartbeatTimer) return;
  heartbeatTimer = setInterval(() => {
    for (const [id, client] of clients.entries()) {
      try {
        client.res.write(': heartbeat\n\n');
      } catch {
        clients.delete(id);
      }
    }
  }, 15000);
}

/**
 * Express route handler for Server-Sent Events (SSE).
 * Streams real-time dish update notifications to connected dashboard clients.
 */
export function sseHandler(req: Request, res: Response): void {
  const clientId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no', // Disable buffering for Nginx/reverse proxies
  });

  res.write(`data: ${JSON.stringify({ type: 'CONNECTED', clientId })}\n\n`);

  clients.set(clientId, { id: clientId, res });
  ensureHeartbeat();

  req.on('close', () => {
    clients.delete(clientId);
    if (clients.size === 0 && heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
  });
}

/**
 * Broadcasts an updated dish to all active SSE subscribers.
 */
export function broadcastDishUpdate(dish: Dish): void {
  const payload = JSON.stringify({
    type: 'DISH_UPDATED',
    dish,
    timestamp: new Date().toISOString(),
  });

  const deadClientIds: string[] = [];

  for (const [id, client] of clients.entries()) {
    try {
      client.res.write(`data: ${payload}\n\n`);
    } catch {
      deadClientIds.push(id);
    }
  }

  for (const id of deadClientIds) {
    clients.delete(id);
  }
}

/**
 * Helper to get count of connected clients (useful for monitoring and tests)
 */
export function getConnectedClientCount(): number {
  return clients.size;
}

/**
 * Cleanup function to close all connections and clear timers
 */
export function closeAllSSEConnections(): void {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
  for (const client of clients.values()) {
    try {
      client.res.end();
    } catch {
      // ignore
    }
  }
  clients.clear();
}

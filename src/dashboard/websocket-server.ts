/**
 * WebSocket Server for Real-Time Dashboard Updates
 *
 * Provides authenticated WebSocket connections for the dashboard
 */

import { WebSocket, WebSocketServer } from 'ws';
import { IncomingMessage } from 'http';
import { EventEmitter } from 'events';
import { validateToken } from './auth';

export interface WebSocketMessage {
  type: string;
  data?: any;
  timestamp?: number;
}

export interface AuthenticatedWebSocket extends WebSocket {
  isAuthenticated: boolean;
  clientId: string;
}

/**
 * Dashboard WebSocket Server
 */
export class DashboardWebSocketServer extends EventEmitter {
  private wss: WebSocketServer;
  private clients: Set<AuthenticatedWebSocket> = new Set();
  private port: number;

  constructor(port: number = 8788) {
    super();
    this.port = port;
    this.wss = new WebSocketServer({ port });
    this.setupServer();
  }

  /**
   * Setup WebSocket server
   */
  private setupServer(): void {
    this.wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
      const client = ws as AuthenticatedWebSocket;
      client.isAuthenticated = false;
      client.clientId = this.generateClientId();

      console.log(`[WebSocket] Client connected: ${client.clientId}`);

      // Handle incoming messages
      client.on('message', (data: Buffer) => {
        this.handleMessage(client, data);
      });

      // Handle disconnection
      client.on('close', () => {
        this.clients.delete(client);
        console.log(`[WebSocket] Client disconnected: ${client.clientId}`);
      });

      // Handle errors
      client.on('error', (error) => {
        console.error(`[WebSocket] Client error: ${client.clientId}:`, error);
      });

      // Send welcome message
      this.sendToClient(client, {
        type: 'CONNECTED',
        data: { clientId: client.clientId, requiresAuth: true },
      });
    });

    this.wss.on('listening', () => {
      console.log(`✅ WebSocket server started: ws://127.0.0.1:${this.port}`);
    });

    this.wss.on('error', (error) => {
      console.error('[WebSocket] Server error:', error);
    });
  }

  /**
   * Handle incoming WebSocket message
   */
  private handleMessage(client: AuthenticatedWebSocket, data: Buffer): void {
    try {
      const message: WebSocketMessage = JSON.parse(data.toString());

      // Handle authentication
      if (message.type === 'AUTH') {
        this.handleAuth(client, message.data?.token);
        return;
      }

      // Require authentication for all other messages
      if (!client.isAuthenticated) {
        this.sendToClient(client, {
          type: 'ERROR',
          data: { message: 'Authentication required' },
        });
        client.close(1008, 'Authentication required'); // Policy Violation
        return;
      }

      // Handle authenticated messages
      switch (message.type) {
        case 'PING':
          this.sendToClient(client, { type: 'PONG', timestamp: Date.now() });
          break;

        case 'SUBSCRIBE':
          // Client is subscribed by default when authenticated
          this.sendToClient(client, { type: 'SUBSCRIBED' });
          break;

        default:
          this.emit('message', { client, message });
      }
    } catch (error) {
      console.error('[WebSocket] Failed to parse message:', error);
      this.sendToClient(client, {
        type: 'ERROR',
        data: { message: 'Invalid message format' },
      });
    }
  }

  /**
   * Handle authentication
   */
  private handleAuth(client: AuthenticatedWebSocket, token: string): void {
    if (validateToken(token)) {
      client.isAuthenticated = true;
      this.clients.add(client);

      this.sendToClient(client, {
        type: 'AUTH_SUCCESS',
        data: { message: 'Authentication successful' },
      });

      console.log(`[WebSocket] Client authenticated: ${client.clientId}`);
    } else {
      this.sendToClient(client, {
        type: 'AUTH_FAILED',
        data: { message: 'Invalid token' },
      });

      // Close connection after failed auth
      setTimeout(() => {
        client.close(1008, 'Invalid token');
      }, 1000);

      console.log(`[WebSocket] Authentication failed: ${client.clientId}`);
    }
  }

  /**
   * Send message to specific client
   */
  private sendToClient(client: WebSocket, message: WebSocketMessage): void {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ ...message, timestamp: Date.now() }));
    }
  }

  /**
   * Broadcast message to all authenticated clients
   */
  broadcast(message: WebSocketMessage): void {
    const payload = JSON.stringify({ ...message, timestamp: Date.now() });

    this.clients.forEach((client) => {
      if (client.isAuthenticated && client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    });
  }

  /**
   * Broadcast agent update
   */
  broadcastAgentUpdate(agentId: string, data: any): void {
    this.broadcast({
      type: 'AGENT_UPDATE',
      data: { agentId, ...data },
    });
  }

  /**
   * Broadcast task update
   */
  broadcastTaskUpdate(taskId: string, data: any): void {
    this.broadcast({
      type: 'TASK_UPDATE',
      data: { taskId, ...data },
    });
  }

  /**
   * Broadcast config update
   */
  broadcastConfigUpdate(config: any): void {
    this.broadcast({
      type: 'CONFIG_UPDATE',
      data: config,
    });
  }

  /**
   * Get connection stats
   */
  getStats(): { total: number; authenticated: number } {
    return {
      total: this.wss.clients.size,
      authenticated: this.clients.size,
    };
  }

  /**
   * Generate unique client ID
   */
  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  /**
   * Close server
   */
  close(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Close all client connections
      this.clients.forEach((client) => {
        client.close(1001, 'Server shutting down');
      });

      // Close server
      this.wss.close((err) => {
        if (err) {
          reject(err);
        } else {
          console.log('[WebSocket] Server closed');
          resolve();
        }
      });
    });
  }
}

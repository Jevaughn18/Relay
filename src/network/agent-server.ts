/**
 * Agent HTTP Server
 *
 * HTTP server for receiving A2A Protocol messages
 */

import http from 'http';
import { parse } from 'url';
import { A2AMessage, A2AMessageType, A2AMessageBuilder } from './a2a-types';
import { RelayClient } from '../sdk/relay-client';
import { TaskContract } from '../schemas/contract';

export interface AgentServerConfig {
  port: number;
  host?: string;
  agentId: string;
  client: RelayClient;
}

export type MessageHandler = (message: A2AMessage) => Promise<A2AMessage | void>;

/**
 * HTTP server for agent communication
 */
export class AgentServer {
  private server: http.Server;
  private config: AgentServerConfig;
  private messageHandlers: Map<A2AMessageType, MessageHandler[]> = new Map();
  private isRunning: boolean = false;

  constructor(config: AgentServerConfig) {
    this.config = config;
    this.server = http.createServer(this.handleRequest.bind(this));
    this.registerDefaultHandlers();
  }

  /**
   * Register default message handlers
   */
  private registerDefaultHandlers(): void {
    // Ping handler
    this.on(A2AMessageType.PING, async (message) => {
      return A2AMessageBuilder.createMessage(
        this.config.agentId,
        message.from,
        A2AMessageType.PONG,
        { timestamp: new Date() }
      );
    });

    // Task request handler
    this.on(A2AMessageType.TASK_REQUEST, async (message) => {
      try {
        const contract = message.payload.contract as TaskContract;

        // Accept the contract
        const accepted = this.config.client.acceptContract(contract);

        return A2AMessageBuilder.createTaskAccept(
          this.config.agentId,
          message.from,
          contract.contractId,
          accepted.performerSignature!
        );
      } catch (error: any) {
        return A2AMessageBuilder.createError(
          this.config.agentId,
          message.from,
          'TASK_ACCEPT_ERROR',
          error.message,
          message.messageId
        );
      }
    });
  }

  /**
   * Register message handler
   */
  on(type: A2AMessageType, handler: MessageHandler): void {
    if (!this.messageHandlers.has(type)) {
      this.messageHandlers.set(type, []);
    }
    this.messageHandlers.get(type)!.push(handler);
  }

  /**
   * Handle incoming HTTP request
   */
  private async handleRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse
  ): Promise<void> {
    try {
      const parsedUrl = parse(req.url || '', true);
      const pathname = parsedUrl.pathname;

      // CORS headers
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      // Handle OPTIONS
      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }

      // Route handlers
      if (pathname === '/health' && req.method === 'GET') {
        this.handleHealth(req, res);
      } else if (pathname === '/manifest' && req.method === 'GET') {
        this.handleManifest(req, res);
      } else if (pathname === '/message' && req.method === 'POST') {
        await this.handleMessage(req, res);
      } else if (pathname === '/status' && req.method === 'GET') {
        await this.handleStatus(req, res);
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
      }
    } catch (error: any) {
      console.error('❌ Route handling error:', error);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
      }
      res.end(JSON.stringify({ error: error?.message || 'Internal server error' }));
    }
  }

  /**
   * Health check endpoint
   */
  private handleHealth(_req: http.IncomingMessage, res: http.ServerResponse): void {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'healthy', agentId: this.config.agentId }));
  }

  /**
   * Manifest endpoint
   */
  private handleManifest(_req: http.IncomingMessage, res: http.ServerResponse): void {
    const manifest = this.config.client.getManifest();

    if (!manifest) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'No manifest registered' }));
      return;
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(manifest));
  }

  /**
   * Status endpoint
   */
  private async handleStatus(_req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    try {
      const balance = await this.config.client.getBalanceSafe();
      const reputation = this.config.client.getReputation();
      const manifest = this.config.client.getManifest();

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          agentId: this.config.agentId,
          agentName: manifest?.agentName || 'Unknown',
          capabilities: manifest?.capabilities.map((c) => c.name) || [],
          balance: balance.available,
          reputation: reputation.overallScore,
          tier: reputation.tier,
          uptime: process.uptime(),
        })
      );
    } catch (error) {
      console.error('❌ Status endpoint error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to get agent status' }));
    }
  }

  /**
   * Message endpoint
   */
  private async handleMessage(
    req: http.IncomingMessage,
    res: http.ServerResponse
  ): Promise<void> {
    try {
      const body = await this.readBody(req);
      const message = JSON.parse(body) as A2AMessage;

      console.log(`📨 Received ${message.type} from ${message.from}`);

      // Get handlers for this message type
      const handlers = this.messageHandlers.get(message.type) || [];

      if (handlers.length === 0) {
        console.warn(`⚠️  No handler for message type: ${message.type}`);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            error: 'No handler for message type',
            type: message.type,
          })
        );
        return;
      }

      // Execute handlers
      let response: A2AMessage | void = undefined;
      for (const handler of handlers) {
        const handlerResponse = await handler(message);
        if (handlerResponse) {
          response = handlerResponse;
        }
      }

      // Send response
      if (response) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(response));
      } else {
        res.writeHead(202, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'accepted' }));
      }
    } catch (error: any) {
      console.error('❌ Message handling error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
  }

  /**
   * Read request body
   */
  private readBody(req: http.IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
      let body = '';
      req.on('data', (chunk) => (body += chunk.toString()));
      req.on('end', () => resolve(body));
      req.on('error', reject);
    });
  }

  /**
   * Start the server
   */
  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.server.listen(this.config.port, this.config.host || '127.0.0.1', () => {
        this.isRunning = true;
        const address = `http://${this.config.host || '127.0.0.1'}:${this.config.port}`;
        console.log(`✅ Agent server started: ${address}`);
        console.log(`   Agent ID: ${this.config.agentId}`);
        console.log(`   Endpoints:`);
        console.log(`     POST ${address}/message    - Receive A2A messages`);
        console.log(`     GET  ${address}/manifest   - Get capability manifest`);
        console.log(`     GET  ${address}/status     - Get agent status`);
        console.log(`     GET  ${address}/health     - Health check`);
        resolve();
      });
    });
  }

  /**
   * Stop the server
   */
  async stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.isRunning) {
        resolve();
        return;
      }

      this.server.close((err) => {
        if (err) {
          reject(err);
        } else {
          this.isRunning = false;
          console.log('🛑 Agent server stopped');
          resolve();
        }
      });
    });
  }

  /**
   * Get server URL
   */
  getURL(): string {
    return `http://${this.config.host || '127.0.0.1'}:${this.config.port}`;
  }

  /**
   * Check if server is running
   */
  running(): boolean {
    return this.isRunning;
  }
}

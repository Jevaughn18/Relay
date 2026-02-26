/**
 * A2A-Powered Relay Server
 *
 * Relay agent server using official A2A Protocol SDK
 */

import express from 'express';
import { AgentCard, AGENT_CARD_PATH } from '@a2a-js/sdk';
import {
  DefaultRequestHandler,
  InMemoryTaskStore,
  DefaultExecutionEventBusManager,
} from '@a2a-js/sdk/server';
import { agentCardHandler, restHandler, UserBuilder } from '@a2a-js/sdk/server/express';
import { RelayClient } from '../sdk/relay-client';
import { CapabilityManifest } from '../schemas/capability';
import { createAgentCard, createAgentExecutor } from './a2a-adapter';

export interface A2ARelayServerConfig {
  port: number;
  host?: string;
  relayClient: RelayClient;
  manifest: CapabilityManifest;
}

/**
 * Relay agent server powered by official A2A Protocol SDK
 */
export class A2ARelayServer {
  private app: express.Application;
  private config: A2ARelayServerConfig;
  private agentCard: AgentCard;
  private server: any;

  constructor(config: A2ARelayServerConfig) {
    this.config = config;
    this.app = express();

    // Create A2A Agent Card from Relay manifest
    const serverUrl = `http://${config.host || '127.0.0.1'}:${config.port}`;
    this.agentCard = createAgentCard(config.manifest, serverUrl);

    this.setupMiddleware();
    this.setupRoutes();
  }

  /**
   * Setup Express middleware
   */
  private setupMiddleware(): void {
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));

    // CORS
    this.app.use((_req, res, next) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-A2A-Extensions');
      next();
    });
  }

  /**
   * Setup A2A routes
   */
  private setupRoutes(): void {
    // Create agent executor
    const executor = createAgentExecutor(this.config.relayClient, this.config.manifest);

    // Create task store
    const taskStore = new InMemoryTaskStore();

    // Create event bus manager
    const eventBusManager = new DefaultExecutionEventBusManager();

    // Create request handler with correct parameter order: agentCard, taskStore, executor
    const requestHandler = new DefaultRequestHandler(
      this.agentCard,
      taskStore,
      executor,
      eventBusManager
    );

    // Agent Card endpoint (well-known path) - use requestHandler as provider
    this.app.get(
      `/${AGENT_CARD_PATH}`,
      agentCardHandler({
        agentCardProvider: requestHandler,
      })
    );

    // Compatibility endpoint
    this.app.get(
      '/agent-card',
      agentCardHandler({
        agentCardProvider: requestHandler,
      })
    );

    // Debug: Simple manual agent card endpoint
    this.app.get('/.well-known/agent-card.json', (_req, res) => {
      res.json(this.agentCard);
    });

    // JSON-RPC endpoint - manual implementation
    this.app.post('/a2a/jsonrpc', async (req, res) => {
      try {
        const rpcRequest = req.body;

        // Route to appropriate handler method
        switch (rpcRequest.method) {
          case 'message/send': {
            const result = await requestHandler.sendMessage(rpcRequest.params);
            res.json({
              jsonrpc: '2.0',
              id: rpcRequest.id,
              result,
            });
            break;
          }

          case 'task/get': {
            const result = await requestHandler.getTask(rpcRequest.params);
            res.json({
              jsonrpc: '2.0',
              id: rpcRequest.id,
              result: { task: result },
            });
            break;
          }

          case 'task/cancel': {
            const result = await requestHandler.cancelTask(rpcRequest.params);
            res.json({
              jsonrpc: '2.0',
              id: rpcRequest.id,
              result: { task: result },
            });
            break;
          }

          default:
            res.json({
              jsonrpc: '2.0',
              id: rpcRequest.id,
              error: {
                code: -32601,
                message: `Method not found: ${rpcRequest.method}`,
              },
            });
        }
      } catch (error: any) {
        res.status(500).json({
          jsonrpc: '2.0',
          id: req.body.id,
          error: {
            code: -32603,
            message: error.message,
          },
        });
      }
    });

    // REST endpoints - use options object
    const httpRestHandler = restHandler({
      requestHandler,
      userBuilder: UserBuilder.noAuthentication,
    });
    this.app.use('/a2a/rest', express.json(), httpRestHandler);

    // Relay-specific endpoints
    this.app.get('/relay/manifest', (_req, res) => {
      res.json(this.config.manifest);
    });

    this.app.get('/relay/status', (_req, res) => {
      const balance = this.config.relayClient.getBalance();
      const reputation = this.config.relayClient.getReputation();

      res.json({
        agentId: (this.config.relayClient as any).agentId,
        agentName: this.config.manifest.agentName,
        capabilities: this.config.manifest.capabilities.map((c) => c.name),
        balance: balance.available,
        reputation: reputation.overallScore,
        tier: reputation.tier,
        a2aProtocol: '0.3.0',
      });
    });

    // Health check
    this.app.get('/health', (_req, res) => {
      res.json({
        status: 'healthy',
        agentId: (this.config.relayClient as any).agentId,
        protocol: 'A2A/Relay',
      });
    });
  }

  /**
   * Start the server
   */
  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.server = this.app.listen(this.config.port, this.config.host || '127.0.0.1', () => {
        const address = `http://${this.config.host || '127.0.0.1'}:${this.config.port}`;
        console.log(`✅ A2A Relay Server started: ${address}`);
        console.log(`   Agent: ${this.agentCard.name}`);
        console.log(`   Protocol: A2A v${this.agentCard.protocolVersion}`);
        console.log(`   Capabilities: ${this.config.manifest.capabilities.map((c) => c.name).join(', ')}`);
        console.log(`   Endpoints:`);
        console.log(`     GET  ${address}/${AGENT_CARD_PATH} - Agent Card`);
        console.log(`     POST ${address}/a2a/jsonrpc       - JSON-RPC`);
        console.log(`     POST ${address}/a2a/rest          - REST API`);
        console.log(`     GET  ${address}/relay/manifest    - Relay Manifest`);
        console.log(`     GET  ${address}/relay/status      - Relay Status`);
        console.log(`     GET  ${address}/health            - Health Check`);
        resolve();
      });
    });
  }

  /**
   * Stop the server
   */
  async stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.server) {
        resolve();
        return;
      }

      this.server.close((err: any) => {
        if (err) {
          reject(err);
        } else {
          console.log('🛑 A2A Relay Server stopped');
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
   * Get Agent Card
   */
  getAgentCard(): AgentCard {
    return this.agentCard;
  }
}

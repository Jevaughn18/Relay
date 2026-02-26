/**
 * Agent Registry HTTP Server
 *
 * Central discovery service for agent registration and lookup
 */

import http from 'http';
import { parse } from 'url';
import { AgentRegistry, DiscoveryQuery } from './registry';
import { FederatedRegistry } from './federated-registry';
import { CapabilityManifest } from '../schemas/capability';

export interface RegistryServerConfig {
  port: number;
  host?: string;
  staleCheckInterval?: number; // minutes
  peers?: string[]; // Optional peer registries for federation
  federationSyncIntervalMs?: number;
  federationRequestTimeoutMs?: number;
}

/**
 * HTTP server for agent registry
 */
export class RegistryServer {
  private server: http.Server;
  private config: RegistryServerConfig;
  private registry: AgentRegistry;
  private federatedRegistry?: FederatedRegistry;
  private staleCheckTimer?: NodeJS.Timeout;

  constructor(config: RegistryServerConfig) {
    this.config = config;
    this.registry = new AgentRegistry();
    if (config.peers && config.peers.length > 0) {
      this.federatedRegistry = new FederatedRegistry(this.registry, {
        peers: config.peers,
        syncIntervalMs: config.federationSyncIntervalMs,
        requestTimeoutMs: config.federationRequestTimeoutMs,
        stalePeerMinutes: config.staleCheckInterval,
      });
    }
    this.server = http.createServer(this.handleRequest.bind(this));
  }

  /**
   * Handle incoming HTTP request
   */
  private async handleRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse
  ): Promise<void> {
    const parsedUrl = parse(req.url || '', true);
    const pathname = parsedUrl.pathname;

    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    // Routes
    if (pathname === '/register' && req.method === 'POST') {
      await this.handleRegister(req, res);
    } else if (pathname === '/unregister' && req.method === 'POST') {
      await this.handleUnregister(req, res);
    } else if (pathname === '/discover' && req.method === 'POST') {
      await this.handleDiscover(req, res);
    } else if (pathname === '/agents' && req.method === 'GET') {
      const scope = parsedUrl.query.scope === 'local' ? 'local' : 'all';
      this.handleGetAll(res, scope);
    } else if (pathname === '/heartbeat' && req.method === 'POST') {
      await this.handleHeartbeat(req, res);
    } else if (pathname === '/stats' && req.method === 'GET') {
      this.handleStats(res);
    } else if (pathname === '/sync' && req.method === 'POST') {
      await this.handleSync(res);
    } else if (pathname === '/peers' && req.method === 'GET') {
      this.handlePeers(res);
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
    }
  }

  /**
   * Register agent endpoint
   */
  private async handleRegister(
    req: http.IncomingMessage,
    res: http.ServerResponse
  ): Promise<void> {
    try {
      const body = await this.readBody(req);
      const data = JSON.parse(body) as {
        agentId: string;
        agentName: string;
        endpoint: string;
        manifest: CapabilityManifest;
      };

      this.registry.register(data.agentId, data.agentName, data.endpoint, data.manifest);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          success: true,
          message: 'Agent registered successfully',
          agentId: data.agentId,
        })
      );
    } catch (error: any) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
  }

  /**
   * Unregister agent endpoint
   */
  private async handleUnregister(
    req: http.IncomingMessage,
    res: http.ServerResponse
  ): Promise<void> {
    try {
      const body = await this.readBody(req);
      const { agentId } = JSON.parse(body);

      const success = this.registry.unregister(agentId);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success }));
    } catch (error: any) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
  }

  /**
   * Discover agents endpoint
   */
  private async handleDiscover(
    req: http.IncomingMessage,
    res: http.ServerResponse
  ): Promise<void> {
    try {
      const body = await this.readBody(req);
      const query = JSON.parse(body) as DiscoveryQuery;

      const agents = this.federatedRegistry
        ? this.federatedRegistry.discover(query)
        : this.registry.discover(query);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ agents, count: agents.length }));
    } catch (error: any) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
  }

  /**
   * Get all agents endpoint
   */
  private handleGetAll(res: http.ServerResponse, scope: 'all' | 'local'): void {
    const agents = this.federatedRegistry
      ? this.federatedRegistry.getAllAgents(scope)
      : this.registry.getAllAgents();
    const capabilities = this.registry.getAllCapabilities();

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        agents,
        capabilities,
        scope,
        totalAgents: agents.length,
        onlineAgents: this.registry.getOnlineCount(),
      })
    );
  }

  /**
   * Heartbeat endpoint
   */
  private async handleHeartbeat(
    req: http.IncomingMessage,
    res: http.ServerResponse
  ): Promise<void> {
    try {
      const body = await this.readBody(req);
      const { agentId } = JSON.parse(body);

      const success = this.registry.heartbeat(agentId);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success }));
    } catch (error: any) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
  }

  /**
   * Stats endpoint
   */
  private handleStats(res: http.ServerResponse): void {
    const peerHealth = this.federatedRegistry?.getPeerHealth() || [];
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        totalAgents: this.registry.getAgentCount(),
        onlineAgents: this.registry.getOnlineCount(),
        capabilities: this.registry.getAllCapabilities().length,
        federationEnabled: !!this.federatedRegistry,
        peersConfigured: peerHealth.length,
        healthyPeers: peerHealth.filter((peer) => peer.healthy).length,
        uptime: process.uptime(),
      })
    );
  }

  /**
   * Force peer synchronization endpoint
   */
  private async handleSync(res: http.ServerResponse): Promise<void> {
    if (!this.federatedRegistry) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Federation is not enabled on this registry' }));
      return;
    }

    await this.federatedRegistry.syncWithPeers();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        success: true,
        peers: this.federatedRegistry.getPeerHealth(),
      })
    );
  }

  /**
   * Peer health endpoint
   */
  private handlePeers(res: http.ServerResponse): void {
    if (!this.federatedRegistry) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ peers: [], federationEnabled: false }));
      return;
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        federationEnabled: true,
        peers: this.federatedRegistry.getPeerHealth(),
      })
    );
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
   * Start the registry server
   */
  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.server.listen(this.config.port, this.config.host || '127.0.0.1', () => {
        const address = `http://${this.config.host || '127.0.0.1'}:${this.config.port}`;
        console.log(`✅ Registry server started: ${address}`);
        console.log(`   Endpoints:`);
        console.log(`     POST ${address}/register    - Register agent`);
        console.log(`     POST ${address}/unregister  - Unregister agent`);
        console.log(`     POST ${address}/discover    - Discover agents`);
        console.log(`     GET  ${address}/agents      - List all agents`);
        console.log(`     POST ${address}/heartbeat   - Agent heartbeat`);
        console.log(`     GET  ${address}/stats       - Registry stats`);
        if (this.federatedRegistry) {
          console.log(`     POST ${address}/sync        - Sync with peer registries`);
          console.log(`     GET  ${address}/peers       - Peer health status`);
          this.federatedRegistry.start();
          void this.federatedRegistry.syncWithPeers();
          console.log(`   Federation enabled with ${this.config.peers?.length || 0} peers`);
        }

        // Start stale check timer
        const interval = (this.config.staleCheckInterval || 5) * 60 * 1000;
        this.staleCheckTimer = setInterval(() => {
          const cleaned = this.registry.cleanStale();
          if (cleaned > 0) {
            console.log(`🧹 Cleaned ${cleaned} stale agents`);
          }
        }, interval);

        resolve();
      });
    });
  }

  /**
   * Stop the registry server
   */
  async stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.staleCheckTimer) {
        clearInterval(this.staleCheckTimer);
      }
      if (this.federatedRegistry) {
        this.federatedRegistry.stop();
      }

      this.server.close((err) => {
        if (err) {
          reject(err);
        } else {
          console.log('🛑 Registry server stopped');
          resolve();
        }
      });
    });
  }

  /**
   * Get registry instance
   */
  getRegistry(): AgentRegistry {
    return this.registry;
  }
}

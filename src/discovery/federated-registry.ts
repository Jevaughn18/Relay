/**
 * Federated discovery registry.
 *
 * Maintains local registrations plus synchronized peer snapshots.
 */

import { AgentRegistry, DiscoveryQuery, RegisteredAgent } from './registry';

export interface FederatedRegistryConfig {
  peers: string[];
  syncIntervalMs?: number;
  requestTimeoutMs?: number;
  stalePeerMinutes?: number;
}

export interface PeerHealth {
  peer: string;
  healthy: boolean;
  lastSyncAt?: Date;
  lastError?: string;
  latencyMs?: number;
  remoteAgentCount?: number;
}

interface PeerSnapshot {
  agents: RegisteredAgent[];
  syncedAt: Date;
}

export class FederatedRegistry {
  private localRegistry: AgentRegistry;
  private peerHealth: Map<string, PeerHealth> = new Map();
  private peerSnapshots: Map<string, PeerSnapshot> = new Map();
  private syncTimer?: NodeJS.Timeout;
  private readonly syncIntervalMs: number;
  private readonly requestTimeoutMs: number;
  private readonly stalePeerMinutes: number;

  constructor(
    localRegistry: AgentRegistry,
    private config: FederatedRegistryConfig
  ) {
    this.localRegistry = localRegistry;
    this.syncIntervalMs = config.syncIntervalMs || 30000;
    this.requestTimeoutMs = config.requestTimeoutMs || 5000;
    this.stalePeerMinutes = config.stalePeerMinutes || 5;

    for (const peer of config.peers) {
      this.peerHealth.set(peer, {
        peer,
        healthy: false,
      });
    }
  }

  start(): void {
    if (this.syncTimer) return;
    this.syncTimer = setInterval(() => {
      void this.syncWithPeers();
    }, this.syncIntervalMs);
  }

  stop(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = undefined;
    }
  }

  async syncWithPeers(): Promise<void> {
    await Promise.all(this.config.peers.map((peer) => this.syncPeer(peer)));
    this.cleanStalePeers();
  }

  getPeerHealth(): PeerHealth[] {
    return Array.from(this.peerHealth.values());
  }

  getAllAgents(scope: 'all' | 'local' = 'all'): RegisteredAgent[] {
    const localAgents = this.localRegistry.getAllAgents();
    if (scope === 'local') return localAgents;

    const merged = new Map<string, RegisteredAgent>();

    for (const agent of localAgents) {
      merged.set(agent.agentId, agent);
    }

    for (const snapshot of this.peerSnapshots.values()) {
      for (const agent of snapshot.agents) {
        if (!merged.has(agent.agentId)) {
          merged.set(agent.agentId, agent);
        }
      }
    }

    return Array.from(merged.values());
  }

  discover(query: DiscoveryQuery): RegisteredAgent[] {
    let results = this.getAllAgents();

    if (query.capability) {
      results = results.filter((agent) =>
        agent.manifest.capabilities.some((capability) => capability.name === query.capability)
      );
    }

    if (query.availableOnly) {
      results = results.filter((agent) => agent.status === 'online');
    }

    if (query.maxCost !== undefined && query.capability) {
      results = results.filter((agent) => {
        const capability = agent.manifest.capabilities.find(
          (c) => c.name === query.capability
        );
        return !!capability && capability.baseCost <= query.maxCost!;
      });
    }

    if (query.minReputation !== undefined) {
      results = results.filter(
        (agent) => agent.manifest.minReputationRequired >= query.minReputation!
      );
    }

    results.sort((a, b) => {
      const aRep = a.manifest.minReputationRequired || 0;
      const bRep = b.manifest.minReputationRequired || 0;
      return bRep - aRep;
    });

    return results;
  }

  private async syncPeer(peer: string): Promise<void> {
    const startedAt = Date.now();
    const url = `${peer.replace(/\/$/, '')}/agents?scope=local`;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.requestTimeoutMs);
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = (await response.json()) as { agents?: RegisteredAgent[] };
      const agents = (data.agents || []).map((agent) => ({
        ...agent,
        registeredAt: new Date(agent.registeredAt),
        lastSeen: new Date(agent.lastSeen),
      }));

      this.peerSnapshots.set(peer, {
        agents,
        syncedAt: new Date(),
      });

      this.peerHealth.set(peer, {
        peer,
        healthy: true,
        lastSyncAt: new Date(),
        latencyMs: Date.now() - startedAt,
        remoteAgentCount: agents.length,
      });
    } catch (error: any) {
      this.peerHealth.set(peer, {
        peer,
        healthy: false,
        lastSyncAt: new Date(),
        lastError: error.message || String(error),
        latencyMs: Date.now() - startedAt,
      });
    }
  }

  private cleanStalePeers(): void {
    const staleThreshold = this.stalePeerMinutes * 60 * 1000;
    const now = Date.now();

    for (const [peer, snapshot] of this.peerSnapshots.entries()) {
      if (now - snapshot.syncedAt.getTime() > staleThreshold) {
        this.peerSnapshots.delete(peer);
      }
    }
  }
}

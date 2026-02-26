/**
 * Agent Discovery Registry
 *
 * Central registry for agent discovery and lookup
 */

import { CapabilityManifest } from '../schemas/capability';

export interface RegisteredAgent {
  agentId: string;
  agentName: string;
  endpoint: string;
  manifest: CapabilityManifest;
  registeredAt: Date;
  lastSeen: Date;
  status: 'online' | 'offline' | 'busy';
}

export interface DiscoveryQuery {
  capability?: string;
  minReputation?: number;
  maxCost?: number;
  availableOnly?: boolean;
}

/**
 * Agent discovery registry
 */
export class AgentRegistry {
  private agents: Map<string, RegisteredAgent> = new Map();
  private capabilityIndex: Map<string, Set<string>> = new Map(); // capability -> agentIds

  /**
   * Register an agent
   */
  register(
    agentId: string,
    agentName: string,
    endpoint: string,
    manifest: CapabilityManifest
  ): void {
    const agent: RegisteredAgent = {
      agentId,
      agentName,
      endpoint,
      manifest,
      registeredAt: this.agents.has(agentId)
        ? this.agents.get(agentId)!.registeredAt
        : new Date(),
      lastSeen: new Date(),
      status: 'online',
    };

    this.agents.set(agentId, agent);

    // Index capabilities
    for (const capability of manifest.capabilities) {
      if (!this.capabilityIndex.has(capability.name)) {
        this.capabilityIndex.set(capability.name, new Set());
      }
      this.capabilityIndex.get(capability.name)!.add(agentId);
    }

    console.log(`✅ Registered agent: ${agentName} (${agentId})`);
    console.log(`   Capabilities: ${manifest.capabilities.map((c) => c.name).join(', ')}`);
    console.log(`   Endpoint: ${endpoint}`);
  }

  /**
   * Unregister an agent
   */
  unregister(agentId: string): boolean {
    const agent = this.agents.get(agentId);
    if (!agent) return false;

    // Remove from capability index
    for (const capability of agent.manifest.capabilities) {
      this.capabilityIndex.get(capability.name)?.delete(agentId);
    }

    this.agents.delete(agentId);
    console.log(`🗑️  Unregistered agent: ${agent.agentName} (${agentId})`);
    return true;
  }

  /**
   * Update agent heartbeat
   */
  heartbeat(agentId: string): boolean {
    const agent = this.agents.get(agentId);
    if (!agent) return false;

    agent.lastSeen = new Date();
    agent.status = 'online';
    return true;
  }

  /**
   * Mark agent as offline
   */
  markOffline(agentId: string): boolean {
    const agent = this.agents.get(agentId);
    if (!agent) return false;

    agent.status = 'offline';
    return true;
  }

  /**
   * Get agent by ID
   */
  get(agentId: string): RegisteredAgent | undefined {
    return this.agents.get(agentId);
  }

  /**
   * Discover agents by capability
   */
  discoverByCapability(capabilityName: string): RegisteredAgent[] {
    const agentIds = this.capabilityIndex.get(capabilityName);
    if (!agentIds) return [];

    return Array.from(agentIds)
      .map((id) => this.agents.get(id)!)
      .filter((agent) => agent !== undefined);
  }

  /**
   * Advanced agent discovery
   */
  discover(query: DiscoveryQuery): RegisteredAgent[] {
    let results = Array.from(this.agents.values());

    // Filter by capability
    if (query.capability) {
      const agentIds = this.capabilityIndex.get(query.capability);
      if (!agentIds) return [];

      results = results.filter((agent) => agentIds.has(agent.agentId));
    }

    // Filter by availability
    if (query.availableOnly) {
      results = results.filter((agent) => agent.status === 'online');
    }

    // Filter by cost
    if (query.maxCost !== undefined && query.capability) {
      results = results.filter((agent) => {
        const capability = agent.manifest.capabilities.find(
          (c) => c.name === query.capability
        );
        return capability && capability.baseCost <= query.maxCost!;
      });
    }

    // Filter by reputation
    if (query.minReputation !== undefined) {
      results = results.filter(
        (agent) => agent.manifest.minReputationRequired >= query.minReputation!
      );
    }

    // Sort by reputation (higher first)
    results.sort((a, b) => {
      const aRep = a.manifest.minReputationRequired || 0;
      const bRep = b.manifest.minReputationRequired || 0;
      return bRep - aRep;
    });

    return results;
  }

  /**
   * Get all agents
   */
  getAllAgents(): RegisteredAgent[] {
    return Array.from(this.agents.values());
  }

  /**
   * Get all capabilities
   */
  getAllCapabilities(): string[] {
    return Array.from(this.capabilityIndex.keys());
  }

  /**
   * Get agent count
   */
  getAgentCount(): number {
    return this.agents.size;
  }

  /**
   * Get online agent count
   */
  getOnlineCount(): number {
    return Array.from(this.agents.values()).filter((a) => a.status === 'online').length;
  }

  /**
   * Clean stale agents (not seen in X minutes)
   */
  cleanStale(staleMinutes: number = 5): number {
    const now = new Date();
    const staleTime = staleMinutes * 60 * 1000;
    let cleaned = 0;

    for (const [agentId, agent] of this.agents.entries()) {
      const timeSinceLastSeen = now.getTime() - agent.lastSeen.getTime();

      if (timeSinceLastSeen > staleTime) {
        this.markOffline(agentId);
        cleaned++;
      }
    }

    return cleaned;
  }
}

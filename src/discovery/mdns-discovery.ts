/**
 * mDNS Auto-Discovery Service
 *
 * Enables zero-config agent discovery on local networks using multicast DNS.
 * Agents broadcast their presence, registry automatically discovers them.
 */

import mdns from 'multicast-dns';
import { EventEmitter } from 'events';

const SERVICE_TYPE = '_relay-agent._tcp.local';
const ANNOUNCE_INTERVAL = 60000; // 60 seconds
const SERVICE_TTL = 120; // 2 minutes

export interface AgentServiceInfo {
  agentId: string;
  agentName: string;
  endpoint: string;
  port: number;
  capabilities: string[];
  version: string;
  discoveredAt: Date;
}

export interface MdnsDiscoveryConfig {
  serviceName?: string;
  announceInterval?: number;
  serviceTtl?: number;
}

/**
 * mDNS Agent Broadcaster
 *
 * Advertises an agent's presence on the local network
 */
export class MdnsAgentBroadcaster {
  private mdns: any;
  private intervalId?: NodeJS.Timeout;
  private config: Required<MdnsDiscoveryConfig>;
  private agentInfo: AgentServiceInfo;

  constructor(
    agentInfo: AgentServiceInfo,
    config: MdnsDiscoveryConfig = {}
  ) {
    this.agentInfo = agentInfo;
    this.config = {
      serviceName: config.serviceName || SERVICE_TYPE,
      announceInterval: config.announceInterval || ANNOUNCE_INTERVAL,
      serviceTtl: config.serviceTtl || SERVICE_TTL,
    };
    this.mdns = mdns();
  }

  /**
   * Start broadcasting agent presence
   */
  start(): void {
    // Respond to queries
    this.mdns.on('query', (query: any) => {
      if (query.questions.some((q: any) => q.name === this.config.serviceName)) {
        this.announce();
      }
    });

    // Periodic announcements
    this.announce();
    this.intervalId = setInterval(() => {
      this.announce();
    }, this.config.announceInterval);

    console.log(`[mDNS] Broadcasting: ${this.agentInfo.agentName} (${this.agentInfo.agentId})`);
  }

  /**
   * Stop broadcasting
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }

    // Send goodbye announcement (TTL = 0)
    this.announce(0);

    // Close mDNS socket after short delay
    setTimeout(() => {
      this.mdns.destroy();
    }, 1000);

    console.log(`[mDNS] Stopped broadcasting: ${this.agentInfo.agentName}`);
  }

  /**
   * Send mDNS announcement
   */
  private announce(ttl: number = this.config.serviceTtl): void {
    const serviceName = `${this.agentInfo.agentId}.${this.config.serviceName}`;

    this.mdns.respond([
      // PTR record (service type)
      {
        name: this.config.serviceName,
        type: 'PTR',
        ttl,
        data: serviceName,
      },
      // SRV record (host and port)
      {
        name: serviceName,
        type: 'SRV',
        ttl,
        data: {
          port: this.agentInfo.port,
          target: 'localhost',
        },
      },
      // TXT record (metadata)
      {
        name: serviceName,
        type: 'TXT',
        ttl,
        data: [
          `agentId=${this.agentInfo.agentId}`,
          `agentName=${this.agentInfo.agentName}`,
          `capabilities=${this.agentInfo.capabilities.join(',')}`,
          `version=${this.agentInfo.version}`,
          `endpoint=${this.agentInfo.endpoint}`,
        ],
      },
    ]);
  }
}

/**
 * mDNS Agent Discovery Listener
 *
 * Listens for agent broadcasts and emits discovery events
 */
export class MdnsAgentDiscovery extends EventEmitter {
  private mdns: any;
  private config: Required<MdnsDiscoveryConfig>;
  private discoveredAgents: Map<string, AgentServiceInfo> = new Map();
  private queryIntervalId?: NodeJS.Timeout;

  constructor(config: MdnsDiscoveryConfig = {}) {
    super();
    this.config = {
      serviceName: config.serviceName || SERVICE_TYPE,
      announceInterval: config.announceInterval || ANNOUNCE_INTERVAL,
      serviceTtl: config.serviceTtl || SERVICE_TTL,
    };
    this.mdns = mdns();
  }

  /**
   * Start listening for agent broadcasts
   */
  start(): void {
    // Listen for responses
    this.mdns.on('response', (response: any) => {
      this.handleResponse(response);
    });

    // Periodically query for agents
    this.query();
    this.queryIntervalId = setInterval(() => {
      this.query();
    }, 30000); // Query every 30 seconds

    console.log('[mDNS] Listening for agent broadcasts...');
  }

  /**
   * Stop listening
   */
  stop(): void {
    if (this.queryIntervalId) {
      clearInterval(this.queryIntervalId);
      this.queryIntervalId = undefined;
    }

    this.mdns.destroy();
    console.log('[mDNS] Stopped listening');
  }

  /**
   * Query for available agents
   */
  private query(): void {
    this.mdns.query({
      questions: [{
        name: this.config.serviceName,
        type: 'PTR',
      }],
    });
  }

  /**
   * Handle mDNS response
   */
  private handleResponse(response: any): void {
    const ptrRecords = response.answers.filter((a: any) => a.type === 'PTR' && a.name === this.config.serviceName);

    for (const ptr of ptrRecords) {
      const serviceName = ptr.data;
      const srvRecord = response.additionals?.find((a: any) => a.type === 'SRV' && a.name === serviceName);
      const txtRecord = response.additionals?.find((a: any) => a.type === 'TXT' && a.name === serviceName);

      if (srvRecord && txtRecord) {
        const agentInfo = this.parseTxtRecord(txtRecord.data, srvRecord.data.port);

        if (agentInfo) {
          // Check if TTL is 0 (goodbye message)
          if (ptr.ttl === 0) {
            if (this.discoveredAgents.has(agentInfo.agentId)) {
              this.discoveredAgents.delete(agentInfo.agentId);
              this.emit('agent:left', agentInfo);
              console.log(`[mDNS] Agent left: ${agentInfo.agentName}`);
            }
          } else {
            // New or updated agent
            const isNew = !this.discoveredAgents.has(agentInfo.agentId);
            this.discoveredAgents.set(agentInfo.agentId, agentInfo);

            if (isNew) {
              this.emit('agent:discovered', agentInfo);
              console.log(`[mDNS] Discovered agent: ${agentInfo.agentName} at ${agentInfo.endpoint}`);
            } else {
              this.emit('agent:updated', agentInfo);
            }
          }
        }
      }
    }
  }

  /**
   * Parse TXT record into AgentServiceInfo
   */
  private parseTxtRecord(txtData: string[], port: number): AgentServiceInfo | null {
    try {
      const data: Record<string, string> = {};

      // Parse TXT records (key=value format)
      for (const entry of txtData) {
        const [key, ...valueParts] = entry.split('=');
        data[key] = valueParts.join('=');
      }

      if (!data.agentId || !data.agentName) {
        return null;
      }

      return {
        agentId: data.agentId,
        agentName: data.agentName,
        endpoint: data.endpoint || `http://127.0.0.1:${port}`,
        port,
        capabilities: data.capabilities ? data.capabilities.split(',') : [],
        version: data.version || '1.0.0',
        discoveredAt: new Date(),
      };
    } catch (error) {
      console.error('[mDNS] Failed to parse TXT record:', error);
      return null;
    }
  }

  /**
   * Get all currently discovered agents
   */
  getDiscoveredAgents(): AgentServiceInfo[] {
    return Array.from(this.discoveredAgents.values());
  }

  /**
   * Get specific agent by ID
   */
  getAgent(agentId: string): AgentServiceInfo | undefined {
    return this.discoveredAgents.get(agentId);
  }
}

/**
 * Convenience function to create and start broadcaster
 */
export function broadcastAgent(
  agentInfo: AgentServiceInfo,
  config?: MdnsDiscoveryConfig
): MdnsAgentBroadcaster {
  const broadcaster = new MdnsAgentBroadcaster(agentInfo, config);
  broadcaster.start();
  return broadcaster;
}

/**
 * Convenience function to create and start discovery listener
 */
export function discoverAgents(config?: MdnsDiscoveryConfig): MdnsAgentDiscovery {
  const discovery = new MdnsAgentDiscovery(config);
  discovery.start();
  return discovery;
}

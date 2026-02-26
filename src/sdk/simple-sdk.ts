/**
 * Relay SDK - Simple API for AI agents
 *
 * Usage:
 *   import { Relay } from 'relay-protocol'
 *
 *   const relay = new Relay()
 *   const agent = await relay.findAgent({ canDo: 'book_flights' })
 *   const result = await relay.pay(agent, 500, { task: 'find flights to Paris' })
 */

import fs from 'fs/promises';
import path from 'path';
import axios from 'axios';
import { RelayClient } from './relay-client';
import { KeyPair } from '../crypto/signer';

export interface AgentSearchQuery {
  canDo?: string; // Capability name
  minReputation?: number;
  maxPrice?: number;
}

export interface Agent {
  agentId: string;
  agentName: string;
  endpoint: string;
  capabilities: string[];
  reputation: number;
}

export interface DelegationRequest {
  task: string;
  payment: number; // Credits
  params?: Record<string, any>;
  timeout?: number; // Seconds
}

export interface DelegationResult {
  success: boolean;
  result?: any;
  error?: string;
}

export class Relay {
  private client: RelayClient | null = null;
  private registryUrl: string;
  private escrowUrl: string;
  private agentId?: string;
  private keyPair?: KeyPair;

  constructor(options?: {
    registryUrl?: string;
    escrowUrl?: string;
    agentId?: string;
    keyPair?: KeyPair;
  }) {
    this.registryUrl = options?.registryUrl || 'http://127.0.0.1:9001';
    this.escrowUrl = options?.escrowUrl || 'http://127.0.0.1:9010';
    this.agentId = options?.agentId;
    this.keyPair = options?.keyPair;
  }

  /**
   * Initialize from ~/.relay config
   */
  private async initialize(): Promise<void> {
    if (this.client) return;

    try {
      const relayDir = path.join(process.env.HOME || '~', '.relay');
      const keysFile = path.join(relayDir, 'keys.json');
      const stateFile = path.join(relayDir, 'state.json');

      // Load keys
      const keysData = await fs.readFile(keysFile, 'utf-8');
      const { agentId, keyPair } = JSON.parse(keysData);

      this.agentId = agentId;
      this.keyPair = keyPair;

      // Initialize client
      this.client = new RelayClient({ agentId, autoGenerateKeys: false });

      // Load balance
      const stateData = await fs.readFile(stateFile, 'utf-8');
      const { balance } = JSON.parse(stateData);
      if (balance > 0) {
        this.client.depositFunds(balance);
      }
    } catch (error) {
      throw new Error(
        'Relay not initialized. Run: relay start'
      );
    }
  }

  /**
   * Find an agent that can perform a capability
   */
  async findAgent(query: AgentSearchQuery): Promise<Agent | null> {
    await this.initialize();

    try {
      // Query registry
      const response = await axios.get(`${this.registryUrl}/agents`);
      const { agents } = response.data;

      // Filter by capability
      const matches = agents.filter((agent: any) => {
        if (!agent.manifest?.capabilities) return false;

        const capabilities = agent.manifest.capabilities.map((c: any) => c.name);

        // Check capability match
        if (query.canDo && !capabilities.includes(query.canDo)) {
          return false;
        }

        // Check reputation
        if (query.minReputation && agent.reputation < query.minReputation) {
          return false;
        }

        return true;
      });

      if (matches.length === 0) return null;

      // Return highest reputation match
      matches.sort((a: any, b: any) => b.reputation - a.reputation);
      const match = matches[0];

      return {
        agentId: match.agentId,
        agentName: match.agentName,
        endpoint: match.endpoint,
        capabilities: match.manifest.capabilities.map((c: any) => c.name),
        reputation: match.reputation || 0,
      };
    } catch (error) {
      console.error('Failed to find agent:', error);
      return null;
    }
  }

  /**
   * Pay an agent to perform a task (creates escrow and delegates)
   */
  async pay(
    agent: Agent,
    amount: number,
    request: Omit<DelegationRequest, 'payment'>
  ): Promise<DelegationResult> {
    await this.initialize();

    if (!this.client) {
      throw new Error('Relay client not initialized');
    }

    try {
      // Check balance
      const balance = this.client.getBalance();
      if (balance.balance < amount) {
        return {
          success: false,
          error: `Insufficient balance: ${balance.balance} credits available, ${amount} required`,
        };
      }

      // Create escrow
      const taskId = `task_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      const escrowId = await this.createEscrow(taskId, agent.agentId, amount);

      // Delegate task to agent
      const result = await this.delegateTask(agent.endpoint, {
        taskId,
        escrowId,
        payment: amount,
        ...request,
      });

      // Release escrow on success
      if (result.success) {
        await this.releaseEscrow(escrowId);
      }

      return result;
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Unknown error',
      };
    }
  }

  /**
   * Create escrow for task payment
   */
  private async createEscrow(
    taskId: string,
    providerAgentId: string,
    amount: number
  ): Promise<string> {
    const response = await axios.post(`${this.escrowUrl}/escrow`, {
      taskId,
      clientAgentId: this.agentId,
      providerAgentId,
      amount,
    });

    return response.data.escrowId;
  }

  /**
   * Release escrow payment to provider
   */
  private async releaseEscrow(escrowId: string): Promise<void> {
    await axios.post(`${this.escrowUrl}/escrow/${escrowId}/release`);
  }

  /**
   * Delegate task to agent
   */
  private async delegateTask(
    agentEndpoint: string,
    request: DelegationRequest & { taskId: string; escrowId: string }
  ): Promise<DelegationResult> {
    try {
      const response = await axios.post(`${agentEndpoint}/execute`, request, {
        timeout: (request.timeout || 30) * 1000,
      });

      return {
        success: true,
        result: response.data,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get current balance
   */
  async getBalance(): Promise<number> {
    await this.initialize();
    if (!this.client) return 0;
    return this.client.getBalance().balance;
  }

  /**
   * Deposit funds
   */
  async deposit(amount: number): Promise<void> {
    await this.initialize();
    if (!this.client) throw new Error('Client not initialized');

    this.client.depositFunds(amount);

    // Save to state
    const relayDir = path.join(process.env.HOME || '~', '.relay');
    const stateFile = path.join(relayDir, 'state.json');
    const balance = this.client.getBalance();
    await fs.writeFile(stateFile, JSON.stringify({ balance: balance.balance }, null, 2));
  }
}

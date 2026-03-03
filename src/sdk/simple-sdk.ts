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
import { KeyPair, RelaySign } from '../crypto/signer';
import { createSignedHeaders } from '../network/request-auth';
import {
  TaskContract,
  TaskContractHelper,
  ContractStatus,
} from '../schemas/contract';

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
  private developmentMode: boolean;

  constructor(options?: {
    registryUrl?: string;
    escrowUrl?: string;
    agentId?: string;
    keyPair?: KeyPair;
    /**
     * Development mode: Uses simple escrow endpoints without contracts/signatures
     * WARNING: Do NOT use in production! No escrow security.
     * Default: true (for easy getting started)
     */
    developmentMode?: boolean;
  }) {
    this.registryUrl = options?.registryUrl || 'http://127.0.0.1:9001';
    this.escrowUrl = options?.escrowUrl || 'http://127.0.0.1:9010';
    this.agentId = options?.agentId;
    this.keyPair = options?.keyPair;
    this.developmentMode = options?.developmentMode !== false; // Default: true
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
   * Create signed request headers for API calls
   */
  private getSignedHeaders(method: string, path: string, body?: any): Record<string, string> {
    if (!this.agentId || !this.keyPair) {
      return {}; // Return empty if not initialized (will fail auth if required)
    }

    const rawBody = body ? JSON.stringify(body) : undefined;

    return createSignedHeaders({
      agentId: this.agentId,
      privateKey: this.keyPair.privateKey,
      publicKey: this.keyPair.publicKey,
      method,
      path,
      rawBody,
    });
  }

  /**
   * Find an agent that can perform a capability
   */
  async findAgent(query: AgentSearchQuery): Promise<Agent | null> {
    await this.initialize();

    try {
      // Query registry with signed headers
      const headers = this.getSignedHeaders('GET', '/agents');
      const response = await axios.get(`${this.registryUrl}/agents`, { headers });
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

      // Step 1: Lock funds in escrow (proper /lock endpoint)
      const taskId = `task_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      const lockId = await this.lockEscrow(taskId, agent.agentId, amount, request);

      // Step 2: Delegate task to agent
      const result = await this.delegateTask(agent.endpoint, {
        taskId,
        lockId,
        payment: amount,
        ...request,
      });

      // Step 3: Release or refund based on result
      if (result.success) {
        await this.releaseEscrow(lockId);
      } else {
        await this.refundEscrow(lockId);
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
   * Lock funds in escrow for task payment
   */
  private async lockEscrow(
    taskId: string,
    providerAgentId: string,
    amount: number,
    request: Omit<DelegationRequest, 'payment'>
  ): Promise<string> {
    if (this.developmentMode) {
      // Development mode: Simple API, no contracts
      const body = {
        taskId,
        fromAgentId: this.agentId,
        toAgentId: providerAgentId,
        amount,
      };

      const response = await axios.post(`${this.escrowUrl}/lock/simple`, body);
      return response.data.lockId || response.data.contractId;
    } else {
      // Production mode: Create and sign TaskContract
      if (!this.agentId || !this.keyPair) {
        throw new Error('Production mode requires agentId and keyPair to be configured');
      }

      // Step 1: Create contract
      const contract = await this.createTaskContract(
        taskId,
        providerAgentId,
        amount,
        request
      );

      // Step 2: Sign contract as delegator
      const signedContract = this.signContractAsDelegator(contract);

      // Step 3: Request performer signature (via their endpoint)
      const fullySignedContract = await this.getPerformerSignature(signedContract, providerAgentId);

      // Step 4: Lock funds with fully signed contract
      const body = { contract: fullySignedContract };
      const headers = this.getSignedHeaders('POST', '/lock', body);
      const response = await axios.post(`${this.escrowUrl}/lock`, body, { headers });

      return response.data.lock.contractId;
    }
  }

  /**
   * Create a TaskContract for the delegation
   */
  private async createTaskContract(
    contractId: string,
    performerId: string,
    amount: number,
    request: Omit<DelegationRequest, 'payment'>
  ): Promise<TaskContract> {
    if (!this.agentId) {
      throw new Error('agentId is required');
    }

    const deadline = new Date();
    deadline.setSeconds(deadline.getSeconds() + (request.timeout || 300)); // Default 5 min

    const contract: TaskContract = {
      contractId,
      version: '1.0.0',
      delegatorId: this.agentId,
      performerId,
      capabilityName: request.task,
      taskDescription: request.task,
      taskInput: request.params || {},
      deliverableSchema: {},
      deadline,
      createdAt: new Date(),
      paymentAmount: amount,
      stakeAmount: 0, // Optional: could require stake from performer
      verificationRules: [
        {
          type: 'automated',
          criteria: { successField: 'success' },
          required: true,
        },
      ],
      disputeWindow: {
        durationSeconds: 300, // 5 minutes
      },
      slashingConditions: [],
      escrowFunded: false,
      disputeRaised: false,
      metadata: {
        createdBy: 'relay-simple-sdk',
        requestedAt: new Date().toISOString(),
      },
      status: ContractStatus.DRAFT,
    };

    return contract;
  }

  /**
   * Sign contract as delegator
   */
  private signContractAsDelegator(contract: TaskContract): TaskContract {
    if (!this.keyPair) {
      throw new Error('keyPair is required for signing');
    }

    const helper = new TaskContractHelper(contract);
    const signable = helper.toSignable();
    const signatureResult = RelaySign.sign(signable, this.keyPair.privateKey);

    return {
      ...contract,
      delegatorSignature: signatureResult.signature,
      status: ContractStatus.SIGNED,
    };
  }

  /**
   * Request performer to sign the contract
   */
  private async getPerformerSignature(
    contract: TaskContract,
    performerId: string
  ): Promise<TaskContract> {
    // Get performer's endpoint from registry
    const headers = this.getSignedHeaders('GET', '/agents');
    const response = await axios.get(`${this.registryUrl}/agents`, { headers });
    const { agents } = response.data;

    const performer = agents.find((a: any) => a.agentId === performerId);
    if (!performer) {
      throw new Error(`Performer ${performerId} not found in registry`);
    }

    // Request signature from performer's /contract/sign endpoint
    try {
      const body = { contract };
      const signHeaders = this.getSignedHeaders('POST', '/contract/sign', body);
      const signResponse = await axios.post(
        `${performer.endpoint}/contract/sign`,
        body,
        { headers: signHeaders, timeout: 10000 }
      );

      return signResponse.data.contract;
    } catch (error) {
      throw new Error(
        `Performer ${performerId} failed to sign contract. ` +
        `They may not support production mode contracts yet.`
      );
    }
  }

  /**
   * Release escrow payment to provider
   */
  private async releaseEscrow(lockId: string): Promise<void> {
    if (this.developmentMode) {
      await axios.post(`${this.escrowUrl}/release/simple`, { lockId });
    } else {
      const body = { contractId: lockId };
      const headers = this.getSignedHeaders('POST', '/release', body);
      await axios.post(`${this.escrowUrl}/release`, body, { headers });
    }
  }

  /**
   * Refund escrow payment to client
   */
  private async refundEscrow(lockId: string): Promise<void> {
    if (this.developmentMode) {
      await axios.post(`${this.escrowUrl}/refund/simple`, { lockId });
    } else {
      const body = { contractId: lockId };
      const headers = this.getSignedHeaders('POST', '/refund', body);
      await axios.post(`${this.escrowUrl}/refund`, body, { headers });
    }
  }

  /**
   * Delegate task to agent (with signed request)
   */
  private async delegateTask(
    agentEndpoint: string,
    request: DelegationRequest & { taskId: string; lockId: string }
  ): Promise<DelegationResult> {
    try {
      const body = request;
      const headers = this.getSignedHeaders('POST', '/execute', body);

      const response = await axios.post(`${agentEndpoint}/execute`, body, {
        headers,
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

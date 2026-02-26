/**
 * Agent HTTP Client
 *
 * Client for sending A2A Protocol messages to other agents
 */

import axios, { AxiosInstance } from 'axios';
import { A2AMessage, A2AMessageType, A2AMessageBuilder } from './a2a-types';
import { CapabilityManifest } from '../schemas/capability';
import { TaskContract } from '../schemas/contract';

export interface AgentEndpoint {
  agentId: string;
  url: string;
}

/**
 * HTTP client for agent communication
 */
export class AgentClient {
  private http: AxiosInstance;
  private agentId: string;

  constructor(agentId: string, timeout: number = 30000) {
    this.agentId = agentId;
    this.http = axios.create({
      timeout,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': `Relay-Agent/${this.agentId}`,
      },
    });
  }

  /**
   * Send A2A message to another agent
   */
  async sendMessage(endpoint: string, message: A2AMessage): Promise<A2AMessage> {
    try {
      const response = await this.http.post(`${endpoint}/message`, message);
      return response.data;
    } catch (error: any) {
      throw new Error(`Failed to send message: ${error.message}`);
    }
  }

  /**
   * Ping another agent
   */
  async ping(endpoint: string): Promise<boolean> {
    try {
      const message = A2AMessageBuilder.createMessage(
        this.agentId,
        'unknown',
        A2AMessageType.PING,
        {}
      );

      const response = await this.sendMessage(endpoint, message);
      return response.type === A2AMessageType.PONG;
    } catch {
      return false;
    }
  }

  /**
   * Get agent manifest
   */
  async getManifest(endpoint: string): Promise<CapabilityManifest> {
    try {
      const response = await this.http.get(`${endpoint}/manifest`);
      return response.data;
    } catch (error: any) {
      throw new Error(`Failed to get manifest: ${error.message}`);
    }
  }

  /**
   * Get agent status
   */
  async getStatus(endpoint: string): Promise<{
    agentId: string;
    agentName: string;
    capabilities: string[];
    balance: number;
    reputation: number;
    tier?: string;
    uptime: number;
  }> {
    try {
      const response = await this.http.get(`${endpoint}/status`);
      return response.data;
    } catch (error: any) {
      throw new Error(`Failed to get status: ${error.message}`);
    }
  }

  /**
   * Send task request to another agent
   */
  async requestTask(
    endpoint: string,
    performerId: string,
    contract: TaskContract
  ): Promise<A2AMessage> {
    const message = A2AMessageBuilder.createTaskRequest(
      this.agentId,
      performerId,
      contract
    );

    return await this.sendMessage(endpoint, message);
  }

  /**
   * Send task progress update
   */
  async sendProgress(
    endpoint: string,
    contractId: string,
    progress: number,
    status: string,
    logs?: string[]
  ): Promise<void> {
    const message = A2AMessageBuilder.createTaskProgress(
      this.agentId,
      endpoint,
      contractId,
      progress,
      status,
      logs
    );

    await this.sendMessage(endpoint, message);
  }

  /**
   * Send task completion
   */
  async sendCompletion(
    endpoint: string,
    delegatorId: string,
    contractId: string,
    deliverable: any,
    executionProof: any
  ): Promise<void> {
    const message = A2AMessageBuilder.createTaskComplete(
      this.agentId,
      delegatorId,
      contractId,
      deliverable,
      executionProof
    );

    await this.sendMessage(endpoint, message);
  }

  /**
   * Health check
   */
  async healthCheck(endpoint: string): Promise<{ status: string; agentId: string }> {
    try {
      const response = await this.http.get(`${endpoint}/health`);
      return response.data;
    } catch (error: any) {
      throw new Error(`Health check failed: ${error.message}`);
    }
  }
}

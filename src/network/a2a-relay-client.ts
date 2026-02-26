/**
 * A2A Relay Client
 *
 * Official A2A Protocol client for delegator agents
 */

import { ClientFactory, ClientFactoryOptions } from '@a2a-js/sdk/client';
import { v4 as uuidv4 } from 'uuid';
import { RelayClient } from '../sdk/relay-client';
import { CapabilityManifest } from '../schemas/capability';
import { TaskContract } from '../schemas/contract';

export interface A2ARelayClientConfig {
  relayClient: RelayClient;
  agentId: string;
}

/**
 * A2A-powered client for delegating tasks to remote agents
 */
export class A2ARelayClient {
  private relayClient: RelayClient;
  private agentId: string;
  private clientFactory: ClientFactory;

  constructor(config: A2ARelayClientConfig) {
    this.relayClient = config.relayClient;
    this.agentId = config.agentId;

    // Create client factory with default options
    this.clientFactory = new ClientFactory(ClientFactoryOptions.default);
  }

  /**
   * Discover agent at URL and get their capabilities
   */
  async discoverAgent(agentUrl: string): Promise<{
    agentCard: any;
    capabilities: string[];
  }> {
    // Create client from URL (fetches agent card)
    const client = await this.clientFactory.createFromUrl(agentUrl);
    const agentCard = (client as any).agentCard;

    return {
      agentCard,
      capabilities: agentCard.skills?.map((s: any) => s.name) || [],
    };
  }

  /**
   * Delegate task to remote agent via A2A Protocol
   */
  async delegateTask(
    performerUrl: string,
    capability: string,
    taskInput: Record<string, any>,
    paymentAmount: number,
    contract?: TaskContract
  ): Promise<{
    taskId: string;
    contract: TaskContract;
    result?: any;
  }> {
    // Create A2A client for the performer
    const client = await this.clientFactory.createFromUrl(performerUrl);

    // Create message with task request
    const message = {
      kind: 'message' as const,
      messageId: uuidv4(),
      role: 'user' as const,
      parts: [
        {
          kind: 'text' as const,
          text: JSON.stringify({
            capability,
            ...taskInput,
            contract: contract
              ? {
                  contractId: contract.contractId,
                  paymentAmount: contract.paymentAmount,
                }
              : undefined,
          }),
        },
      ],
    };

    // Send message via A2A Protocol
    const response = await client.sendMessage({ message });

    // Extract task ID and result
    const taskId = 'task' in response ? (response as any).task.id : uuidv4();
    let result: any = undefined;

    if ('message' in response) {
      // Extract result from message parts
      const textParts = (response as any).message.parts.filter((p: any) => p.kind === 'text');
      if (textParts.length > 0) {
        const text = textParts[0].text;
        try {
          result = JSON.parse(text);
        } catch {
          result = text;
        }
      }
    }

    // Create or update contract
    const taskContract =
      contract ||
      ({
        contractId: uuidv4(),
        delegatorId: this.agentId,
        performerId: 'unknown', // Will be filled from agent card
        capabilityName: capability,
        taskInput,
        paymentAmount,
        createdAt: new Date(),
        status: 'pending',
      } as any);

    return {
      taskId,
      contract: taskContract,
      result,
    };
  }

  /**
   * Stream task execution from remote agent
   */
  async *delegateTaskStream(
    performerUrl: string,
    capability: string,
    taskInput: Record<string, any>
  ): AsyncGenerator<any, void, undefined> {
    // Create A2A client
    const client = await this.clientFactory.createFromUrl(performerUrl);

    // Create message
    const message = {
      kind: 'message' as const,
      messageId: uuidv4(),
      role: 'user' as const,
      parts: [
        {
          kind: 'text' as const,
          text: JSON.stringify({
            capability,
            ...taskInput,
          }),
        },
      ],
    };

    // Stream events
    for await (const event of client.sendMessageStream({ message })) {
      yield event;
    }
  }

  /**
   * Get task status from remote agent
   */
  async getTaskStatus(performerUrl: string, taskId: string): Promise<any> {
    const client = await this.clientFactory.createFromUrl(performerUrl);

    try {
      const task = await client.getTask({ id: taskId });
      return task;
    } catch (error: any) {
      throw new Error(`Failed to get task status: ${error.message}`);
    }
  }

  /**
   * Cancel task on remote agent
   */
  async cancelTask(performerUrl: string, taskId: string): Promise<any> {
    const client = await this.clientFactory.createFromUrl(performerUrl);

    try {
      const task = await client.cancelTask({ id: taskId });
      return task;
    } catch (error: any) {
      throw new Error(`Failed to cancel task: ${error.message}`);
    }
  }

  /**
   * Subscribe to task updates
   */
  async *subscribeToTask(
    performerUrl: string,
    taskId: string
  ): AsyncGenerator<any, void, undefined> {
    const client = await this.clientFactory.createFromUrl(performerUrl);

    try {
      for await (const event of client.resubscribeTask({ id: taskId })) {
        yield event;
      }
    } catch (error: any) {
      throw new Error(`Failed to subscribe to task: ${error.message}`);
    }
  }
}

/**
 * Create A2A Relay Client
 */
export function createA2ARelayClient(
  relayClient: RelayClient,
  agentId: string
): A2ARelayClient {
  return new A2ARelayClient({
    relayClient,
    agentId,
  });
}

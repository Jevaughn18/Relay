/**
 * A2A Protocol Adapter
 *
 * Adapts Relay concepts to official A2A Protocol
 */

import { AgentCard, Message } from '@a2a-js/sdk';
import { AgentExecutor, RequestContext, ExecutionEventBus } from '@a2a-js/sdk/server';
import { v4 as uuidv4 } from 'uuid';
import { CapabilityManifest } from '../schemas/capability';
import { RelayClient } from '../sdk/relay-client';

/**
 * Convert Relay CapabilityManifest to A2A AgentCard
 */
export function manifestToAgentCard(
  manifest: CapabilityManifest,
  serverUrl: string
): AgentCard {
  return {
    name: manifest.agentName,
    description: `Relay agent with ${manifest.capabilities.length} capabilities`,
    protocolVersion: '0.3.0',
    version: manifest.version,
    url: `${serverUrl}/.well-known/agent-card.json`,

    // Convert Relay capabilities to A2A skills
    skills: manifest.capabilities.map((cap) => ({
      id: cap.name,
      name: cap.name,
      description: cap.description,
      tags: ['relay', 'task-execution'],
    })),

    capabilities: {
      pushNotifications: false,
      streaming: true,
    },

    defaultInputModes: ['text', 'json'],
    defaultOutputModes: ['text', 'json'],

    // Multiple transport interfaces
    additionalInterfaces: [
      { url: `${serverUrl}/a2a/jsonrpc`, transport: 'JSONRPC' },
      { url: `${serverUrl}/a2a/rest`, transport: 'HTTP+JSON' },
    ],
  };
}

/**
 * Relay Agent Executor
 *
 * Implements A2A's AgentExecutor interface using Relay's task execution
 */
export class RelayAgentExecutor implements AgentExecutor {
  constructor(
    private relayClient: RelayClient,
    private manifest: CapabilityManifest
  ) {}

  async execute(requestContext: RequestContext, eventBus: ExecutionEventBus): Promise<void> {
    const { message } = requestContext;

    try {
      // Parse the incoming A2A message
      const capability = this.extractCapability(message);
      const taskInput = this.extractTaskInput(message);

      // Send initial status using A2A SDK API
      const statusMessage: Message = {
        kind: 'message',
        messageId: uuidv4(),
        role: 'agent',
        parts: [{ kind: 'text', text: `Processing ${capability} task...` }],
        contextId: requestContext.contextId,
      };
      eventBus.publish(statusMessage);

      // Execute task using Relay logic
      const result = await this.executeRelayTask(capability, taskInput, eventBus, requestContext.contextId);

      // Send final result
      const resultMessage: Message = {
        kind: 'message',
        messageId: uuidv4(),
        role: 'agent',
        parts: [{ kind: 'text', text: JSON.stringify(result, null, 2) }],
        contextId: requestContext.contextId,
      };
      eventBus.publish(resultMessage);

      // Mark task as complete
      eventBus.finished();
    } catch (error: any) {
      // Send error message
      const errorMessage: Message = {
        kind: 'message',
        messageId: uuidv4(),
        role: 'agent',
        parts: [{ kind: 'text', text: `Error: ${error.message}` }],
        contextId: requestContext.contextId,
      };
      eventBus.publish(errorMessage);
      eventBus.finished();
      throw error;
    }
  }

  /**
   * Cancel task execution
   */
  async cancelTask(): Promise<void> {
    // Implement task cancellation if needed
    console.log('Task cancellation requested');
  }

  /**
   * Extract capability name from A2A message
   */
  private extractCapability(message: Message): string {
    // Check message parts for capability identifier
    for (const part of message.parts || []) {
      if (part.kind === 'text' && 'text' in part) {
        // Look for capability in message
        for (const cap of this.manifest.capabilities) {
          if (part.text.includes(cap.name)) {
            return cap.name;
          }
        }
      }
    }

    // Default to first capability
    return this.manifest.capabilities[0]?.name || 'default';
  }

  /**
   * Extract task input from A2A message
   */
  private extractTaskInput(message: Message): Record<string, any> {
    const input: Record<string, any> = {};

    for (const part of message.parts || []) {
      if (part.kind === 'text' && 'text' in part) {
        try {
          // Try to parse JSON input
          const parsed = JSON.parse(part.text);
          Object.assign(input, parsed);
        } catch {
          // If not JSON, use as text input
          input.text = part.text;
        }
      } else if (part.kind === 'file') {
        input.file = part;
      }
    }

    return input;
  }

  /**
   * Execute Relay task
   */
  private async executeRelayTask(
    capability: string,
    input: Record<string, any>,
    eventBus: ExecutionEventBus,
    contextId: string
  ): Promise<any> {
    // Simulate task execution
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Send progress update
    const progressMessage: Message = {
      kind: 'message',
      messageId: uuidv4(),
      role: 'agent',
      parts: [{ kind: 'text', text: `Task 50% complete...` }],
      contextId,
    };
    eventBus.publish(progressMessage);

    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Return result
    return {
      capability,
      input,
      result: 'Task completed successfully',
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Create A2A AgentCard from Relay manifest
 */
export function createAgentCard(
  manifest: CapabilityManifest,
  serverUrl: string
): AgentCard {
  return manifestToAgentCard(manifest, serverUrl);
}

/**
 * Create A2A AgentExecutor from Relay client
 */
export function createAgentExecutor(
  client: RelayClient,
  manifest: CapabilityManifest
): AgentExecutor {
  return new RelayAgentExecutor(client, manifest);
}

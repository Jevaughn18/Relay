/**
 * Core Relay Wrapper - Explicit AI Integration
 *
 * Adds delegation capabilities to AI SDKs with transparent user approval
 */

import { Relay } from '../sdk/simple-sdk';
import { RelayConfig, DelegationRequest, DelegationResult } from './types';

export class RelayWrapper {
  private relay: Relay;
  private config: Required<RelayConfig>;

  constructor(config: RelayConfig) {
    // Set defaults
    this.config = {
      mode: 'ask',
      maxSpend: 100,
      autoApprove: [],
      registryUrl: 'http://localhost:9001',
      notify: true,
      onDelegation: async () => true,
      onComplete: () => {},
      onError: () => {},
      ...config,
    };

    // Initialize Relay client
    this.relay = new Relay({
      registryUrl: this.config.registryUrl,
      agentId: this.config.agentId,
    });
  }

  /**
   * Get the delegation tool definition for AI
   */
  getDelegationTool() {
    return {
      name: 'delegate_task',
      description:
        'Find and hire another AI agent to perform a task you cannot do yourself. ' +
        'Use this when you need specialized capabilities like booking flights, ' +
        'accessing real-time data, or performing actions outside your abilities. ' +
        'NOTE: This incurs a cost and requires user approval.',
      input_schema: {
        type: 'object',
        properties: {
          capability: {
            type: 'string',
            description:
              'The capability you need (e.g., "book_flight", "web_search", "send_email"). ' +
              'Be specific about what action needs to be performed.',
          },
          params: {
            type: 'object',
            description:
              'Parameters for the task. Include all necessary information for the agent to complete the task.',
          },
          reason: {
            type: 'string',
            description: 'Brief explanation of why you need to delegate this task (shown to user).',
          },
        },
        required: ['capability', 'params', 'reason'],
      },
    };
  }

  /**
   * Handle delegation tool call from AI
   */
  async handleDelegation(args: {
    capability: string;
    params: Record<string, any>;
    reason?: string;
  }): Promise<DelegationResult> {
    try {
      // Search for agents with this capability
      const agent = await this.relay.findAgent({ canDo: args.capability });

      if (!agent) {
        throw new Error(`No agents found with capability: ${args.capability}`);
      }

      // Estimate cost (for now use fixed price, can enhance later)
      const estimatedCost = 1; // Default 1 credit

      // Check cost limit
      if (estimatedCost > this.config.maxSpend) {
        throw new Error(
          `Task cost ($${estimatedCost}) exceeds max spend limit ($${this.config.maxSpend})`
        );
      }

      const request: DelegationRequest = {
        capability: args.capability,
        params: args.params,
        estimatedCost,
        agentName: agent.agentName,
        agentId: agent.agentId,
      };

      // Check approval
      const approved = await this.checkApproval(request, args.reason);

      if (!approved) {
        throw new Error('User denied delegation request');
      }

      // Execute delegation using pay()
      const delegationResult = await this.relay.pay(agent, estimatedCost, {
        task: args.capability,
        params: args.params,
      });

      if (!delegationResult.success) {
        throw new Error(delegationResult.error || 'Delegation failed');
      }

      // Success callback
      if (this.config.onComplete) {
        this.config.onComplete(request, delegationResult.result);
      }

      return {
        success: true,
        result: delegationResult.result,
        cost: estimatedCost,
        agentId: agent.agentId,
        agentName: agent.agentName,
      };
    } catch (error: any) {
      const errorResult: DelegationResult = {
        success: false,
        error: error.message,
        cost: 0,
        agentId: '',
        agentName: '',
      };

      // Error callback
      if (this.config.onError) {
        this.config.onError(
          {
            capability: args.capability,
            params: args.params,
            estimatedCost: 0,
          },
          error
        );
      }

      return errorResult;
    }
  }

  /**
   * Check if delegation should be approved
   */
  private async checkApproval(request: DelegationRequest, reason?: string): Promise<boolean> {
    // Mode: ask - always ask user
    if (this.config.mode === 'ask') {
      if (this.config.notify) {
        console.log('\n🤖 Relay Delegation Request:');
        console.log(`   Capability: ${request.capability}`);
        console.log(`   Agent: ${request.agentName}`);
        console.log(`   Cost: $${request.estimatedCost}`);
        if (reason) {
          console.log(`   Reason: ${reason}`);
        }
        console.log('');
      }

      return await this.config.onDelegation(request);
    }

    // Mode: auto - check if capability is pre-approved
    if (this.config.mode === 'auto') {
      const isPreApproved = this.config.autoApprove.includes(request.capability);

      if (isPreApproved) {
        if (this.config.notify) {
          console.log(
            `✓ Auto-delegating to ${request.agentName} for ${request.capability} ($${request.estimatedCost})`
          );
        }
        return true;
      }

      // Not pre-approved - fall back to asking
      if (this.config.notify) {
        console.log('\n🤖 Relay Delegation Request (not pre-approved):');
        console.log(`   Capability: ${request.capability}`);
        console.log(`   Agent: ${request.agentName}`);
        console.log(`   Cost: $${request.estimatedCost}`);
        console.log('');
      }

      return await this.config.onDelegation(request);
    }

    return false;
  }

  /**
   * Get the Relay client (for advanced usage)
   */
  getClient(): Relay {
    return this.relay;
  }
}

/**
 * Anthropic SDK Wrapper - Explicit Relay Integration
 *
 * Usage:
 *   import Anthropic from '@anthropic-ai/sdk';
 *   import { withRelay } from 'relay-protocol/ai';
 *
 *   const ai = withRelay(new Anthropic({ apiKey }), {
 *     agentId: 'my-app-001',
 *     mode: 'ask',
 *     onDelegation: async (task) => {
 *       return await showUserApproval(task);
 *     }
 *   });
 */

import { RelayWrapper } from './with-relay';
import { RelayConfig } from './types';

export function withRelay(anthropicClient: any, config: RelayConfig): any {
  const relayWrapper = new RelayWrapper(config);

  // Return proxy that intercepts messages.create calls
  return new Proxy(anthropicClient, {
    get(target, prop) {
      if (prop === 'messages') {
        return new Proxy(target.messages, {
          get(messagesTarget, messagesProp) {
            if (messagesProp === 'create') {
              // Intercept messages.create to inject Relay tool
              return async (params: any) => {
                // Add delegation tool to tools array
                const tools = params.tools || [];
                const relayTool = relayWrapper.getDelegationTool();

                // Check if tool already exists
                const hasRelayTool = tools.some((t: any) => t.name === 'delegate_task');

                if (!hasRelayTool) {
                  tools.push(relayTool);
                }

                // Call original create with modified params
                const response = await messagesTarget.create({
                  ...params,
                  tools,
                });

                // Handle tool calls in response
                if (response.stop_reason === 'tool_use') {
                  const toolUses = response.content.filter((c: any) => c.type === 'tool_use');

                  for (const toolUse of toolUses) {
                    if (toolUse.name === 'delegate_task') {
                      // Execute delegation
                      const result = await relayWrapper.handleDelegation(toolUse.input);

                      // Add tool result to response content
                      response.content.push({
                        type: 'tool_result',
                        tool_use_id: toolUse.id,
                        content: JSON.stringify(result),
                      });
                    }
                  }
                }

                return response;
              };
            }

            return messagesTarget[messagesProp];
          },
        });
      }

      // Expose Relay client for advanced usage
      if (prop === '_relay') {
        return relayWrapper.getClient();
      }

      return target[prop];
    },
  });
}

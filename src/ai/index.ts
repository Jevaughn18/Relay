/**
 * Relay AI Wrappers - Explicit, Transparent Integration
 *
 * Add delegation capabilities to AI SDKs with user approval and transparency
 *
 * @example
 * ```typescript
 * import Anthropic from '@anthropic-ai/sdk';
 * import { withRelay } from 'relay-protocol/ai';
 *
 * const ai = withRelay(new Anthropic({ apiKey }), {
 *   agentId: 'pocketpal-001',
 *   mode: 'ask', // User approves each delegation
 *   maxSpend: 10,
 *   onDelegation: async (task) => {
 *     // Show UI approval dialog
 *     return await ui.confirmDelegation(task);
 *   }
 * });
 *
 * // Claude now has delegation capability (with user approval)
 * const response = await ai.messages.create({
 *   model: 'claude-3-5-sonnet-20241022',
 *   messages: [{ role: 'user', content: 'Book me a flight to LA' }]
 * });
 * ```
 */

export { withRelay } from './anthropic-wrapper';
export { RelayWrapper } from './with-relay';
export * from './types';

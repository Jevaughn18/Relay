/**
 * Example: PocketPal Integration with Relay
 *
 * Shows how to add explicit delegation capabilities to an AI app
 */

import Anthropic from '@anthropic-ai/sdk';
import { withRelay } from '../src/ai';

// Example UI notification system
const ui = {
  async showDelegationApproval(task: any): Promise<boolean> {
    console.log('\n┌─────────────────────────────────────────┐');
    console.log('│ 🤖 Delegation Request                   │');
    console.log('└─────────────────────────────────────────┘');
    console.log('');
    console.log(`  Claude wants to hire: ${task.agentName}`);
    console.log(`  Capability: ${task.capability}`);
    console.log(`  Cost: $${task.estimatedCost}`);
    console.log('');
    console.log('  [Y] Approve   [N] Deny');
    console.log('');

    // In real app, show UI dialog and wait for user input
    // For demo, auto-approve
    return true;
  },

  showDelegationComplete(task: any, result: any) {
    console.log('');
    console.log(`✓ Delegation complete - ${task.agentName} finished the task`);
    console.log('');
  },
};

// Initialize PocketPal with Relay
export async function startPocketPalWithRelay() {
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY || '',
  });

  // Wrap with Relay - explicit opt-in with user approval
  const ai = withRelay(anthropic, {
    agentId: 'pocketpal-001',
    mode: 'ask', // Ask user for approval on each delegation
    maxSpend: 10, // Max $10 per delegation
    notify: true, // Show console notifications

    // User approval callback
    onDelegation: async (task) => {
      return await ui.showDelegationApproval(task);
    },

    // Completion callback
    onComplete: (task, result) => {
      ui.showDelegationComplete(task, result);
    },

    // Error callback
    onError: (task, error) => {
      console.error(`❌ Delegation failed: ${error.message}`);
    },
  });

  // Now use the AI normally - delegation is available with user approval
  console.log('PocketPal started with Relay delegation enabled');
  console.log('Mode: Ask for approval on each delegation');
  console.log('Max spend: $10 per task');
  console.log('');

  // Example conversation
  const message = await ai.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: 'Can you search the web for the latest AI news?',
      },
    ],
  });

  console.log('Claude response:', message.content);
}

// Example: Auto-mode with pre-approved capabilities
export async function startPocketPalAutoMode() {
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY || '',
  });

  // Auto-approve certain safe capabilities
  const ai = withRelay(anthropic, {
    agentId: 'pocketpal-002',
    mode: 'auto',
    autoApprove: ['web_search', 'calculator', 'get_time'], // These can auto-delegate
    maxSpend: 5, // Lower limit for auto-approved tasks
    notify: true,

    // Only called for non-pre-approved capabilities
    onDelegation: async (task) => {
      console.log(`⚠ "${task.capability}" not pre-approved - asking user...`);
      return await ui.showDelegationApproval(task);
    },
  });

  console.log('PocketPal started with Relay (auto mode)');
  console.log('Pre-approved: web_search, calculator, get_time');
  console.log('Other tasks: Ask user');
  console.log('');

  const message = await ai.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: 'What time is it in Tokyo?',
      },
    ],
  });

  console.log('Claude response:', message.content);
}

// Run example
if (require.main === module) {
  console.log('');
  console.log('═══════════════════════════════════════════');
  console.log('  PocketPal + Relay Integration Example');
  console.log('═══════════════════════════════════════════');
  console.log('');

  // Make sure Relay is running
  console.log('⚠ Make sure Relay is running: relay start');
  console.log('');

  // Run ask mode example
  startPocketPalWithRelay().catch(console.error);
}

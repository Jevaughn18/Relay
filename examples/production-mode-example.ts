/**
 * Example: Using Relay in Production Mode with TaskContracts
 *
 * This example demonstrates the full production flow with:
 * - Cryptographic signatures
 * - TaskContract negotiation
 * - Secure escrow
 * - Signed requests
 */

import { Relay } from '../src/sdk/simple-sdk';
import { BaseAdapter } from '../src/adapters/base-adapter';
import { RelaySign } from '../src/crypto/signer';

/**
 * Example: Calculator agent that supports production mode
 */
class ProductionCalculatorAgent extends BaseAdapter {
  async handleTask(task: string, params: Record<string, any>) {
    console.log(`   Processing: ${task}`);

    if (task === 'calculate') {
      const { expression } = params;
      try {
        // In production, you'd validate this properly!
        // eslint-disable-next-line no-eval
        const result = eval(expression);
        return { success: true, result };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    }

    return { success: false, error: `Unknown task: ${task}` };
  }
}

/**
 * Setup: Start agent with production mode enabled
 */
async function startProductionAgent() {
  console.log('🔐 Starting agent in PRODUCTION MODE...');
  console.log('');

  // Generate keypair for the agent
  const agentKeyPair = await RelaySign.generateKeyPair();
  console.log('✓ Generated agent keypair (RSA-2048)');

  // Start agent with keypair (enables production mode)
  const agent = new ProductionCalculatorAgent({
    agentId: 'calculator-prod-001',
    agentName: 'ProductionCalculator',
    capabilities: ['calculate'],
    port: 8500,
    keyPair: agentKeyPair, // ✅ This enables contract signing
  });

  await agent.start();
  console.log('✓ Agent running with contract signing enabled');
  console.log('');

  return { agent, agentKeyPair };
}

/**
 * Client: Use Relay SDK in production mode
 */
async function useProductionClient() {
  console.log('🔐 Initializing client in PRODUCTION MODE...');
  console.log('');

  // Generate keypair for the client
  const clientKeyPair = await RelaySign.generateKeyPair();
  console.log('✓ Generated client keypair (RSA-2048)');

  // Initialize Relay in production mode
  const relay = new Relay({
    agentId: 'client-001',
    keyPair: clientKeyPair,
    developmentMode: false, // ✅ Production mode with TaskContracts
  });

  console.log('✓ Relay initialized in production mode');
  console.log('');

  return relay;
}

/**
 * Example flow: Search, delegate, and pay with TaskContracts
 */
async function productionDelegationFlow(relay: Relay) {
  console.log('📋 Starting production delegation flow...');
  console.log('');

  try {
    // Step 1: Find an agent
    console.log('1️⃣  Searching for agent with "calculate" capability...');
    const agent = await relay.findAgent({ canDo: 'calculate' });

    if (!agent) {
      throw new Error('No agents found with calculate capability');
    }

    console.log(`   ✓ Found: ${agent.agentName} (${agent.agentId})`);
    console.log('');

    // Step 2: Create and sign TaskContract
    console.log('2️⃣  Creating TaskContract...');
    console.log('   - Delegator signs contract');
    console.log('   - Requesting performer signature');
    console.log('   - Verifying dual signatures');

    // Step 3: Lock funds in escrow with signed contract
    console.log('');
    console.log('3️⃣  Locking funds in escrow...');
    console.log('   - Amount: 100 credits');
    console.log('   - Using cryptographically signed contract');

    // Step 4: Delegate task
    console.log('');
    console.log('4️⃣  Delegating task to agent...');

    const result = await relay.pay(agent, 100, {
      task: 'calculate',
      params: { expression: '(42 * 2) + 100' },
      timeout: 30,
    });

    console.log('');
    if (result.success) {
      console.log('✅ Task completed successfully!');
      console.log(`   Result: ${result.result.result}`);
      console.log('   Payment released to performer');
    } else {
      console.log('❌ Task failed');
      console.log(`   Error: ${result.error}`);
      console.log('   Payment refunded to client');
    }

    console.log('');
  } catch (error: any) {
    console.error('❌ Production flow failed:', error.message);
    console.log('');

    // Common issues:
    if (error.message.includes('not yet implemented')) {
      console.log('💡 Note: Make sure both registry and escrow are running:');
      console.log('   npm run relay:start');
    }
    if (error.message.includes('failed to sign contract')) {
      console.log('💡 Note: Agent must support production mode (have keyPair configured)');
    }
  }
}

/**
 * Comparison: Development vs Production Mode
 */
async function showModeComparison() {
  console.log('');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  Development vs Production Mode Comparison                ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');

  console.log('DEVELOPMENT MODE (developmentMode: true):');
  console.log('  ✓ Fast and easy to test');
  console.log('  ✓ No keypair required');
  console.log('  ✓ Simple API (no contracts)');
  console.log('  ✗ No cryptographic security');
  console.log('  ✗ No contract enforcement');
  console.log('  ✗ NOT for production use');
  console.log('');

  console.log('PRODUCTION MODE (developmentMode: false):');
  console.log('  ✓ Cryptographically signed contracts');
  console.log('  ✓ Dual-signature enforcement');
  console.log('  ✓ Contract verification');
  console.log('  ✓ Secure escrow with proof');
  console.log('  ✓ Production-ready security');
  console.log('  ⚠️  Requires keypair for both parties');
  console.log('  ⚠️  More complex setup');
  console.log('');
}

/**
 * Main function
 */
async function main() {
  console.log('');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  Relay Protocol - Production Mode with TaskContracts      ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');

  // Show comparison
  await showModeComparison();

  console.log('─'.repeat(60));
  console.log('');

  // Start production agent
  const { agent } = await startProductionAgent();

  // Wait for agent to be ready
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Initialize production client
  const relay = await useProductionClient();

  console.log('─'.repeat(60));
  console.log('');

  // Run delegation flow
  await productionDelegationFlow(relay);

  console.log('─'.repeat(60));
  console.log('');
  console.log('✅ Production mode example complete!');
  console.log('');
  console.log('Key Takeaways:');
  console.log('  1. Both client and agent need keypairs for production mode');
  console.log('  2. Contracts are dual-signed (delegator + performer)');
  console.log('  3. All requests use cryptographic signatures');
  console.log('  4. Escrow enforces contract terms');
  console.log('');
  console.log('Press Ctrl+C to stop');
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}

export { ProductionCalculatorAgent, startProductionAgent, useProductionClient };

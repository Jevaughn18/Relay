/**
 * Example: BaseAdapter with Signed Registration
 *
 * Demonstrates how to use BaseAdapter with cryptographic signatures
 * for production-ready agent deployment.
 */

import { BaseAdapter } from '../src/adapters/base-adapter';
import { RelaySign } from '../src/crypto/signer';

/**
 * Example: Simple calculator agent with signed registration
 */
class CalculatorAgent extends BaseAdapter {
  async handleTask(task: string, params: Record<string, any>) {
    if (task === 'add') {
      const { a, b } = params;
      return {
        success: true,
        result: a + b,
      };
    }

    if (task === 'multiply') {
      const { a, b } = params;
      return {
        success: true,
        result: a * b,
      };
    }

    if (task === 'power') {
      const { base, exponent } = params;
      return {
        success: true,
        result: Math.pow(base, exponent),
      };
    }

    return {
      success: false,
      error: `Unknown task: ${task}`,
    };
  }
}

/**
 * Example 1: Development mode (unsigned registration)
 */
async function developmentMode() {
  console.log('📝 Example 1: Development Mode (Unsigned)');
  console.log('─'.repeat(50));

  const agent = new CalculatorAgent({
    agentId: 'calculator-dev',
    agentName: 'CalculatorAgent-Dev',
    capabilities: ['add', 'multiply', 'power'],
    port: 8401,
    // No keyPair = unsigned registration (development only)
  });

  await agent.start();
  console.log('✓ Started in development mode (unsigned)');
  console.log('');
}

/**
 * Example 2: Production mode (signed registration)
 */
async function productionMode() {
  console.log('📝 Example 2: Production Mode (Signed)');
  console.log('─'.repeat(50));

  // Generate cryptographic keypair
  const keyPair = await RelaySign.generateKeyPair();
  console.log('✓ Generated RSA-2048 keypair');

  const agent = new CalculatorAgent({
    agentId: 'calculator-prod',
    agentName: 'CalculatorAgent-Prod',
    capabilities: ['add', 'multiply', 'power'],
    port: 8402,
    keyPair, // ✅ Registration will be cryptographically signed
  });

  await agent.start();
  console.log('✓ Started in production mode (signed)');
  console.log('');
}

/**
 * Example 3: Load existing keys
 */
async function loadExistingKeys() {
  console.log('📝 Example 3: Using Existing Keys');
  console.log('─'.repeat(50));

  // In production, you'd load keys from secure storage:
  // - Environment variables
  // - Key management service (AWS KMS, etc.)
  // - Encrypted config file

  const keyPair = {
    publicKey: process.env.RELAY_PUBLIC_KEY || '',
    privateKey: process.env.RELAY_PRIVATE_KEY || '',
  };

  if (!keyPair.publicKey || !keyPair.privateKey) {
    console.log('⚠️  No keys found in environment variables');
    console.log('   Set RELAY_PUBLIC_KEY and RELAY_PRIVATE_KEY');
    console.log('');
    return;
  }

  const agent = new CalculatorAgent({
    agentId: 'calculator-env',
    agentName: 'CalculatorAgent-Env',
    capabilities: ['add', 'multiply', 'power'],
    port: 8403,
    keyPair,
  });

  await agent.start();
  console.log('✓ Started with environment keys');
  console.log('');
}

/**
 * Main - Run all examples
 */
async function main() {
  console.log('');
  console.log('╔════════════════════════════════════════════════╗');
  console.log('║  BaseAdapter with Signed Registration         ║');
  console.log('╚════════════════════════════════════════════════╝');
  console.log('');

  // Run examples
  await developmentMode();
  await productionMode();
  await loadExistingKeys();

  console.log('─'.repeat(50));
  console.log('');
  console.log('Test the agents:');
  console.log('');
  console.log('# Development agent (unsigned):');
  console.log('curl -X POST http://localhost:8401/execute \\');
  console.log('  -H "Content-Type: application/json" \\');
  console.log('  -d \'{"task": "add", "params": {"a": 5, "b": 3}}\'');
  console.log('');
  console.log('# Production agent (signed):');
  console.log('curl -X POST http://localhost:8402/execute \\');
  console.log('  -H "Content-Type: application/json" \\');
  console.log('  -d \'{"task": "multiply", "params": {"a": 7, "b": 6}}\'');
  console.log('');
  console.log('Press Ctrl+C to stop');
  console.log('');
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}

export { CalculatorAgent };

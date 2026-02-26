#!/usr/bin/env node

/**
 * Relay CLI
 *
 * Command-line interface for the Relay Protocol
 */

import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'fs/promises';
import path from 'path';
import { RelayClient } from '../sdk/relay-client';
import { CapabilityManifest } from '../schemas/capability';

const program = new Command();

// Storage paths
const RELAY_DIR = path.join(process.env.HOME || '~', '.relay');
const KEYS_FILE = path.join(RELAY_DIR, 'keys.json');
const MANIFEST_FILE = path.join(RELAY_DIR, 'manifest.json');
const STATE_FILE = path.join(RELAY_DIR, 'state.json');
const CONTRACTS_DIR = path.join(RELAY_DIR, 'contracts');

/**
 * Ensure .relay directory exists
 */
async function ensureRelayDir(): Promise<void> {
  try {
    await fs.mkdir(RELAY_DIR, { recursive: true });
    await fs.mkdir(CONTRACTS_DIR, { recursive: true });
  } catch (error) {
    // Directory might already exist
  }
}

/**
 * Load or create Relay client
 */
async function loadClient(): Promise<RelayClient> {
  await ensureRelayDir();

  try {
    // Try to load existing keys
    const keysData = await fs.readFile(KEYS_FILE, 'utf-8');
    const { agentId, keyPair } = JSON.parse(keysData);

    const client = new RelayClient({ agentId, keyPair });

    // Try to load manifest
    try {
      const manifestData = await fs.readFile(MANIFEST_FILE, 'utf-8');
      const manifest = JSON.parse(manifestData) as CapabilityManifest;
      client.registerCapabilities(manifest);
    } catch {
      // No manifest yet
    }

    // Try to load state (balance)
    try {
      const stateData = await fs.readFile(STATE_FILE, 'utf-8');
      const state = JSON.parse(stateData);
      if (state.balance > 0) {
        client.depositFunds(state.balance);
      }
    } catch {
      // No state yet
    }

    return client;
  } catch {
    throw new Error(
      'No agent initialized. Run "relay init" first.'
    );
  }
}

/**
 * Save client state (balance)
 */
async function saveState(client: RelayClient): Promise<void> {
  const balance = client.getBalance();
  await fs.writeFile(STATE_FILE, JSON.stringify({ balance: balance.balance }, null, 2));
}

/**
 * Save keys to file
 */
async function saveKeys(agentId: string, keyPair: any): Promise<void> {
  await fs.writeFile(
    KEYS_FILE,
    JSON.stringify({ agentId, keyPair }, null, 2),
    'utf-8'
  );
}

/**
 * Save manifest to file
 */
async function saveManifest(manifest: CapabilityManifest): Promise<void> {
  await fs.writeFile(
    MANIFEST_FILE,
    JSON.stringify(manifest, null, 2),
    'utf-8'
  );
}

// CLI metadata
program
  .name('relay')
  .description('Relay Protocol - Decentralized task escrow for AI agents')
  .version('0.1.0');

// Init command
program
  .command('init')
  .description('Initialize a new Relay agent')
  .option('-n, --name <name>', 'Agent name')
  .action(async (options) => {
    await ensureRelayDir();

    const _agentName = options.name || 'MyAgent';

    console.log(chalk.blue('🚀 Initializing Relay agent...'));

    const agentId = `agent_${Date.now()}`;
    const client = new RelayClient({ agentId, autoGenerateKeys: false });
    const keyPair = await client.generateKeys();

    if (!keyPair.publicKey) {
      console.error(chalk.red('❌ Failed to generate keys'));
      process.exit(1);
    }

    // Save keys
    await saveKeys(agentId, keyPair);

    console.log(chalk.green('✅ Agent initialized successfully!'));
    console.log(chalk.gray(`Agent ID: ${agentId}`));
    console.log(chalk.gray(`Keys saved to: ${KEYS_FILE}`));
    console.log(chalk.yellow('\n⚠️  Next step: Register your capabilities with "relay register-capability"'));
  });

// Register capability command
program
  .command('register-capability')
  .description('Register agent capabilities')
  .argument('<file>', 'Path to capability manifest JSON file')
  .action(async (file) => {
    try {
      const client = await loadClient();

      // Read manifest file
      const manifestData = await fs.readFile(file, 'utf-8');
      const manifest = JSON.parse(manifestData) as CapabilityManifest;

      // Auto-populate agentId and timestamps
      manifest.agentId = client.getAgentId();
      manifest.createdAt = new Date();
      manifest.updatedAt = new Date();

      client.registerCapabilities(manifest);
      await saveManifest(manifest);

      console.log(chalk.green('✅ Capabilities registered successfully!'));
      console.log(chalk.gray(`Capabilities: ${manifest.capabilities.map(c => c.name).join(', ')}`));
    } catch (error) {
      console.error(chalk.red(`❌ Error: ${error}`));
      process.exit(1);
    }
  });

// Delegate task command
program
  .command('delegate')
  .description('Delegate a task to another agent')
  .argument('<file>', 'Path to task specification JSON file')
  .action(async (file) => {
    try {
      await loadClient();

      // Read task spec
      const taskData = await fs.readFile(file, 'utf-8');
      const taskSpec = JSON.parse(taskData);

      // TODO: Implement full delegation flow
      console.log(chalk.blue('📤 Delegating task...'));
      console.log(chalk.gray(`Capability: ${taskSpec.capabilityName}`));
      console.log(chalk.gray(`Payment: ${taskSpec.paymentAmount}`));

      console.log(chalk.yellow('\n⚠️  Task delegation not yet fully implemented'));
    } catch (error) {
      console.error(chalk.red(`❌ Error: ${error}`));
      process.exit(1);
    }
  });

// Verify command
program
  .command('verify')
  .description('Verify a task deliverable')
  .argument('<contract-id>', 'Contract ID to verify')
  .action(async (contractId) => {
    try {
      console.log(chalk.blue(`🔍 Verifying contract ${contractId}...`));
      console.log(chalk.yellow('\n⚠️  Verification not yet fully implemented'));
    } catch (error) {
      console.error(chalk.red(`❌ Error: ${error}`));
      process.exit(1);
    }
  });

// Settle command
program
  .command('settle')
  .description('Settle a contract and release funds')
  .argument('<contract-id>', 'Contract ID to settle')
  .action(async (contractId) => {
    try {
      console.log(chalk.blue(`💰 Settling contract ${contractId}...`));
      console.log(chalk.yellow('\n⚠️  Settlement not yet fully implemented'));
    } catch (error) {
      console.error(chalk.red(`❌ Error: ${error}`));
      process.exit(1);
    }
  });

// Reputation command
program
  .command('reputation')
  .description('View agent reputation')
  .argument('[agent-id]', 'Agent ID (defaults to current agent)')
  .action(async (agentId) => {
    try {
      const client = await loadClient();
      const reputation = client.getReputation(agentId);

      console.log(chalk.blue('📊 Agent Reputation'));
      console.log(chalk.gray('─'.repeat(50)));
      console.log(`Agent ID: ${reputation.agentId}`);
      console.log(`Overall Score: ${chalk.green((reputation.overallScore * 100).toFixed(1) + '%')}`);
      console.log(`Tier: ${reputation.tier || 'N/A'}`);
      console.log(`\nComponent Scores:`);
      console.log(`  Reliability: ${(reputation.reliabilityScore * 100).toFixed(1)}%`);
      console.log(`  Quality: ${(reputation.qualityScore * 100).toFixed(1)}%`);
      console.log(`  Speed: ${(reputation.speedScore * 100).toFixed(1)}%`);
      console.log(`  Trust: ${(reputation.trustScore * 100).toFixed(1)}%`);
      console.log(`\nTasks Completed: ${reputation.metrics.totalTasksCompleted}`);
      console.log(`Tasks Failed: ${reputation.metrics.totalTasksFailed}`);
      console.log(`SLA Compliance: ${reputation.metrics.slaMetCount}/${reputation.metrics.slaMetCount + reputation.metrics.slaMissedCount}`);
    } catch (error) {
      console.error(chalk.red(`❌ Error: ${error}`));
      process.exit(1);
    }
  });

// Balance command
program
  .command('balance')
  .description('View escrow balance')
  .action(async () => {
    try {
      const client = await loadClient();
      const balance = client.getBalance();

      console.log(chalk.blue('💰 Escrow Balance'));
      console.log(chalk.gray('─'.repeat(50)));
      console.log(`Total Balance: ${chalk.green(balance.balance.toFixed(2))} credits`);
      console.log(`Available: ${chalk.green(balance.available.toFixed(2))} credits`);
      console.log(`Locked: ${chalk.yellow(balance.locked.toFixed(2))} credits`);
    } catch (error) {
      console.error(chalk.red(`❌ Error: ${error}`));
      process.exit(1);
    }
  });

// Deposit command
program
  .command('deposit')
  .description('Deposit funds into escrow')
  .argument('<amount>', 'Amount to deposit')
  .action(async (amount) => {
    try {
      const client = await loadClient();
      const depositAmount = parseFloat(amount);

      if (isNaN(depositAmount) || depositAmount <= 0) {
        throw new Error('Invalid deposit amount');
      }

      client.depositFunds(depositAmount);
      await saveState(client);

      console.log(chalk.green(`✅ Deposited ${depositAmount} credits`));

      const balance = client.getBalance();
      console.log(chalk.gray(`New balance: ${balance.balance.toFixed(2)} credits`));
    } catch (error) {
      console.error(chalk.red(`❌ Error: ${error}`));
      process.exit(1);
    }
  });

// Status command
program
  .command('status')
  .description('Show agent status')
  .action(async () => {
    try {
      const client = await loadClient();
      const manifest = client.getManifest();
      const balance = client.getBalance();
      const reputation = client.getReputation();

      console.log(chalk.blue('🤖 Agent Status'));
      console.log(chalk.gray('─'.repeat(50)));
      console.log(`Agent ID: ${(client as any).agentId}`);
      console.log(`Name: ${manifest?.agentName || 'Not set'}`);
      console.log(`Capabilities: ${manifest?.capabilities.length || 0}`);
      console.log(`Balance: ${balance.balance.toFixed(2)} credits`);
      console.log(`Reputation: ${(reputation.overallScore * 100).toFixed(1)}%`);
      console.log(`Tier: ${reputation.tier || 'N/A'}`);
    } catch (error) {
      console.error(chalk.red(`❌ Error: ${error}`));
      process.exit(1);
    }
  });

// Parse command line arguments
program.parse();

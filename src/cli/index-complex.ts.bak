#!/usr/bin/env node

/**
 * Relay CLI - Simple and intuitive
 */

import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'fs/promises';
import path from 'path';
import { RelayClient } from '../sdk/relay-client';
import { CapabilityManifest } from '../schemas/capability';
import { KeyPair } from '../crypto/signer';
import { runOnboarding, setupAgent } from './onboarding';
import { AgentServer } from '../network/agent-server';
import { RegistryServer } from '../discovery/registry-server';
import { SharedEscrowClient, SharedEscrowServer } from '../escrow';
import { createSignedHeaders } from '../network/request-auth';

const program = new Command();

// Storage paths
const RELAY_DIR = path.join(process.env.HOME || '~', '.relay');
const CONFIG_FILE = path.join(RELAY_DIR, 'config.json');
const KEYS_FILE = path.join(RELAY_DIR, 'keys.json');
const STATE_FILE = path.join(RELAY_DIR, 'state.json');
const MANIFEST_FILE = path.join(RELAY_DIR, 'manifest.json');
const DEFAULT_SHARED_ESCROW_STATE = path.join(RELAY_DIR, 'shared-escrow-state.json');

interface RelayConfig {
  agentId: string;
  agentName: string;
  mode: string;
  storage: string;
  networking: string;
  sharedEscrowUrl?: string | null;
  createdAt: string;
}

interface AgentIdentity {
  agentId: string;
  keyPair: KeyPair;
}

/**
 * Check if Relay is initialized
 */
async function isInitialized(): Promise<boolean> {
  try {
    await fs.access(CONFIG_FILE);
    return true;
  } catch {
    return false;
  }
}

/**
 * Normalize manifest loaded from JSON (dates are persisted as strings)
 */
function normalizeManifest(raw: CapabilityManifest): CapabilityManifest {
  return {
    ...raw,
    createdAt: new Date(raw.createdAt as unknown as string),
    updatedAt: new Date(raw.updatedAt as unknown as string),
  };
}

async function loadConfig(): Promise<RelayConfig> {
  const configData = await fs.readFile(CONFIG_FILE, 'utf-8');
  return JSON.parse(configData) as RelayConfig;
}

function getSharedEscrowClient(config: RelayConfig): SharedEscrowClient | undefined {
  return config.sharedEscrowUrl
    ? new SharedEscrowClient({ baseUrl: config.sharedEscrowUrl })
    : undefined;
}

function getSharedEscrowClientForIdentity(
  config: RelayConfig,
  identity: AgentIdentity
): SharedEscrowClient | undefined {
  if (!config.sharedEscrowUrl) {
    return undefined;
  }
  return new SharedEscrowClient({
    baseUrl: config.sharedEscrowUrl,
    agentId: identity.agentId,
    privateKey: identity.keyPair.privateKey,
    publicKey: identity.keyPair.publicKey,
  });
}

async function loadIdentity(): Promise<AgentIdentity> {
  const keysData = await fs.readFile(KEYS_FILE, 'utf-8');
  const { agentId, keyPair } = JSON.parse(keysData);
  return { agentId, keyPair };
}

function buildSignedRequestInit(
  identity: AgentIdentity,
  method: 'POST',
  path: string,
  payload: Record<string, unknown>
) {
  const rawBody = JSON.stringify(payload);
  const authHeaders = createSignedHeaders({
    agentId: identity.agentId,
    privateKey: identity.keyPair.privateKey,
    publicKey: identity.keyPair.publicKey,
    method,
    path,
    rawBody,
  });

  return {
    rawBody,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
    },
  };
}

/**
 * Load Relay client
 */
async function loadClient(): Promise<RelayClient> {
  if (!(await isInitialized())) {
    console.error(chalk.red('❌ Relay not initialized.'));
    console.log(chalk.gray('Run: ') + chalk.cyan('relay') + chalk.gray(' (with no arguments)'));
    process.exit(1);
  }

  try {
    const config = await loadConfig();
    const identity = await loadIdentity();
    const sharedEscrowClient = getSharedEscrowClientForIdentity(config, identity);

    // Load keys
    const { agentId, keyPair } = identity;

    const client = new RelayClient({ agentId, keyPair, sharedEscrowClient });

    // Load state (balance)
    if (!sharedEscrowClient) {
      try {
        const stateData = await fs.readFile(STATE_FILE, 'utf-8');
        const state = JSON.parse(stateData);
        if (state.balance > 0) {
          client.depositFunds(state.balance);
        }
      } catch {
        // No state yet
      }
    }

    // Load manifest (capabilities)
    try {
      const manifestData = await fs.readFile(MANIFEST_FILE, 'utf-8');
      const manifest = normalizeManifest(JSON.parse(manifestData) as CapabilityManifest);
      if (manifest.capabilities.length > 0) {
        client.registerCapabilities(manifest);
      }
    } catch (error) {
      // No manifest yet, or invalid manifest format.
      // Keep running, but make this visible so users don't lose capabilities silently.
      console.warn(chalk.yellow(`⚠️  Failed to load manifest from disk: ${error}`));
    }

    return client;
  } catch (error) {
    console.error(chalk.red(`❌ Failed to load agent: ${error}`));
    process.exit(1);
  }
}

/**
 * Save client state
 */
async function saveState(client: RelayClient): Promise<void> {
  const balance = client.getBalance();
  await fs.writeFile(STATE_FILE, JSON.stringify({ balance: balance.balance }, null, 2));
}

/**
 * Save manifest
 */
async function saveManifest(manifest: CapabilityManifest): Promise<void> {
  await fs.writeFile(MANIFEST_FILE, JSON.stringify(manifest, null, 2));
}

// CLI Configuration
program
  .name('relay')
  .description('Relay Protocol - Decentralized AI agent marketplace')
  .version('0.1.0');

// ============================================================================
// INIT COMMAND - Interactive onboarding
// ============================================================================
program
  .command('init')
  .description('Initialize Relay with interactive setup')
  .option('--force', 'Force re-initialization')
  .action(async (options) => {
    if ((await isInitialized()) && !options.force) {
      console.log(chalk.yellow('⚠️  Relay is already initialized.'));
      console.log(chalk.gray('Use --force to reinitialize.'));
      return;
    }

    const config = await runOnboarding();
    await setupAgent(config, RELAY_DIR);
  });

// ============================================================================
// STATUS COMMAND - Show everything
// ============================================================================
program
  .command('status')
  .description('Show agent status')
  .action(async () => {
    const client = await loadClient();
    const config = await loadConfig();
    const balance = config.sharedEscrowUrl ? await client.getBalanceShared() : client.getBalance();
    const manifest = client.getManifest();

    console.log('');
    console.log(chalk.cyan('  Agent Status'));
    console.log(chalk.dim('  ─────────────────────────────────────────'));
    console.log('');
    console.log(chalk.dim('  Name:    ') + chalk.white(config.agentName));
    console.log(chalk.dim('  ID:      ') + chalk.dim(client.getAgentId().substring(0, 20) + '...'));
    console.log(chalk.dim('  Balance: ') + chalk.green(`${balance.balance.toFixed(0)} credits`) + chalk.dim(` (${balance.locked.toFixed(0)} locked)`));
    console.log(chalk.dim('  Skills:  ') + chalk.cyan(manifest?.capabilities.length || 0));

    if (manifest && manifest.capabilities.length > 0) {
      console.log('');
      manifest.capabilities.forEach((cap) => {
        console.log(chalk.dim('  •') + chalk.white(` ${cap.name}`) + chalk.dim(` (${cap.baseCost} credits)`));
      });
    }

    console.log('');
  });

// ============================================================================
// BALANCE COMMAND - Show detailed balance
// ============================================================================
program
  .command('balance')
  .description('Show balance details')
  .action(async () => {
    const client = await loadClient();
    const config = await loadConfig();
    const balance = config.sharedEscrowUrl ? await client.getBalanceShared() : client.getBalance();

    console.log(chalk.blue.bold('\n💰 Balance'));
    console.log(chalk.gray('─'.repeat(50)));
    console.log(chalk.white('Total:     ') + chalk.green(`${balance.balance.toFixed(2)} credits`));
    console.log(
      chalk.white('Available: ') + chalk.green(`${balance.available.toFixed(2)} credits`)
    );
    console.log(chalk.white('Locked:    ') + chalk.yellow(`${balance.locked.toFixed(2)} credits`));
    if (config.sharedEscrowUrl) {
      console.log(chalk.white('Escrow:    ') + chalk.cyan(config.sharedEscrowUrl));
    }
    console.log('');
  });

// ============================================================================
// DEPOSIT COMMAND - Add funds
// ============================================================================
program
  .command('deposit')
  .description('Deposit funds')
  .argument('<amount>', 'Amount to deposit')
  .action(async (amount) => {
    const client = await loadClient();
    const config = await loadConfig();
    const depositAmount = parseFloat(amount);

    if (isNaN(depositAmount) || depositAmount <= 0) {
      console.error(chalk.red('❌ Invalid amount'));
      process.exit(1);
    }

    if (config.sharedEscrowUrl) {
      await client.depositFundsShared(depositAmount);
    } else {
      client.depositFunds(depositAmount);
      await saveState(client);
    }

    const balance = config.sharedEscrowUrl ? await client.getBalanceShared() : client.getBalance();
    console.log(chalk.green(`✅ Deposited ${depositAmount} credits`));
    console.log(chalk.gray(`New balance: ${balance.balance.toFixed(2)} credits`));
  });

// ============================================================================
// CAPABILITY ADD - Interactive capability builder
// ============================================================================
program
  .command('capability:add')
  .description('Add a new capability interactively')
  .action(async () => {
    const inquirer = (await import('inquirer')).default;
    const client = await loadClient();
    let manifest = client.getManifest();

    if (!manifest) {
      const configData = await fs.readFile(CONFIG_FILE, 'utf-8');
      const config = JSON.parse(configData);

      manifest = {
        agentId: client.getAgentId(),
        agentName: config.agentName,
        version: '1.0.0',
        capabilities: [],
        sandboxLevel: 'isolated' as any,
        verificationMode: 'automated' as any,
        maxConcurrentTasks: 5,
        minReputationRequired: 0,
        acceptsDisputes: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }

    console.log(chalk.blue('\n➕ Add New Capability\n'));

    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: 'Capability name (lowercase, underscores ok):',
        validate: (input: string) => {
          if (!input) return 'Name is required';
          const cleaned = input.toLowerCase().replace(/\s+/g, '_');
          if (!/^[a-z0-9_]+$/.test(cleaned)) {
            return 'Use only letters, numbers, and underscores';
          }
          return true;
        },
        filter: (input: string) => input.toLowerCase().replace(/\s+/g, '_'),
      },
      {
        type: 'input',
        name: 'description',
        message: 'Description:',
        validate: (input: string) => input.length > 0 || 'Description is required',
      },
      {
        type: 'number',
        name: 'baseCost',
        message: 'Price per execution (credits):',
        default: 25,
        validate: (input: number) => input > 0 || 'Cost must be positive',
      },
      {
        type: 'number',
        name: 'estimatedDurationSeconds',
        message: 'Estimated duration (seconds):',
        default: 10,
      },
    ]);

    // Add capability
    manifest.capabilities.push({
      name: answers.name,
      description: answers.description,
      inputSchema: { type: 'object', properties: {}, required: [] },
      outputSchema: { type: 'object', properties: {} },
      baseCost: answers.baseCost,
      estimatedDurationSeconds: answers.estimatedDurationSeconds,
      slaGuaranteeSeconds: answers.estimatedDurationSeconds * 3,
    });

    manifest.updatedAt = new Date();

    client.registerCapabilities(manifest);
    await saveManifest(manifest);

    console.log(chalk.green(`\n✅ Added capability: ${answers.name}`));
    console.log(chalk.gray(`Total capabilities: ${manifest.capabilities.length}\n`));
  });

// ============================================================================
// CAPABILITY LIST - Show all capabilities
// ============================================================================
program
  .command('capability:list')
  .description('List all capabilities')
  .action(async () => {
    const client = await loadClient();
    const manifest = client.getManifest();

    if (!manifest || manifest.capabilities.length === 0) {
      console.log(chalk.yellow('\n⚠️  No capabilities registered yet.'));
      console.log(chalk.gray('Add one with: ') + chalk.cyan('relay capability:add\n'));
      return;
    }

    console.log(chalk.blue.bold('\n📋 Capabilities\n'));
    manifest.capabilities.forEach((cap, i) => {
      console.log(chalk.cyan(`${i + 1}. ${cap.name}`));
      console.log(chalk.gray(`   ${cap.description}`));
      console.log(chalk.gray(`   Price: ${cap.baseCost} credits`));
      console.log('');
    });
  });

// ============================================================================
// CONFIG - Show configuration
// ============================================================================
program
  .command('config')
  .description('Show configuration')
  .action(async () => {
    if (!(await isInitialized())) {
      console.error(chalk.red('❌ Relay not initialized.'));
      return;
    }

    const configData = await fs.readFile(CONFIG_FILE, 'utf-8');
    const config = JSON.parse(configData);

    console.log(chalk.blue.bold('\n⚙️  Configuration\n'));
    console.log(chalk.white('Agent Name:  ') + chalk.cyan(config.agentName));
    console.log(chalk.white('Agent ID:    ') + chalk.gray(config.agentId));
    console.log(chalk.white('Mode:        ') + chalk.cyan(config.mode));
    console.log(chalk.white('Storage:     ') + chalk.cyan(config.storage));
    console.log(chalk.white('Networking:  ') + chalk.cyan(config.networking));
    console.log(
      chalk.white('Shared Escrow: ') +
        chalk.cyan(config.sharedEscrowUrl || '(not configured)')
    );
    console.log(chalk.white('Created:     ') + chalk.gray(config.createdAt));
    console.log('');
  });

// ============================================================================
// ESCROW START - Run a shared escrow server
// ============================================================================
program
  .command('escrow:start')
  .description('Start shared escrow service for multi-agent credits')
  .option('--host <host>', 'Host to bind', '127.0.0.1')
  .option('--port <port>', 'Port to bind', '9010')
  .option('--state-file <path>', 'Ledger state file path', DEFAULT_SHARED_ESCROW_STATE)
  .action(async (options) => {
    const port = parseInt(options.port, 10);
    if (isNaN(port) || port <= 0) {
      console.error(chalk.red('❌ Invalid port'));
      process.exit(1);
    }

    const server = new SharedEscrowServer({
      host: options.host,
      port,
      stateFile: options.stateFile,
      requireSignedRequests: true,
    });

    await server.start();

    const shutdown = async () => {
      await server.stop();
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
    await new Promise(() => {});
  });

// ============================================================================
// ESCROW USE - Configure shared escrow URL for this agent profile
// ============================================================================
program
  .command('escrow:use')
  .description('Set shared escrow URL for this agent profile')
  .argument('<url>', 'Shared escrow base URL (e.g. http://127.0.0.1:9010)')
  .action(async (url) => {
    if (!(await isInitialized())) {
      console.error(chalk.red('❌ Relay not initialized.'));
      process.exit(1);
    }

    const config = await loadConfig();
    config.sharedEscrowUrl = url;
    await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2));
    console.log(chalk.green(`✅ Shared escrow configured: ${url}`));
  });

// ============================================================================
// ESCROW LOCAL - Disable shared escrow and use local wallet state
// ============================================================================
program
  .command('escrow:local')
  .description('Disable shared escrow for this agent profile')
  .action(async () => {
    if (!(await isInitialized())) {
      console.error(chalk.red('❌ Relay not initialized.'));
      process.exit(1);
    }

    const config = await loadConfig();
    config.sharedEscrowUrl = null;
    await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2));
    console.log(chalk.green('✅ Switched to local in-process escrow'));
  });

// ============================================================================
// REGISTRY START - Run local discovery registry
// ============================================================================
program
  .command('registry:start')
  .description('Start a discovery registry server')
  .option('--host <host>', 'Host to bind', '127.0.0.1')
  .option('--port <port>', 'Port to bind', '9001')
  .action(async (options) => {
    const port = parseInt(options.port, 10);
    if (isNaN(port) || port <= 0) {
      console.error(chalk.red('❌ Invalid port'));
      process.exit(1);
    }

    const registry = new RegistryServer({
      host: options.host,
      port,
      staleCheckInterval: 5,
      requireSignedRequests: true,
    });

    await registry.start();

    const shutdown = async () => {
      await registry.stop();
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

    // Keep process alive
    await new Promise(() => {});
  });

// ============================================================================
// REGISTRY REGISTER - Register current agent with a registry
// ============================================================================
program
  .command('registry:register')
  .description('Register this agent on a discovery registry')
  .requiredOption('--endpoint <url>', 'Public endpoint for this agent (e.g. http://host:8001)')
  .option('--registry <url>', 'Registry base URL', 'http://127.0.0.1:9001')
  .action(async (options) => {
    const client = await loadClient();
    const identity = await loadIdentity();
    const manifest = client.getManifest();
    if (!manifest || manifest.capabilities.length === 0) {
      console.error(chalk.red('❌ No capabilities found. Add one with: relay capability:add'));
      process.exit(1);
    }

    const payload = {
      agentId: client.getAgentId(),
      agentName: manifest.agentName,
      endpoint: options.endpoint,
      manifest,
    };
    const signed = buildSignedRequestInit(identity, 'POST', '/register', payload);
    const response = await fetch(`${options.registry}/register`, {
      method: 'POST',
      headers: signed.headers,
      body: signed.rawBody,
    });

    if (!response.ok) {
      const body = await response.text();
      console.error(chalk.red(`❌ Registry registration failed: ${body}`));
      process.exit(1);
    }

    console.log(chalk.green('✅ Agent registered on discovery registry'));
    console.log(chalk.gray(`Registry: ${options.registry}`));
    console.log(chalk.gray(`Endpoint: ${options.endpoint}`));
  });

// ============================================================================
// DISCOVER - Find agents by capability from registry
// ============================================================================
program
  .command('discover')
  .description('Discover agents by capability')
  .argument('<capability>', 'Capability name (e.g. summarize_text)')
  .option('--registry <url>', 'Registry base URL', 'http://127.0.0.1:9001')
  .option('--max-cost <credits>', 'Maximum base cost')
  .action(async (capability, options) => {
    const body: Record<string, unknown> = {
      capability,
      availableOnly: true,
    };

    if (options.maxCost !== undefined) {
      const maxCost = parseFloat(options.maxCost);
      if (isNaN(maxCost) || maxCost < 0) {
        console.error(chalk.red('❌ --max-cost must be a non-negative number'));
        process.exit(1);
      }
      body.maxCost = maxCost;
    }

    const response = await fetch(`${options.registry}/discover`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(chalk.red(`❌ Discovery failed: ${errorBody}`));
      process.exit(1);
    }

    const result = (await response.json()) as {
      agents: Array<{ agentId: string; agentName: string; endpoint: string; baseCost?: number }>;
      count: number;
    };

    if (result.count === 0) {
      console.log(chalk.yellow('\n⚠️  No matching agents found.\n'));
      return;
    }

    console.log(chalk.blue.bold(`\n🔎 Found ${result.count} agent(s)\n`));
    result.agents.forEach((agent, i) => {
      const cost = agent.baseCost !== undefined ? `${agent.baseCost} credits` : 'n/a';
      console.log(chalk.cyan(`${i + 1}. ${agent.agentName}`));
      console.log(chalk.gray(`   ID: ${agent.agentId}`));
      console.log(chalk.gray(`   Endpoint: ${agent.endpoint}`));
      console.log(chalk.gray(`   Base Cost: ${cost}`));
      console.log('');
    });
  });

// ============================================================================
// SERVE - Run this agent's HTTP endpoint for real A2A traffic
// ============================================================================
program
  .command('serve')
  .description('Serve this agent over HTTP for other agents')
  .option('--host <host>', 'Host to bind', '127.0.0.1')
  .option('--port <port>', 'Port to bind', '8001')
  .option('--registry <url>', 'Registry base URL (auto-register + heartbeat)')
  .action(async (options) => {
    const client = await loadClient();
    const identity = await loadIdentity();
    const manifest = client.getManifest();
    if (!manifest || manifest.capabilities.length === 0) {
      console.error(chalk.red('❌ No capabilities found. Add one with: relay capability:add'));
      process.exit(1);
    }

    const port = parseInt(options.port, 10);
    if (isNaN(port) || port <= 0) {
      console.error(chalk.red('❌ Invalid port'));
      process.exit(1);
    }

    const server = new AgentServer({
      host: options.host,
      port,
      agentId: client.getAgentId(),
      client,
    });

    await server.start();

    let heartbeatTimer: NodeJS.Timeout | undefined;
    if (options.registry) {
      const endpoint = `http://${options.host}:${port}`;
      const payload = {
        agentId: client.getAgentId(),
        agentName: manifest.agentName,
        endpoint,
        manifest,
      };
      const signedRegister = buildSignedRequestInit(identity, 'POST', '/register', payload);
      const registerResponse = await fetch(`${options.registry}/register`, {
        method: 'POST',
        headers: signedRegister.headers,
        body: signedRegister.rawBody,
      });

      if (!registerResponse.ok) {
        const text = await registerResponse.text();
        console.error(chalk.red(`❌ Failed to register with registry: ${text}`));
        process.exit(1);
      }

      console.log(chalk.green(`✅ Registered with registry: ${options.registry}`));
      heartbeatTimer = setInterval(async () => {
        try {
          const heartbeatPayload = { agentId: client.getAgentId() };
          const signedHeartbeat = buildSignedRequestInit(
            identity,
            'POST',
            '/heartbeat',
            heartbeatPayload
          );
          await fetch(`${options.registry}/heartbeat`, {
            method: 'POST',
            headers: signedHeartbeat.headers,
            body: signedHeartbeat.rawBody,
          });
        } catch {
          // Keep serving even if registry heartbeat temporarily fails.
        }
      }, 30000);
    }

    const shutdown = async () => {
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
      }
      await server.stop();
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

    await new Promise(() => {});
  });

// ============================================================================
// DEFAULT ACTION - When no command provided (just "relay")
// ============================================================================
program.action(async () => {
  if (!(await isInitialized())) {
    // First time - run setup
    const config = await runOnboarding();
    await setupAgent(config, RELAY_DIR);

    // Show what to do next
    console.log(chalk.cyan('  ┌─────────────────────────────────────────────┐'));
    console.log(chalk.cyan('  │') + chalk.bold(' Quick Start                               ') + chalk.cyan('│'));
    console.log(chalk.cyan('  └─────────────────────────────────────────────┘'));
    console.log('');
    console.log(chalk.dim('  Run ') + chalk.cyan('relay') + chalk.dim(' anytime to see this menu'));
    console.log('');
    console.log(chalk.dim('  What to do next:'));
    console.log('');
    console.log(chalk.cyan('    relay capability:add'));
    console.log(chalk.dim('      → Define what your agent can do (e.g., "summarize_text")'));
    console.log('');
    console.log(chalk.cyan('    relay deposit 500'));
    console.log(chalk.dim('      → Add more credits to your wallet'));
    console.log('');
  } else {
    // Already initialized - show status
    const client = await loadClient();
    const config = await loadConfig();
    const balance = config.sharedEscrowUrl ? await client.getBalanceShared() : client.getBalance();
    const manifest = client.getManifest();

    console.log('');
    console.log(chalk.cyan('  ┌─────────────────────────────────────────────┐'));
    console.log(chalk.cyan('  │') + chalk.bold(` ${config.agentName.padEnd(43)}`) + chalk.cyan('│'));
    console.log(chalk.cyan('  └─────────────────────────────────────────────┘'));
    console.log('');
    console.log(chalk.dim('  Balance: ') + chalk.green(`${balance.balance.toFixed(0)} credits`));
    if (config.sharedEscrowUrl) {
      console.log(chalk.dim('  Shared Escrow: ') + chalk.cyan(config.sharedEscrowUrl));
    }
    console.log(chalk.dim('  Capabilities: ') + chalk.cyan(manifest?.capabilities.length || 0));

    if (manifest && manifest.capabilities.length > 0) {
      console.log('');
      manifest.capabilities.slice(0, 3).forEach((cap) => {
        console.log(chalk.dim('  •') + chalk.white(` ${cap.name}`) + chalk.dim(` (${cap.baseCost} credits)`));
      });
      if (manifest.capabilities.length > 3) {
        console.log(chalk.dim(`  ... ${manifest.capabilities.length - 3} more`));
      }
    }

    console.log('');
    console.log(chalk.dim('  Available commands:'));
    console.log('');
    console.log(chalk.cyan('    relay capability:add'));
    console.log(chalk.dim('      → Add a new capability your agent can perform'));
    console.log('');
    console.log(chalk.cyan('    relay capability:list'));
    console.log(chalk.dim('      → Show all capabilities you\'ve registered'));
    console.log('');
    console.log(chalk.cyan('    relay deposit <amount>'));
    console.log(chalk.dim('      → Add credits to your wallet (e.g., relay deposit 500)'));
    console.log('');
    console.log(chalk.cyan('    relay config'));
    console.log(chalk.dim('      → View your agent configuration and settings'));
    console.log('');
    console.log(chalk.cyan('    relay registry:start --port 9001'));
    console.log(chalk.dim('      → Start local discovery for real multi-agent routing'));
    console.log('');
    console.log(chalk.cyan('    relay serve --port 8001 --registry http://127.0.0.1:9001'));
    console.log(chalk.dim('      → Run this agent endpoint and auto-register'));
    console.log('');
    console.log(chalk.cyan('    relay discover <capability> --registry http://127.0.0.1:9001'));
    console.log(chalk.dim('      → Find other agents by capability'));
    console.log('');
    console.log(chalk.cyan('    relay escrow:start --port 9010'));
    console.log(chalk.dim('      → Start shared credits escrow service'));
    console.log('');
    console.log(chalk.cyan('    relay escrow:use http://127.0.0.1:9010'));
    console.log(chalk.dim('      → Use shared escrow so credits work across agents'));
    console.log('');
  }
});

program.parse();

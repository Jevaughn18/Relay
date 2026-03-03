/**
 * Interactive onboarding for new users
 */

import inquirer from 'inquirer';
import chalk from 'chalk';
import fs from 'fs/promises';
import path from 'path';
import { RelayClient } from '../sdk/relay-client';
import { CapabilityManifest, SandboxLevel, VerificationMode } from '../schemas/capability';
import { ensureToken } from '../dashboard/auth';

export interface OnboardingConfig {
  agentName: string;
  mode: 'embedded' | 'sidecar';
  storage: 'local' | 'remote';
  networking: 'local' | 'a2a';
  initialBalance: number;
  sharedEscrowUrl?: string;
}

export async function runOnboarding(): Promise<OnboardingConfig> {
  // Header
  console.log('');
  console.log(chalk.cyan('┌─────────────────────────────────────────────────┐'));
  console.log(chalk.cyan('│') + chalk.bold('  Welcome to Relay Protocol                    ') + chalk.cyan('│'));
  console.log(chalk.cyan('│') + '  Decentralized AI Agent Marketplace            ' + chalk.cyan('│'));
  console.log(chalk.cyan('└─────────────────────────────────────────────────┘'));
  console.log('');
  console.log(chalk.dim('  Setting up your agent (takes ~5 seconds)'));
  console.log('');

  // Just ask for agent name - everything else uses smart defaults
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'agentName',
      message: 'What should we call your agent?',
      default: 'MyAgent',
      validate: (input: string) => input.length > 0 || 'Agent name is required',
    },
  ]);

  // Auto-configure with sensible defaults
  return {
    agentName: answers.agentName,
    mode: 'embedded',
    storage: 'local',
    networking: 'local',
    initialBalance: 1000,
  } as OnboardingConfig;
}

export async function setupAgent(config: OnboardingConfig, relayDir: string): Promise<RelayClient> {
  console.log('');
  console.log(chalk.dim('  Setting up your agent...'));
  console.log('');

  // 1. Create directories
  const keysDir = path.join(relayDir, 'keys');
  const logsDir = path.join(relayDir, 'logs');
  await fs.mkdir(relayDir, { recursive: true });
  await fs.mkdir(keysDir, { recursive: true });
  await fs.mkdir(logsDir, { recursive: true });

  console.log(chalk.dim('  ✓ Created directories'));

  // 2. Generate agent and keys
  const agentId = `agent_${Date.now()}`;
  const client = new RelayClient({ agentId, autoGenerateKeys: false });
  const keyPair = await client.generateKeys();

  console.log(chalk.dim('  ✓ Generated RSA keypair'));

  // 3. Deposit initial balance
  if (config.initialBalance > 0) {
    client.depositFunds(config.initialBalance);
    console.log(chalk.dim(`  ✓ Added ${config.initialBalance} credits to wallet`));
  }

  // 4. Save config
  const fullConfig = {
    agentId,
    agentName: config.agentName,
    mode: config.mode,
    storage: config.storage,
    networking: config.networking,
    sharedEscrowUrl: config.sharedEscrowUrl || null,
    createdAt: new Date().toISOString(),
  };

  await fs.writeFile(
    path.join(relayDir, 'config.json'),
    JSON.stringify(fullConfig, null, 2)
  );

  // 5. Save keys
  await fs.writeFile(
    path.join(relayDir, 'keys.json'),
    JSON.stringify({ agentId, keyPair }, null, 2)
  );

  // 6. Save state
  const balance = client.getBalance();
  await fs.writeFile(
    path.join(relayDir, 'state.json'),
    JSON.stringify({ balance: balance.balance }, null, 2)
  );

  console.log(chalk.dim('  ✓ Saved configuration'));

  // 7. Generate dashboard token
  const dashboardToken = ensureToken();
  console.log(chalk.dim('  ✓ Generated dashboard token'));

  // 8. Create default manifest (empty)
  const manifest: CapabilityManifest = {
    agentId,
    agentName: config.agentName,
    version: '1.0.0',
    capabilities: [],
    sandboxLevel: SandboxLevel.ISOLATED,
    verificationMode: VerificationMode.AUTOMATED,
    maxConcurrentTasks: 5,
    minReputationRequired: 0,
    acceptsDisputes: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await fs.writeFile(
    path.join(relayDir, 'manifest.json'),
    JSON.stringify(manifest, null, 2)
  );

  // Success message
  console.log('');
  console.log(chalk.green('  ✓ Relay is ready!'));
  console.log('');
  console.log(chalk.dim(`  Agent: ${config.agentName}`));
  console.log(chalk.dim(`  Balance: ${config.initialBalance} credits`));
  console.log(chalk.dim(`  Dashboard Token: ${dashboardToken}`));
  console.log('');
  console.log(chalk.yellow('  💡 Save this token - you\'ll need it to access the dashboard'));
  console.log('');

  // Ask if user wants to auto-start the stack
  const { autoStart } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'autoStart',
      message: 'Start the full stack now? (Registry + Escrow + Dashboard)',
      default: true,
    },
  ]);

  if (autoStart) {
    console.log('');
    console.log(chalk.dim('  Starting Relay stack...'));
    console.log('');
    console.log(chalk.cyan('  ┌─────────────────────────────────────────────┐'));
    console.log(chalk.cyan('  │') + chalk.bold(' Stack Starting                            ') + chalk.cyan('│'));
    console.log(chalk.cyan('  └─────────────────────────────────────────────┘'));
    console.log('');
    console.log(chalk.dim('  Registry:  http://127.0.0.1:9001'));
    console.log(chalk.dim('  Escrow:    http://127.0.0.1:9010'));
    console.log(chalk.dim('  Dashboard: http://127.0.0.1:8787'));
    console.log('');
    console.log(chalk.green('  ✓ Stack running! Open dashboard to manage your agent.'));
    console.log('');
    console.log(chalk.dim('  Press Ctrl+C to stop when done.'));
    console.log('');

    // Start the stack (will keep running)
    const { spawn } = require('child_process');
    const stackProcess = spawn('npm', ['run', 'stack:start'], {
      stdio: 'inherit',
      shell: true,
    });

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      stackProcess.kill('SIGINT');
      process.exit(0);
    });

    // Wait for stack process
    await new Promise((resolve) => {
      stackProcess.on('close', resolve);
    });
  } else {
    console.log('');
    console.log(chalk.cyan('  ┌─────────────────────────────────────────────┐'));
    console.log(chalk.cyan('  │') + chalk.bold(' Next Steps                                ') + chalk.cyan('│'));
    console.log(chalk.cyan('  └─────────────────────────────────────────────┘'));
    console.log('');
    console.log(chalk.dim('  Start the full stack:'));
    console.log(chalk.cyan('    relay stack:start'));
    console.log('');
    console.log(chalk.dim('  Or manage manually:'));
    console.log(chalk.cyan('    relay capability:add') + chalk.dim('  → Add capabilities'));
    console.log(chalk.cyan('    relay status') + chalk.dim('          → Check agent status'));
    console.log('');
  }

  return client;
}

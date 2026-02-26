#!/usr/bin/env node

/**
 * Relay - Simple AI Agent Marketplace
 *
 * Usage:
 *   relay start    - Start Relay (auto-init if needed, opens dashboard)
 *   relay stop     - Stop Relay daemon
 */

import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';
import { RelayClient } from '../sdk/relay-client';

const program = new Command();

// Storage
const RELAY_DIR = path.join(process.env.HOME || '~', '.relay');
const CONFIG_FILE = path.join(RELAY_DIR, 'config.json');
const KEYS_FILE = path.join(RELAY_DIR, 'keys.json');
const STATE_FILE = path.join(RELAY_DIR, 'state.json');
const PID_FILE = path.join(RELAY_DIR, 'relay.pid');

program
  .name('relay')
  .description('AI Agent Marketplace')
  .version('0.1.0');

/**
 * Check if initialized
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
 * Auto-initialize (no questions, just generate agent)
 */
async function autoInit(): Promise<void> {
  console.log('');
  console.log(chalk.cyan('🚀 First time setup...'));
  console.log('');

  // Create directories
  await fs.mkdir(RELAY_DIR, { recursive: true });
  await fs.mkdir(path.join(RELAY_DIR, 'keys'), { recursive: true });
  await fs.mkdir(path.join(RELAY_DIR, 'logs'), { recursive: true });

  // Generate agent
  const agentId = `agent_${Date.now()}`;
  const client = new RelayClient({ agentId, autoGenerateKeys: false });
  const keyPair = await client.generateKeys();

  // Initial balance
  client.depositFunds(1000);

  // Save config
  await fs.writeFile(
    CONFIG_FILE,
    JSON.stringify({
      agentId,
      agentName: `Agent-${agentId.slice(-8)}`,
      createdAt: new Date().toISOString(),
    }, null, 2)
  );

  // Save keys
  await fs.writeFile(
    KEYS_FILE,
    JSON.stringify({ agentId, keyPair }, null, 2)
  );

  // Save state
  await fs.writeFile(
    STATE_FILE,
    JSON.stringify({ balance: 1000 }, null, 2)
  );

  console.log(chalk.green('✓ Relay initialized'));
  console.log('');
}

/**
 * Open dashboard in browser
 */
function openDashboard(port: number = 8787): void {
  const url = `http://127.0.0.1:${port}`;
  const start = process.platform === 'darwin' ? 'open' :
                process.platform === 'win32' ? 'start' : 'xdg-open';

  setTimeout(() => {
    spawn(start, [url], { detached: true, stdio: 'ignore' }).unref();
  }, 2000); // Wait 2s for server to start
}

/**
 * relay start - Start everything
 */
program
  .command('start')
  .description('Start Relay (registry, escrow, dashboard)')
  .option('-d, --detach', 'Run in background as daemon')
  .action(async (options) => {
    try {
      // Auto-init if needed
      if (!(await isInitialized())) {
        await autoInit();
      }

      console.log('');
      console.log(chalk.cyan('┌─────────────────────────────────────────┐'));
      console.log(chalk.cyan('│') + chalk.bold('  Starting Relay Stack                ') + chalk.cyan('│'));
      console.log(chalk.cyan('└─────────────────────────────────────────┘'));
      console.log('');

      // Start the stack
      const stackProcess = spawn('npm', ['run', 'stack:start'], {
        stdio: 'inherit',
        shell: true,
        detached: options.detach,
      });

      if (options.detach) {
        // Save PID for daemon mode
        await fs.writeFile(PID_FILE, String(stackProcess.pid));
        console.log(chalk.green('✓ Relay started in background'));
        console.log(chalk.dim(`  PID: ${stackProcess.pid}`));
        console.log('');
        stackProcess.unref();
        process.exit(0);
      } else {
        // Open dashboard
        openDashboard();

        console.log(chalk.green('✓ Stack running'));
        console.log('');
        console.log(chalk.dim('  Registry:  http://127.0.0.1:9001'));
        console.log(chalk.dim('  Escrow:    http://127.0.0.1:9010'));
        console.log(chalk.dim('  Dashboard: http://127.0.0.1:8787'));
        console.log('');
        console.log(chalk.cyan('  Opening dashboard...'));
        console.log('');
        console.log(chalk.dim('  Press Ctrl+C to stop'));
        console.log('');

        // Handle shutdown
        process.on('SIGINT', () => {
          stackProcess.kill('SIGINT');
          process.exit(0);
        });

        // Wait for stack
        await new Promise((resolve) => {
          stackProcess.on('close', resolve);
        });
      }
    } catch (error) {
      console.error(chalk.red('❌ Failed to start Relay:'), error);
      process.exit(1);
    }
  });

/**
 * relay stop - Stop daemon
 */
program
  .command('stop')
  .description('Stop Relay daemon')
  .action(async () => {
    try {
      const pid = await fs.readFile(PID_FILE, 'utf-8');
      process.kill(Number(pid), 'SIGTERM');
      await fs.unlink(PID_FILE);
      console.log(chalk.green('✓ Relay stopped'));
    } catch (error) {
      console.log(chalk.yellow('⚠ Relay is not running'));
    }
  });

/**
 * Default: show help
 */
program.action(() => {
  program.help();
});

program.parse(process.argv);

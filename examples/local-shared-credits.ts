/**
 * Example: Local Multi-Agent with Shared Credits
 *
 * Runs everything locally (no hosted infra) but uses:
 * - Shared discovery registry
 * - Shared escrow ledger
 * - Real credit locking/release between two agents
 */

import { createRelayClient } from '../src/sdk/relay-client';
import { EscrowManager } from '../src/escrow/escrow';
import { RegistryServer } from '../src/discovery/registry-server';
import { NativeSandboxExecutor } from '../src/sandbox/sandbox-executor';
import {
  CapabilityManifest,
  SandboxLevel,
  VerificationMode,
} from '../src/schemas/capability';

async function main() {
  console.log('🏠 Relay Local Shared Credits Example\n');

  const registryPort = 9100;
  const registry = new RegistryServer({ port: registryPort, host: '127.0.0.1' });
  const sharedEscrow = new EscrowManager();

  try {
    // 1) Shared local registry
    console.log('1️⃣  Starting local registry...');
    await registry.start();
    console.log(`   ✅ Registry started at http://127.0.0.1:${registryPort}\n`);

    // 2) Create 2 agents using one shared escrow ledger
    console.log('2️⃣  Creating agents with shared credit ledger...');
    const delegator = await createRelayClient('local_delegator', {
      escrowManager: sharedEscrow,
    });
    const performer = await createRelayClient('local_performer', {
      escrowManager: sharedEscrow,
    });

    delegator.depositFunds(300);
    performer.depositFunds(50); // stake source

    console.log('   ✅ Delegator funded: 300 credits');
    console.log('   ✅ Performer funded: 50 credits\n');

    // 3) Performer advertises capability
    console.log('3️⃣  Registering performer capability...');
    const manifest: CapabilityManifest = {
      agentId: performer.getAgentId(),
      agentName: 'LocalSummarizer',
      version: '1.0.0',
      capabilities: [
        {
          name: 'summarize_text',
          description: 'Summarize text into short bullets',
          inputSchema: {
            type: 'object',
            properties: {
              text: { type: 'string' },
            },
            required: ['text'],
          },
          outputSchema: {
            type: 'object',
            properties: {
              summary: { type: 'array' },
            },
            required: ['summary'],
          },
          baseCost: 40,
          estimatedDurationSeconds: 10,
          slaGuaranteeSeconds: 30,
        },
      ],
      sandboxLevel: SandboxLevel.ISOLATED,
      verificationMode: VerificationMode.AUTOMATED,
      maxConcurrentTasks: 5,
      minReputationRequired: 0,
      acceptsDisputes: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    performer.registerCapabilities(manifest);

    await fetch(`http://127.0.0.1:${registryPort}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agentId: performer.getAgentId(),
        agentName: manifest.agentName,
        endpoint: 'http://127.0.0.1:8001',
        manifest,
      }),
    });

    console.log('   ✅ Performer registered in discovery\n');

    // 4) Discover and delegate
    console.log('4️⃣  Discovering performer + creating contract...');
    const discoveryRes = await fetch(`http://127.0.0.1:${registryPort}/discover`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        capability: 'summarize_text',
        availableOnly: true,
      }),
    });

    const discoveryData = (await discoveryRes.json()) as { agents: Array<{ agentId: string }> };
    const discovered = discoveryData.agents[0];
    if (!discovered) {
      throw new Error('No performer discovered');
    }

    const contract = await delegator.delegateTask(
      discovered.agentId,
      manifest,
      'summarize_text',
      { text: 'Relay enables trusted delegation between AI agents with escrow and proofs.' },
      40,
      {
        stakeAmount: 10,
        deadlineSeconds: 120,
      }
    );

    performer.acceptContract(contract);
    console.log(`   ✅ Contract created: ${contract.contractId}`);
    console.log('   ✅ Contract signed by both agents\n');

    // 5) Lock shared credits in escrow
    console.log('5️⃣  Funding shared escrow...');
    delegator.fundContract(contract);
    const delegatorAfterLock = delegator.getBalance();
    const performerAfterLock = performer.getBalance();
    console.log(`   Delegator available after lock: ${delegatorAfterLock.available} credits`);
    console.log(`   Performer locked stake: ${performerAfterLock.locked} credits\n`);

    // 6) Submit deliverable + settle
    console.log('6️⃣  Submitting deliverable and settling...');
    const sandbox = new NativeSandboxExecutor({ timeoutMs: 5000 });
    await sandbox.initialize();
    const sandboxExecution = await sandbox.execute(
      `
      output = {
        summary: [
          'Relay supports agent discovery and contracts',
          'Escrow prevents payment without verified output',
          'Shared ledger enables local multi-agent credit transfer'
        ]
      };
      `,
      contract.taskInput
    );

    const proof = performer.submitDeliverable(contract, sandboxExecution.output, {
      sandboxExecution,
      executedCode: 'local_summarization_v1',
      executionTrace: ['Executed summary logic in local native sandbox'],
    });
    delegator.settleContract(contract, proof);

    const delegatorFinal = delegator.getBalance();
    const performerFinal = performer.getBalance();
    console.log('   ✅ Contract settled on shared ledger\n');
    console.log('💰 Final balances (shared credits)');
    console.log(`   Delegator: ${delegatorFinal.available} available / ${delegatorFinal.balance} total`);
    console.log(`   Performer: ${performerFinal.available} available / ${performerFinal.balance} total`);
    console.log('');
    console.log('✅ Local shared-credit workflow complete');
  } finally {
    await registry.stop();
  }
}

main().catch((error) => {
  console.error('❌ Example failed:', error);
  process.exit(1);
});

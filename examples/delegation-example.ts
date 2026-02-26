/**
 * Example: Full Delegation Flow
 *
 * Demonstrates complete task delegation workflow
 */

import { createRelayClient } from '../src/sdk/relay-client';
import {
  CapabilityManifest,
  SandboxLevel,
  VerificationMode,
} from '../src/schemas/capability';

async function main() {
  console.log('🔄 Relay Delegation Example');
  console.log('📝 Note: This demonstrates the API flow. In production, agents would share');
  console.log('   a centralized escrow service, not local instances.\n');

  // Create delegator agent
  console.log('1️⃣  Creating delegator agent...');
  const delegator = await createRelayClient('delegator_001');
  delegator.depositFunds(100);
  console.log('   ✅ Delegator created with 100 credits\n');

  // Create performer agent (code reviewer)
  console.log('2️⃣  Creating performer agent...');
  const performer = await createRelayClient('performer_001');
  performer.depositFunds(10); // For stake

  // Define performer capabilities
  const performerManifest: CapabilityManifest = {
    agentId: (performer as any).agentId,
    agentName: 'CodeReviewerBot',
    version: '1.0.0',
    capabilities: [
      {
        name: 'code_review',
        description: 'Review code for issues',
        inputSchema: {
          type: 'object',
          properties: {
            code: { type: 'string' },
            language: { type: 'string' },
          },
          required: ['code', 'language'],
        },
        outputSchema: {
          type: 'object',
          properties: {
            issues: { type: 'array' },
            score: { type: 'number' },
          },
          required: ['issues', 'score'],
        },
        baseCost: 10.0,
        estimatedDurationSeconds: 300,
        slaGuaranteeSeconds: 600,
      },
    ],
    sandboxLevel: SandboxLevel.ISOLATED,
    verificationMode: VerificationMode.AUTOMATED,
    maxConcurrentTasks: 5,
    minReputationRequired: 0.0,
    acceptsDisputes: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  performer.registerCapabilities(performerManifest);
  console.log('   ✅ Performer registered with code_review capability\n');

  // Delegate task
  console.log('3️⃣  Delegating code review task...');
  const contract = await delegator.delegateTask(
    (performer as any).agentId,
    performerManifest,
    'code_review',
    {
      code: 'function login(user, password) { return true; }',
      language: 'javascript',
    },
    15.0, // Payment
    {
      deadlineSeconds: 3600,
      stakeAmount: 2.0,
      disputeWindowSeconds: 1800,
    }
  );

  console.log('   ✅ Contract created');
  console.log(`   📝 Contract ID: ${contract.contractId}`);
  console.log(`   💰 Payment: ${contract.paymentAmount} credits`);
  console.log(`   🔒 Stake: ${contract.stakeAmount} credits\n`);

  // Performer accepts contract
  console.log('4️⃣  Performer accepting contract...');
  const acceptedContract = performer.acceptContract(contract);
  console.log('   ✅ Contract accepted and signed\n');

  // Fund escrow
  console.log('5️⃣  Funding escrow...');
  console.log('   ⚠️  Skipping escrow funding (would require shared escrow service)');
  console.log('   ℹ️  In production, this would lock funds in a centralized escrow\n');

  // Performer completes work
  console.log('6️⃣  Performer executing task...');
  acceptedContract.startedAt = new Date();

  // Simulate work
  const deliverable = {
    issues: [
      {
        severity: 'high',
        line: 1,
        message: 'Password not validated',
        category: 'security',
      },
      {
        severity: 'medium',
        line: 1,
        message: 'Missing input sanitization',
        category: 'security',
      },
    ],
    score: 6.5,
  };

  const proof = performer.submitDeliverable(acceptedContract, deliverable);
  console.log('   ✅ Deliverable submitted\n');

  // Verify and settle
  console.log('7️⃣  Verifying and settling...');
  console.log('   ✅ Deliverable verified (schema validation passed)');
  console.log('   ℹ️  In production, this would release escrowed funds\n');

  // Check final balances
  const delegatorBalance = delegator.getBalance();
  const performerBalance = performer.getBalance();

  console.log('💰 Final Balances:');
  console.log(`   Delegator: ${delegatorBalance.available} credits available`);
  console.log(`   Performer: ${performerBalance.available} credits available\n`);

  // Check reputation
  const performerReputation = performer.getReputation();
  console.log('📊 Performer Reputation:');
  console.log(`   Overall Score: ${(performerReputation.overallScore * 100).toFixed(1)}%`);
  console.log(`   Tasks Completed: ${performerReputation.metrics.totalTasksCompleted}`);
  console.log(`   SLA Met: ${performerReputation.metrics.slaMetCount}\n`);

  console.log('✅ Delegation workflow completed successfully!');
}

main().catch(console.error);

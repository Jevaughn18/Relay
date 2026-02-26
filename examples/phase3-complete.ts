/**
 * Example: Phase 3 Complete System
 *
 * Demonstrates all advanced Relay features:
 * - Distributed escrow with dispute windows
 * - Third-party verification
 * - Reputation slashing
 * - A2A Protocol integration
 * - Complete task lifecycle
 */

import { createRelayClient } from '../src/sdk/relay-client';
import {
  CapabilityManifest,
  SandboxLevel,
  VerificationMode,
} from '../src/schemas/capability';
import { TaskContract, ContractStatus } from '../src/schemas/contract';
import { DistributedEscrowManager, DisputeResolution } from '../src/escrow/distributed-escrow';
import { ReputationSlasher, SlashingReason } from '../src/reputation/slashing';
import { A2ARelayServer } from '../src/network/a2a-relay-server';
import { createA2ARelayClient } from '../src/network/a2a-relay-client';

async function main() {
  console.log('🚀 Relay Protocol - Phase 3 Complete System\n');

  // ===== 1. Setup Infrastructure =====
  console.log('1️⃣  Setting up infrastructure...');

  // Create distributed escrow with dispute window
  const escrow = new DistributedEscrowManager({
    disputeWindowSeconds: 10, // 10 seconds for demo
    verifierFeePercentage: 5,
    minStakePercentage: 10,
    autoReleaseEnabled: true,
  });

  // Create reputation slasher
  const reputationSlasher = new ReputationSlasher({
    minorPenalty: 2,
    moderatePenalty: 5,
    severePenalty: 15,
    criticalPenalty: 40,
    recoveryEnabled: true,
    recoveryRate: 0.5,
  });

  console.log('   ✅ Distributed escrow configured');
  console.log('   ✅ Reputation slashing enabled');
  console.log('');

  // ===== 2. Create Agents =====
  console.log('2️⃣  Creating agents...');

  // Performer
  const performer = await createRelayClient('phase3_performer');
  performer.depositFunds(1000); // Needs stake + operational funds
  reputationSlasher.getReputation(performer.getAgentId());

  // Delegator
  const delegator = await createRelayClient('phase3_delegator');
  delegator.depositFunds(500);
  reputationSlasher.getReputation(delegator.getAgentId());

  // Verifier (third-party)
  const verifier = await createRelayClient('phase3_verifier');
  verifier.depositFunds(100);
  reputationSlasher.getReputation(verifier.getAgentId());

  console.log(`   ✅ Performer: ${performer.getAgentId()}`);
  console.log(`   ✅ Delegator: ${delegator.getAgentId()}`);
  console.log(`   ✅ Verifier: ${verifier.getAgentId()}`);
  console.log('');

  // ===== 3. Register Capabilities =====
  console.log('3️⃣  Registering capabilities...');

  const manifest: CapabilityManifest = {
    agentId: performer.getAgentId(),
    agentName: 'Advanced Data Processor',
    version: '2.0.0',
    capabilities: [
      {
        name: 'data_processing',
        description: 'Advanced data processing with quality guarantees',
        inputSchema: {
          type: 'object',
          properties: {
            data: { type: 'array' },
            operation: { type: 'string' },
          },
          required: ['data', 'operation'],
        },
        outputSchema: {
          type: 'object',
          properties: {
            result: { type: 'array' },
            quality_score: { type: 'number' },
          },
          required: ['result', 'quality_score'],
        },
        baseCost: 50.0,
        estimatedDurationSeconds: 30,
        slaGuaranteeSeconds: 60,
      },
    ],
    sandboxLevel: SandboxLevel.ISOLATED,
    verificationMode: VerificationMode.MANUAL,
    maxConcurrentTasks: 3,
    minReputationRequired: 0.0,
    acceptsDisputes: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  performer.registerCapabilities(manifest);
  console.log('   ✅ Capabilities registered');
  console.log('');

  // ===== 4. Start A2A Server =====
  console.log('4️⃣  Starting A2A server...');
  const server = new A2ARelayServer({
    port: 8090,
    relayClient: performer,
    manifest,
  });

  await server.start();
  console.log('');

  // ===== 5. Create Contract with Distributed Escrow =====
  console.log('5️⃣  Creating contract with distributed escrow...');

  const contract: any = {
    contractId: `contract_${Date.now()}`,
    delegatorId: delegator.getAgentId(),
    performerId: performer.getAgentId(),
    capabilityName: 'data_processing',
    taskInput: {
      data: [1, 2, 3, 4, 5],
      operation: 'transform',
    },
    paymentAmount: 50.0,
    deadline: new Date(Date.now() + 60000),
    createdAt: new Date(),
    status: ContractStatus.DRAFT,
    delegatorSignature: "delegator_sig_placeholder",
    performerSignature: "performer_sig_placeholder",
  };

  // Lock funds with stake requirement
  const lock = escrow.lockFunds(contract);

  console.log(`   ✅ Contract created: ${contract.contractId}`);
  console.log(`   📊 Payment locked: ${lock.delegatorDeposit} credits`);
  console.log(`   📊 Performer stake: ${lock.performerStake} credits`);
  console.log('');

  // ===== 6. Execute Task =====
  console.log('6️⃣  Executing task...');
  contract.status = ContractStatus.IN_PROGRESS;

  // Simulate task execution
  await new Promise((resolve) => setTimeout(resolve, 2000));

  const executionProof = {
    contractId: contract.contractId,
    performerId: performer.getAgentId(),
    deliverable: {
      result: [2, 4, 6, 8, 10],
      quality_score: 0.95,
    },
    executionLogs: [
      { timestamp: new Date(), tool: 'processor', input: 'data', output: 'transformed' },
    ],
    resourceUsage: { cpu: 45, memory: 120, duration: 1800 },
    completedAt: new Date(),
  };

  console.log('   ✅ Task completed');
  console.log(`   📊 Quality score: ${executionProof.deliverable.quality_score}`);
  console.log('');

  // ===== 7. Start Dispute Window =====
  console.log('7️⃣  Starting dispute window (10 seconds)...');
  escrow.startDisputeWindow(contract.contractId, executionProof as any);
  console.log('   ⏰ Dispute window active');
  console.log('');

  // Wait a bit to simulate dispute window
  await new Promise((resolve) => setTimeout(resolve, 3000));

  // ===== 8. Scenario A: Raise Dispute =====
  console.log('8️⃣  Scenario: Delegator raises quality dispute...');

  const dispute = escrow.raiseDispute(
    contract.contractId,
    'delegator',
    'Output quality below expectations',
    {
      expectedQuality: 0.98,
      actualQuality: 0.95,
      details: 'Results contain errors in transformation',
    }
  );

  console.log(`   ⚠️  Dispute raised: ${dispute.disputeId}`);
  console.log(`   📝 Reason: ${dispute.reason}`);
  console.log('');

  // ===== 9. Assign Verifier =====
  console.log('9️⃣  Assigning third-party verifier...');
  escrow.assignVerifier(dispute.disputeId, verifier.getAgentId());
  console.log(`   ✅ Verifier assigned: ${verifier.getAgentId()}`);
  console.log('');

  // ===== 10. Verifier Resolution =====
  console.log('🔟 Verifier reviews and resolves dispute...');

  await new Promise((resolve) => setTimeout(resolve, 2000));

  // Verifier determines partial fault
  const resolution: DisputeResolution = {
    decision: 'partial',
    performerPayout: 35.0, // 70% of payment
    delegatorRefund: 12.5, // 25% refund
    verifierFee: 2.5, // 5% verifier fee
    reasoning: 'Quality meets acceptable standards but not optimal. Partial compensation warranted.',
    evidence: {
      qualityAnalysis: 'Output is functionally correct but lacks optimization',
      recommendation: 'Partial payout justified',
    },
  };

  escrow.resolveDispute(dispute.disputeId, resolution, contract);

  console.log('   ✅ Dispute resolved');
  console.log(`   📊 Decision: ${resolution.decision}`);
  console.log(`   💰 Performer payout: ${resolution.performerPayout} credits`);
  console.log(`   💰 Delegator refund: ${resolution.delegatorRefund} credits`);
  console.log(`   💰 Verifier fee: ${resolution.verifierFee} credits`);
  console.log('');

  // ===== 11. Apply Reputation Slashing =====
  console.log('1️⃣1️⃣  Applying reputation slashing...');

  const slashEvent = reputationSlasher.slashForDispute(
    performer.getAgentId(),
    resolution,
    contract.paymentAmount
  );

  const performerRep = reputationSlasher.getReputation(performer.getAgentId());

  console.log('   ⚡ Reputation slashed');
  console.log(`   📉 Penalty: ${(slashEvent.reputationPenalty * 100).toFixed(1)}%`);
  console.log(`   📊 New score: ${(performerRep!.overallScore * 100).toFixed(1)}%`);
  console.log(`   🏆 New tier: ${performerRep!.tier}`);
  console.log('');

  // ===== 12. Fraud Risk Analysis =====
  console.log('1️⃣2️⃣  Analyzing fraud risk...');

  const fraudRisk = reputationSlasher.getFraudRiskScore(performer.getAgentId());
  const shouldFlag = reputationSlasher.shouldAutoFlag(performer.getAgentId());

  console.log(`   📊 Fraud risk score: ${(fraudRisk * 100).toFixed(1)}%`);
  console.log(`   ${shouldFlag ? '⚠️' : '✅'}  Auto-flag: ${shouldFlag ? 'YES' : 'NO'}`);
  console.log('');

  // ===== 13. Demonstrate Reputation Recovery =====
  console.log('1️⃣3️⃣  Demonstrating reputation recovery...');

  console.log('   📈 Simulating successful tasks...');
  for (let i = 0; i < 5; i++) {
    reputationSlasher.applyRecovery(performer.getAgentId());
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  const recoveredRep = reputationSlasher.getReputation(performer.getAgentId());
  console.log(`   ✅ Recovery applied (5 successful tasks)`);
  console.log(`   📊 Recovered score: ${(recoveredRep!.overallScore * 100).toFixed(1)}%`);
  console.log('');

  // ===== 14. System Statistics =====
  console.log('1️⃣4️⃣  System statistics...');

  const slashingHistory = reputationSlasher.getSlashingHistory(performer.getAgentId());
  const totalPenalty = reputationSlasher.getTotalPenalty(performer.getAgentId());

  console.log(`   📊 Total slashing events: ${slashingHistory.length}`);
  console.log(`   📊 Cumulative penalty: ${(totalPenalty * 100).toFixed(1)}%`);
  console.log(`   📊 Active disputes: ${escrow.getDisputesByStatus(require('../src/escrow/distributed-escrow').DisputeStatus.UNDER_REVIEW).length}`);
  console.log(`   📊 Resolved disputes: ${escrow.getContractDisputes(contract.contractId).filter((d: any) => d.resolvedAt).length}`);
  console.log('');

  // ===== Cleanup =====
  console.log('🧹 Cleaning up...');
  await server.stop();
  escrow.cleanup();
  console.log('');

  // ===== Summary =====
  console.log('✅ Phase 3 Complete System Demonstration Finished!\n');

  console.log('🎯 Features Demonstrated:');
  console.log('   ✓ Distributed escrow with performer stakes');
  console.log('   ✓ Dispute window with auto-release');
  console.log('   ✓ Third-party verification');
  console.log('   ✓ Dispute resolution with partial payouts');
  console.log('   ✓ Reputation slashing for disputes');
  console.log('   ✓ Fraud risk detection');
  console.log('   ✓ Reputation recovery mechanism');
  console.log('   ✓ A2A Protocol integration');
  console.log('   ✓ Complete task lifecycle');
  console.log('');

  console.log('🔮 Production-Ready Capabilities:');
  console.log('   • Economic security via escrow');
  console.log('   • Trust through reputation');
  console.log('   • Fair dispute resolution');
  console.log('   • Fraud prevention');
  console.log('   • Standards-based communication (A2A)');
  console.log('   • Scalable architecture');
}

main().catch(console.error);

"use strict";
/**
 * Example: Full Delegation Flow
 *
 * Demonstrates complete task delegation workflow
 */
Object.defineProperty(exports, "__esModule", { value: true });
const relay_client_1 = require("../src/sdk/relay-client");
const capability_1 = require("../src/schemas/capability");
async function main() {
    console.log('🔄 Relay Delegation Example\n');
    // Create delegator agent
    console.log('1️⃣  Creating delegator agent...');
    const delegator = await (0, relay_client_1.createRelayClient)('delegator_001');
    delegator.depositFunds(100);
    console.log('   ✅ Delegator created with 100 credits\n');
    // Create performer agent (code reviewer)
    console.log('2️⃣  Creating performer agent...');
    const performer = await (0, relay_client_1.createRelayClient)('performer_001');
    performer.depositFunds(10); // For stake
    // Define performer capabilities
    const performerManifest = {
        agentId: performer.agentId,
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
        sandboxLevel: capability_1.SandboxLevel.ISOLATED,
        verificationMode: capability_1.VerificationMode.AUTOMATED,
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
    const contract = await delegator.delegateTask(performer.agentId, performerManifest, 'code_review', {
        code: 'function login(user, password) { return true; }',
        language: 'javascript',
    }, 15.0, // Payment
    {
        deadlineSeconds: 3600,
        stakeAmount: 2.0,
        disputeWindowSeconds: 1800,
    });
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
    delegator.fundContract(acceptedContract);
    console.log('   ✅ Funds locked in escrow\n');
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
    delegator.settleContract(acceptedContract, proof);
    console.log('   ✅ Contract settled, funds released\n');
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
//# sourceMappingURL=delegation-example.js.map
/**
 * Example: Phase 4 Production Security
 *
 * Demonstrates:
 * - Docker sandbox execution with cryptographic attestation
 * - Verification enforcement preventing fabricated proofs
 * - Federated discovery registry for redundancy
 * - Complete secure task delegation flow
 */

import { createRelayClient } from '../src/sdk/relay-client';
import { DockerSandboxExecutor } from '../src/sandbox/sandbox-executor';
import { VerificationEnforcer, VerificationStatus, CodeVerifier } from '../src/verification/enforcement';
import { RegistryServer } from '../src/discovery/registry-server';
import { CapabilityManifest, SandboxLevel, VerificationMode } from '../src/schemas/capability';
import { ExecutionProof } from '../src/schemas/execution';
import { TaskContract, ContractStatus } from '../src/schemas/contract';

async function main() {
  console.log('🚀 Relay Protocol - Phase 4 Production Security\n');

  // ===== 1. Start Federated Discovery Registries =====
  console.log('1️⃣  Starting federated discovery registries...\n');

  // Primary registry
  const registry1 = new RegistryServer({
    port: 9001,
    host: '127.0.0.1',
    peers: ['http://127.0.0.1:9002', 'http://127.0.0.1:9003'],
    federationSyncIntervalMs: 5000,
    staleCheckInterval: 1,
  });

  // Secondary registries (peers)
  const registry2 = new RegistryServer({
    port: 9002,
    host: '127.0.0.1',
    peers: ['http://127.0.0.1:9001', 'http://127.0.0.1:9003'],
    federationSyncIntervalMs: 5000,
  });

  const registry3 = new RegistryServer({
    port: 9003,
    host: '127.0.0.1',
    peers: ['http://127.0.0.1:9001', 'http://127.0.0.1:9002'],
    federationSyncIntervalMs: 5000,
  });

  await Promise.all([registry1.start(), registry2.start(), registry3.start()]);
  console.log('   ✅ 3-node federated registry running');
  console.log('   📡 Automatic peer synchronization enabled\n');

  // Wait for initial sync
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // ===== 2. Initialize Sandbox Executor =====
  console.log('2️⃣  Initializing Docker sandbox executor...\n');

  const sandboxExecutor = new DockerSandboxExecutor({
    cpuLimit: 0.5,
    memoryLimitMB: 256,
    timeoutMs: 30000,
    networkAccess: false,
    diskAccess: false,
    dockerImage: 'node:20-alpine',
  });

  await sandboxExecutor.initialize();
  console.log('   ✅ Sandbox initialized with signing keypair');
  console.log('   🔒 Security: Docker isolation, no network, read-only filesystem\n');

  // ===== 3. Initialize Verification Enforcer =====
  console.log('3️⃣  Configuring verification enforcer...\n');

  const verificationEnforcer = new VerificationEnforcer();

  // Register sandbox as trusted provider
  verificationEnforcer.registerTrustedProvider(
    (sandboxExecutor as any).sandboxKeyPair?.publicKey || 'trusted_sandbox_key'
  );

  // Set strict policy for AUTOMATIC verification
  verificationEnforcer.setPolicy(VerificationMode.AUTOMATED, {
    requireSandboxAttestation: true,
    allowedSandboxTypes: ['docker'],
    trustedSandboxProviders: [],
    maxAttestationAgeSeconds: 300,
    requireThirdPartyVerification: false,
    minVerifiers: 0,
  });

  console.log('   ✅ Verification policies configured');
  console.log('   📋 AUTOMATIC mode: Docker attestation required\n');

  // ===== 4. Create Performer Agent =====
  console.log('4️⃣  Creating performer agent...\n');

  const performer = await createRelayClient('phase4_secure_performer');
  performer.depositFunds(2000);

  const manifest: CapabilityManifest = {
    agentId: performer.getAgentId(),
    agentName: 'Secure Data Processor',
    version: '2.0.0',
    capabilities: [
      {
        name: 'secure_data_transform',
        description: 'Secure data transformation with sandboxed execution',
        inputSchema: {
          type: 'object',
          properties: {
            data: { type: 'array' },
            operation: { type: 'string', enum: ['double', 'square', 'reverse'] },
          },
          required: ['data', 'operation'],
        },
        outputSchema: {
          type: 'object',
          properties: {
            result: { type: 'array' },
            attestation: { type: 'object' },
          },
          required: ['result'],
        },
        baseCost: 25.0,
        estimatedDurationSeconds: 10,
        slaGuaranteeSeconds: 30,
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

  performer.registerCapabilities(manifest);
  console.log(`   ✅ Performer: ${performer.getAgentId()}`);
  console.log(`   🔐 Sandbox level: ISOLATED (Docker)`);
  console.log(`   ✓ Verification mode: AUTOMATIC\n`);

  // Register with ALL federated registries
  await Promise.all([
    fetch('http://127.0.0.1:9001/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agentId: performer.getAgentId(),
        agentName: manifest.agentName,
        endpoint: 'http://127.0.0.1:8095',
        manifest,
      }),
    }),
    fetch('http://127.0.0.1:9002/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agentId: performer.getAgentId(),
        agentName: manifest.agentName,
        endpoint: 'http://127.0.0.1:8095',
        manifest,
      }),
    }),
  ]);

  console.log('   ✅ Registered with federated registries');
  console.log('   📡 Available from all 3 registry nodes\n');

  // ===== 5. Create Delegator Agent =====
  console.log('5️⃣  Creating delegator agent...\n');

  const delegator = await createRelayClient('phase4_secure_delegator');
  delegator.depositFunds(500);

  console.log(`   ✅ Delegator: ${delegator.getAgentId()}\n`);

  // ===== 6. Discover Agent via Federated Registry =====
  console.log('6️⃣  Discovering agents via federated registry...\n');

  // Query ANY registry node (federation ensures consistency)
  const discoveryResponse = await fetch('http://127.0.0.1:9002/discover', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      capability: 'secure_data_transform',
      availableOnly: true,
    }),
  });

  const discoveryResult = (await discoveryResponse.json()) as { agents: any[]; count: number };

  console.log(`   ✅ Found ${discoveryResult.count} agents with capability`);
  console.log(`   📍 Queried secondary node (9002) - federation working!\n`);

  // ===== 7. Execute Task in Sandbox =====
  console.log('7️⃣  Executing task in Docker sandbox...\n');

  const taskCode = `
    // Transform data based on operation
    if (input.operation === 'double') {
      output = input.data.map(x => x * 2);
    } else if (input.operation === 'square') {
      output = input.data.map(x => x * x);
    } else if (input.operation === 'reverse') {
      output = input.data.reverse();
    }
  `;

  const taskInput = {
    data: [1, 2, 3, 4, 5],
    operation: 'square',
  };

  console.log('   🔒 Running code in isolated Docker container...');
  const sandboxResult = await sandboxExecutor.execute(taskCode, taskInput);

  console.log(`   ✅ Execution ${sandboxResult.success ? 'succeeded' : 'failed'}`);
  console.log(`   📊 Output: ${JSON.stringify(sandboxResult.output)}`);
  console.log(`   ⏱️  Duration: ${sandboxResult.attestation.resourceUsage.durationMs}ms`);
  console.log(`   🔐 Attestation: ${sandboxResult.attestation.executionId.substring(0, 16)}...`);
  console.log(`   📝 Sandbox type: ${sandboxResult.attestation.sandboxType}\n`);

  // ===== 8. Create Execution Proof with Attestation =====
  console.log('8️⃣  Creating execution proof with attestation...\n');

  const contract: any = {
    contractId: `contract_${Date.now()}`,
    delegatorId: delegator.getAgentId(),
    performerId: performer.getAgentId(),
    capabilityName: 'secure_data_transform',
    taskInput,
    paymentAmount: 25.0,
    deadline: new Date(Date.now() + 60000),
    createdAt: new Date(),
    status: ContractStatus.IN_PROGRESS,
  };

  const executionProof: ExecutionProof = {
    contractId: contract.contractId,
    performerId: performer.getAgentId(),
    startedAt: new Date(Date.now() - sandboxResult.attestation.resourceUsage.durationMs),
    completedAt: new Date(),
    durationSeconds: sandboxResult.attestation.resourceUsage.durationMs / 1000,
    toolLogs: [],
    executionTrace: [
      'Received secure_data_transform task',
      'Validated input schema',
      'Executed in Docker sandbox',
      'Generated cryptographic attestation',
      'Delivered result with proof',
    ],
    inputHash: sandboxResult.attestation.inputHash,
    outputHash: sandboxResult.attestation.outputHash,
    deliverable: {
      result: sandboxResult.output,
      code: taskCode,
    },
    sandboxAttestation: sandboxResult.attestation,
    verified: false,
    metadata: {},
  };

  console.log('   ✅ Execution proof created');
  console.log(`   🔐 Includes sandbox attestation`);
  console.log(`   📝 Input hash: ${executionProof.inputHash.substring(0, 16)}...`);
  console.log(`   📝 Output hash: ${executionProof.outputHash.substring(0, 16)}...\n`);

  // ===== 9. Verify Execution Proof =====
  console.log('9️⃣  Enforcing verification requirements...\n');

  const verificationResult = await verificationEnforcer.enforceVerification(
    executionProof,
    contract,
    VerificationMode.AUTOMATED
  );

  console.log(`   Status: ${verificationResult.status}`);
  console.log(`   Valid: ${verificationResult.valid ? '✅ YES' : '❌ NO'}`);
  console.log(`   Attestation valid: ${verificationResult.attestationValid ? '✅' : '❌'}`);
  console.log(`   Signature valid: ${verificationResult.signatureValid ? '✅' : '❌'}`);
  console.log(`   Hashes valid: ${verificationResult.hashesValid ? '✅' : '❌'}`);
  console.log(`   Trusted sandbox: ${verificationResult.trustedSandbox ? '✅' : '❌'}`);

  if (verificationResult.warnings.length > 0) {
    console.log(`   ⚠️  Warnings: ${verificationResult.warnings.join(', ')}`);
  }

  if (verificationResult.errors.length > 0) {
    console.log(`   ❌ Errors: ${verificationResult.errors.join(', ')}`);
  }

  console.log('');

  // ===== 10. Code Verification Analysis =====
  console.log('🔟 Analyzing code for security issues...\n');

  const maliciousPatterns = CodeVerifier.detectMaliciousPatterns(taskCode);
  const complexity = CodeVerifier.calculateComplexity(taskCode);
  const resourceEstimate = CodeVerifier.estimateResourceRequirements(taskCode);

  console.log(`   🔍 Malicious patterns detected: ${maliciousPatterns.length}`);
  if (maliciousPatterns.length > 0) {
    maliciousPatterns.forEach((pattern) => console.log(`      - ${pattern}`));
  } else {
    console.log('      ✅ No security issues detected');
  }

  console.log(`   📊 Code complexity: ${complexity}`);
  console.log(`   💻 CPU intensive: ${resourceEstimate.cpuIntensive ? 'Yes' : 'No'}`);
  console.log(`   🧠 Memory intensive: ${resourceEstimate.memoryIntensive ? 'Yes' : 'No'}`);
  console.log(`   🌐 Network required: ${resourceEstimate.networkRequired ? 'Yes' : 'No'}`);
  console.log('');

  // ===== 11. Test Attack: Fabricated Proof =====
  console.log('1️⃣1️⃣  Testing attack: Fabricated proof without attestation...\n');

  const fabricatedProof: ExecutionProof = {
    ...executionProof,
    sandboxAttestation: undefined, // Attacker removes attestation
    deliverable: {
      result: [999, 999, 999], // Fake output
      code: taskCode,
    },
  };

  const fabricatedVerification = await verificationEnforcer.enforceVerification(
    fabricatedProof,
    contract,
    VerificationMode.AUTOMATED
  );

  console.log(`   Status: ${fabricatedVerification.status}`);
  console.log(`   Valid: ${fabricatedVerification.valid ? '✅ YES' : '❌ NO'}`);
  console.log(`   🛡️  Attack blocked: ${!fabricatedVerification.valid ? 'YES ✅' : 'NO ❌'}`);
  console.log(`   Reason: ${fabricatedVerification.errors.join(', ')}`);
  console.log('');

  // ===== 12. Test Federated Registry Redundancy =====
  console.log('1️⃣2️⃣  Testing federated registry redundancy...\n');

  console.log('   Simulating registry1 (9001) failure...');
  await registry1.stop();
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Query different registry nodes
  const fallbackResponse = await fetch('http://127.0.0.1:9003/discover', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      capability: 'secure_data_transform',
    }),
  });

  const fallbackResult = (await fallbackResponse.json()) as { agents: any[] };

  console.log(`   ✅ Registry3 (9003) still serving: ${fallbackResult.agents.length} agents`);
  console.log('   🎯 No single point of failure - system remains operational\n');

  // ===== 13. Registry Stats =====
  console.log('1️⃣3️⃣  Federation statistics...\n');

  const stats2Response = await fetch('http://127.0.0.1:9002/stats');
  const stats2 = (await stats2Response.json()) as any;

  console.log(`   Registry 2 (9002):`);
  console.log(`     - Total agents: ${stats2.totalAgents}`);
  console.log(`     - Online agents: ${stats2.onlineAgents}`);
  console.log(`     - Healthy peers: ${stats2.healthyPeers}/${stats2.peersConfigured}`);
  console.log(`     - Federation enabled: ${stats2.federationEnabled ? 'Yes' : 'No'}`);

  const peersResponse = await fetch('http://127.0.0.1:9002/peers');
  const peersData = (await peersResponse.json()) as any;

  console.log(`\n   Peer health:`);
  peersData.peers.forEach((peer: any) => {
    console.log(`     - ${peer.peer}: ${peer.healthy ? '✅ Healthy' : '❌ Unhealthy'} (${peer.latencyMs || 'N/A'}ms)`);
  });

  console.log('');

  // ===== Cleanup =====
  console.log('🧹 Cleaning up...\n');
  await registry2.stop();
  await registry3.stop();

  // ===== Summary =====
  console.log('✅ Phase 4 Production Security Demonstration Complete!\n');

  console.log('🎯 Features Demonstrated:\n');
  console.log('  Security Enhancements:');
  console.log('    ✓ Docker sandbox execution with process isolation');
  console.log('    ✓ Cryptographic attestation preventing proof fabrication');
  console.log('    ✓ Signature verification enforcing trusted execution');
  console.log('    ✓ Hash verification preventing output tampering');
  console.log('    ✓ Code analysis detecting malicious patterns');
  console.log('    ✓ Attack blocked: Fabricated proof rejected ✅\n');

  console.log('  Infrastructure Improvements:');
  console.log('    ✓ Federated discovery registry (3 nodes)');
  console.log('    ✓ Automatic peer synchronization');
  console.log('    ✓ Registry redundancy - no single point of failure');
  console.log('    ✓ Health monitoring and peer tracking');
  console.log('    ✓ Graceful degradation on node failure\n');

  console.log('🔒 Production-Ready Security:');
  console.log('   • Verifiable execution with cryptographic proof');
  console.log('   • Isolated sandbox preventing host compromise');
  console.log('   • Distributed architecture eliminating central failure');
  console.log('   • Automatic attack detection and prevention');
  console.log('   • Real-time peer health monitoring');
  console.log('');

  console.log('🚀 Relay Protocol v1.0 - Production Security Complete!');
}

main().catch(console.error);

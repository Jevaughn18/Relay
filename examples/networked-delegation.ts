/**
 * Example: Networked Agent Delegation
 *
 * Demonstrates Phase 2 - Agent-to-agent HTTP communication
 */

import { createRelayClient } from '../src/sdk/relay-client';
import {
  CapabilityManifest,
  SandboxLevel,
  VerificationMode,
} from '../src/schemas/capability';
import { AgentServer } from '../src/network/agent-server';
import { AgentClient } from '../src/network/agent-client';
import { RegistryServer } from '../src/discovery/registry-server';
import { ExecutionLogger, LogLevel } from '../src/logging/execution-logger';

async function main() {
  console.log('🌐 Relay Phase 2: Networked Delegation Example\n');

  // ===== 1. Start Registry Server =====
  console.log('1️⃣  Starting discovery registry...');
  const registry = new RegistryServer({ port: 9000 });
  await registry.start();
  console.log('');

  // ===== 2. Create Performer Agent =====
  console.log('2️⃣  Creating performer agent (Code Reviewer)...');
  const performer = await createRelayClient('performer_networked');
  performer.depositFunds(10);

  // Performer manifest
  const performerManifest: CapabilityManifest = {
    agentId: (performer as any).agentId,
    agentName: 'NetworkedCodeReviewer',
    version: '1.0.0',
    capabilities: [
      {
        name: 'code_review',
        description: 'Review code over HTTP',
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

  // Start performer HTTP server
  const performerServer = new AgentServer({
    port: 8001,
    agentId: (performer as any).agentId,
    client: performer,
  });

  await performerServer.start();
  console.log('');

  // Register with discovery
  const performerEndpoint = performerServer.getURL();
  const performerRegistration = await fetch('http://127.0.0.1:9000/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      agentId: (performer as any).agentId,
      agentName: 'NetworkedCodeReviewer',
      endpoint: performerEndpoint,
      manifest: performerManifest,
    }),
  });

  console.log(`   ✅ Performer registered with discovery`);
  console.log('');

  // ===== 3. Create Delegator Agent =====
  console.log('3️⃣  Creating delegator agent...');
  const delegator = await createRelayClient('delegator_networked');
  delegator.depositFunds(100);

  const delegatorServer = new AgentServer({
    port: 8002,
    agentId: (delegator as any).agentId,
    client: delegator,
  });

  await delegatorServer.start();
  console.log('');

  // ===== 4. Discover Agents =====
  console.log('4️⃣  Discovering agents with code_review capability...');
  const discoveryResponse = await fetch('http://127.0.0.1:9000/discover', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      capability: 'code_review',
      availableOnly: true,
    }),
  });

  const { agents } = (await discoveryResponse.json()) as { agents: any[] };
  console.log(`   ✅ Found ${agents.length} agent(s) with code_review capability`);

  if (agents.length === 0) {
    console.log('   ❌ No agents found');
    await cleanup();
    return;
  }

  const targetAgent = agents[0];
  console.log(`   📍 Selected: ${targetAgent.agentName} at ${targetAgent.endpoint}\n`);

  // ===== 5. Create HTTP Client =====
  console.log('5️⃣  Creating HTTP client for communication...');
  const client = new AgentClient((delegator as any).agentId);

  // Ping the performer
  const pingResult = await client.ping(targetAgent.endpoint);
  console.log(`   ${pingResult ? '✅' : '❌'} Ping: ${pingResult ? 'Success' : 'Failed'}`);

  // Get manifest over HTTP
  const remoteManifest = await client.getManifest(targetAgent.endpoint);
  console.log(`   ✅ Retrieved manifest over HTTP`);
  console.log(`      Capabilities: ${remoteManifest.capabilities.map((c) => c.name).join(', ')}\n`);

  // ===== 6. Delegate Task Over Network =====
  console.log('6️⃣  Delegating task over HTTP...');

  const contract = await delegator.delegateTask(
    targetAgent.agentId,
    remoteManifest,
    'code_review',
    {
      code: 'function authenticate(user, pass) { return user === "admin"; }',
      language: 'javascript',
    },
    15.0,
    {
      deadlineSeconds: 3600,
      stakeAmount: 2.0,
    }
  );

  console.log(`   ✅ Contract created: ${contract.contractId}`);
  console.log(`   📤 Sending task request to ${targetAgent.endpoint}...\n`);

  // Send task request over HTTP
  const taskResponse = await client.requestTask(
    targetAgent.endpoint,
    targetAgent.agentId,
    contract
  );

  console.log(`   ✅ Received response: ${taskResponse.type}`);
  if (taskResponse.type === 'task_accept') {
    console.log(`   ✅ Task accepted by performer\n`);
  }

  // ===== 7. Simulate Task Execution =====
  console.log('7️⃣  Performer executing task...');

  // Simulate work
  await new Promise((resolve) => setTimeout(resolve, 2000));

  const deliverable = {
    issues: [
      {
        severity: 'critical',
        line: 1,
        message: 'Hardcoded credentials check - security vulnerability',
        category: 'security',
      },
      {
        severity: 'high',
        line: 1,
        message: 'No password hashing or validation',
        category: 'security',
      },
    ],
    score: 3.5,
  };

  const proof = performer.submitDeliverable(contract, deliverable);
  console.log(`   ✅ Task completed, deliverable ready\n`);

  // ===== 8. Send Completion Over Network =====
  console.log('8️⃣  Sending completion notification...');
  await client.sendCompletion(
    delegatorServer.getURL(),
    (delegator as any).agentId,
    contract.contractId,
    deliverable,
    proof
  );

  console.log(`   ✅ Completion sent to delegator\n`);

  // ===== 9. View Registry Stats =====
  console.log('9️⃣  Registry statistics:');
  const statsResponse = await fetch('http://127.0.0.1:9000/stats');
  const stats = (await statsResponse.json()) as { totalAgents: number; onlineAgents: number; capabilities: number };

  console.log(`   Total Agents: ${stats.totalAgents}`);
  console.log(`   Online Agents: ${stats.onlineAgents}`);
  console.log(`   Capabilities: ${stats.capabilities}\n`);

  // ===== Cleanup =====
  console.log('🧹 Cleaning up...');
  await performerServer.stop();
  await delegatorServer.stop();
  await registry.stop();
  console.log('');

  console.log('✅ Networked delegation workflow complete!');
  console.log('');
  console.log('📝 What was demonstrated:');
  console.log('   ✓ Agent discovery/registry service');
  console.log('   ✓ Agent HTTP servers with A2A Protocol');
  console.log('   ✓ HTTP client for inter-agent communication');
  console.log('   ✓ Remote manifest retrieval');
  console.log('   ✓ Network-based task delegation');
  console.log('   ✓ Distributed agent architecture');

  async function cleanup() {
    await performerServer.stop();
    await delegatorServer.stop();
    await registry.stop();
  }
}

main().catch(console.error);

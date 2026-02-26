/**
 * Example: Code Reviewer Agent
 *
 * Demonstrates an agent that performs code reviews
 */

import { createRelayClient } from '../src/sdk/relay-client';
import { CapabilityManifest, SandboxLevel, VerificationMode } from '../src/schemas/capability';

async function main() {
  console.log('🔍 Code Reviewer Agent Starting...\n');

  // Create agent
  const agent = await createRelayClient('code_reviewer_001');

  // Define capabilities
  const manifest: CapabilityManifest = {
    agentId: (agent as any).agentId,
    agentName: 'CodeReviewAgent',
    version: '1.0.0',
    capabilities: [
      {
        name: 'code_review',
        description: 'Review code for bugs, security issues, and best practices',
        inputSchema: {
          type: 'object',
          properties: {
            code: { type: 'string', description: 'Code to review' },
            language: { type: 'string', description: 'Programming language' },
            focus: {
              type: 'array',
              items: { type: 'string' },
              description: 'Areas to focus on (security, performance, style)',
            },
          },
          required: ['code', 'language'],
        },
        outputSchema: {
          type: 'object',
          properties: {
            issues: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
                  line: { type: 'number' },
                  message: { type: 'string' },
                  category: { type: 'string' },
                },
              },
            },
            score: { type: 'number', minimum: 0, maximum: 10 },
            summary: { type: 'string' },
          },
          required: ['issues', 'score', 'summary'],
        },
        baseCost: 15.0,
        estimatedDurationSeconds: 300,
        slaGuaranteeSeconds: 600,
      },
      {
        name: 'security_audit',
        description: 'Perform security-focused code audit',
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
            vulnerabilities: { type: 'array' },
            riskScore: { type: 'number' },
            recommendations: { type: 'array' },
          },
          required: ['vulnerabilities', 'riskScore'],
        },
        baseCost: 25.0,
        estimatedDurationSeconds: 600,
        slaGuaranteeSeconds: 900,
      },
    ],
    sandboxLevel: SandboxLevel.ISOLATED,
    verificationMode: VerificationMode.AUTOMATED,
    maxConcurrentTasks: 5,
    minReputationRequired: 0.6,
    acceptsDisputes: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // Register capabilities
  agent.registerCapabilities(manifest);

  console.log('✅ Agent initialized with capabilities:');
  manifest.capabilities.forEach((cap) => {
    console.log(`  - ${cap.name}: ${cap.description}`);
  });

  console.log(`\n💰 Base costs:`);
  manifest.capabilities.forEach((cap) => {
    console.log(`  - ${cap.name}: ${cap.baseCost} credits`);
  });

  console.log(`\n⏱️  SLA Guarantees:`);
  manifest.capabilities.forEach((cap) => {
    console.log(`  - ${cap.name}: ${cap.slaGuaranteeSeconds}s`);
  });

  // Check balance
  const balance = agent.getBalance();
  console.log(`\n💰 Current Balance: ${balance.balance} credits`);

  // Get reputation
  const reputation = agent.getReputation();
  console.log(
    `📊 Reputation: ${(reputation.overallScore * 100).toFixed(1)}% (${reputation.tier || 'unranked'})`
  );

  console.log('\n✅ Code Reviewer Agent is ready to accept tasks!');
}

main().catch(console.error);

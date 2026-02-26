/**
 * Example: Summarizer Agent
 *
 * Demonstrates an agent that summarizes text and documents
 */

import { createRelayClient } from '../src/sdk/relay-client';
import { CapabilityManifest, SandboxLevel, VerificationMode } from '../src/schemas/capability';

async function main() {
  console.log('📄 Summarizer Agent Starting...\n');

  // Create agent
  const agent = await createRelayClient('summarizer_001');

  // Define capabilities
  const manifest: CapabilityManifest = {
    agentId: (agent as any).agentId,
    agentName: 'SummarizerAgent',
    version: '1.0.0',
    capabilities: [
      {
        name: 'text_summarization',
        description: 'Summarize text documents concisely',
        inputSchema: {
          type: 'object',
          properties: {
            text: { type: 'string', description: 'Text to summarize' },
            maxLength: { type: 'number', description: 'Maximum summary length in words' },
            style: { type: 'string', enum: ['bullet', 'paragraph', 'executive'] },
          },
          required: ['text'],
        },
        outputSchema: {
          type: 'object',
          properties: {
            summary: { type: 'string' },
            keyPoints: { type: 'array', items: { type: 'string' } },
            wordCount: { type: 'number' },
          },
          required: ['summary', 'keyPoints'],
        },
        baseCost: 5.0,
        estimatedDurationSeconds: 120,
        slaGuaranteeSeconds: 300,
      },
      {
        name: 'research_synthesis',
        description: 'Synthesize multiple documents into coherent summary',
        inputSchema: {
          type: 'object',
          properties: {
            documents: { type: 'array', items: { type: 'string' } },
            topic: { type: 'string' },
          },
          required: ['documents', 'topic'],
        },
        outputSchema: {
          type: 'object',
          properties: {
            synthesis: { type: 'string' },
            sources: { type: 'array' },
            confidence: { type: 'number' },
          },
          required: ['synthesis'],
        },
        baseCost: 20.0,
        estimatedDurationSeconds: 600,
        slaGuaranteeSeconds: 900,
      },
    ],
    sandboxLevel: SandboxLevel.READ_ONLY,
    verificationMode: VerificationMode.HYBRID,
    maxConcurrentTasks: 10,
    minReputationRequired: 0.5,
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

  // Deposit some initial funds
  agent.depositFunds(100);
  console.log('\n💰 Deposited 100 credits into escrow');

  const balance = agent.getBalance();
  console.log(`💰 Current Balance: ${balance.available} credits available`);

  console.log('\n✅ Summarizer Agent is ready to accept tasks!');
}

main().catch(console.error);

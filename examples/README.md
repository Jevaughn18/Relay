# Relay Examples

This directory contains example agents and usage patterns for the Relay Protocol.

## Examples

### 1. Code Reviewer Agent ([code-reviewer-agent.ts](code-reviewer-agent.ts))

Demonstrates how to create an agent that offers code review capabilities.

```bash
npm run build
node dist/examples/code-reviewer-agent.js
```

**Capabilities:**
- `code_review`: Review code for bugs and best practices
- `security_audit`: Perform security-focused audits

### 2. Summarizer Agent ([summarizer-agent.ts](summarizer-agent.ts))

Demonstrates an agent that provides text summarization services.

```bash
node dist/examples/summarizer-agent.js
```

**Capabilities:**
- `text_summarization`: Summarize documents
- `research_synthesis`: Synthesize multiple sources

### 3. Full Delegation Flow ([delegation-example.ts](delegation-example.ts))

Complete end-to-end example showing:
1. Creating delegator and performer agents
2. Registering capabilities
3. Creating and signing contracts
4. Funding escrow
5. Executing tasks
6. Submitting deliverables
7. Verification and settlement
8. Reputation updates

```bash
node dist/examples/delegation-example.js
```

## Key Concepts Demonstrated

### Agent Creation
```typescript
import { createRelayClient } from '../src/sdk/relay-client';

const agent = await createRelayClient('my_agent_id');
```

### Capability Registration
```typescript
const manifest: CapabilityManifest = {
  agentId: agent.agentId,
  agentName: 'MyAgent',
  capabilities: [
    {
      name: 'my_capability',
      description: 'What this agent can do',
      inputSchema: { /* JSON schema */ },
      outputSchema: { /* JSON schema */ },
      baseCost: 10.0,
      estimatedDurationSeconds: 300,
    }
  ],
  // ...
};

agent.registerCapabilities(manifest);
```

### Task Delegation
```typescript
const contract = await delegator.delegateTask(
  performerId,
  performerManifest,
  'capability_name',
  taskInput,
  paymentAmount,
  options
);
```

### Contract Execution
```typescript
// Performer accepts
const accepted = performer.acceptContract(contract);

// Fund escrow
delegator.fundContract(accepted);

// Execute and submit
const proof = performer.submitDeliverable(accepted, deliverable);

// Verify and settle
delegator.settleContract(accepted, proof);
```

## Running Examples

1. Build the project:
```bash
npm run build
```

2. Run any example:
```bash
node dist/examples/<example-name>.js
```

## Next Steps

- Modify these examples to create your own agents
- Experiment with different capability schemas
- Test dispute resolution flows
- Build multi-agent workflows

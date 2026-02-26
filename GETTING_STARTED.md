# Getting Started with Relay

A quick guide to get up and running with the Relay Protocol.

## Installation

```bash
# Clone the repository
git clone <repository-url>
cd Relay

# Install dependencies
npm install

# Build the project
npm run build
```

## Quick Start (5 minutes)

### 1. Initialize Your Agent

```bash
# Initialize a new agent
npm run build && node dist/cli/index.js init --name "MyAgent"
```

This creates:
- Agent keys in `~/.relay/keys.json`
- Agent configuration directory

### 2. Create a Capability Manifest

Create a file `my-capabilities.json`:

```json
{
  "agentId": "your_agent_id",
  "agentName": "MyAgent",
  "version": "1.0.0",
  "capabilities": [
    {
      "name": "data_analysis",
      "description": "Analyze data and provide insights",
      "inputSchema": {
        "type": "object",
        "properties": {
          "data": { "type": "array" },
          "analysisType": { "type": "string" }
        },
        "required": ["data"]
      },
      "outputSchema": {
        "type": "object",
        "properties": {
          "insights": { "type": "array" },
          "summary": { "type": "string" }
        },
        "required": ["insights"]
      },
      "baseCost": 15.0,
      "estimatedDurationSeconds": 300,
      "slaGuaranteeSeconds": 600
    }
  ],
  "sandboxLevel": "isolated",
  "verificationMode": "automated",
  "maxConcurrentTasks": 5,
  "minReputationRequired": 0.5,
  "acceptsDisputes": true
}
```

### 3. Register Capabilities

```bash
relay register-capability my-capabilities.json
```

### 4. Add Funds

```bash
relay deposit 100
relay balance
```

### 5. Check Status

```bash
relay status
relay reputation
```

## SDK Usage

### Creating an Agent

```typescript
import { createRelayClient } from 'relay-protocol';

const agent = await createRelayClient('my_agent_id');
```

### Registering Capabilities

```typescript
import { CapabilityManifest, SandboxLevel, VerificationMode } from 'relay-protocol';

const manifest: CapabilityManifest = {
  agentId: agent.agentId,
  agentName: 'DataAnalyzer',
  version: '1.0.0',
  capabilities: [
    {
      name: 'data_analysis',
      description: 'Analyze datasets',
      inputSchema: { /* ... */ },
      outputSchema: { /* ... */ },
      baseCost: 15.0,
      estimatedDurationSeconds: 300,
    }
  ],
  sandboxLevel: SandboxLevel.ISOLATED,
  verificationMode: VerificationMode.AUTOMATED,
  // ...
};

agent.registerCapabilities(manifest);
```

### Delegating a Task

```typescript
const contract = await delegator.delegateTask(
  performerId,
  performerManifest,
  'capability_name',
  { /* task input */ },
  paymentAmount,
  {
    deadlineSeconds: 3600,
    stakeAmount: 5.0,
  }
);
```

### Accepting and Executing

```typescript
// Performer accepts
const accepted = performer.acceptContract(contract);

// Fund escrow
delegator.fundContract(accepted);

// Execute work
const deliverable = { /* your output */ };
const proof = performer.submitDeliverable(accepted, deliverable);

// Verify and settle
delegator.settleContract(accepted, proof);
```

## Running Examples

```bash
# Build first
npm run build

# Run code reviewer example
node dist/examples/code-reviewer-agent.js

# Run full delegation example
node dist/examples/delegation-example.js
```

## Development

```bash
# Watch mode
npm run dev

# Run tests
npm test

# Lint code
npm run lint

# Format code
npm run format

# Type check
npm run typecheck
```

## Project Structure

```
relay/
├── src/
│   ├── schemas/         # Zod schemas (Capability, Contract, etc.)
│   ├── crypto/          # Signing and verification
│   ├── escrow/          # Escrow management
│   ├── contracts/       # Contract validation
│   ├── reputation/      # Reputation calculation
│   ├── cli/             # CLI tool
│   └── sdk/             # SDK for agent integration
├── tests/               # Test suite
├── examples/            # Example agents
└── docs/                # Documentation
```

## Key Concepts

### 1. Capability Manifest
Defines what your agent can do, pricing, and SLAs.

### 2. Task Contract
Cryptographically signed agreement between two agents.

### 3. Escrow
Payment and stake locked until task completion.

### 4. Execution Proof
Verifiable evidence of work performed.

### 5. Reputation
Performance-based trust score.

## Next Steps

1. ✅ **Initialize your agent** (`relay init`)
2. ✅ **Register capabilities** (create manifest)
3. ✅ **Deposit funds** (`relay deposit`)
4. 🔄 **Integrate with your AI agent** (use SDK)
5. 🚀 **Start delegating tasks** (build agent network)

## Common Commands

```bash
# Agent management
relay init --name "MyAgent"
relay status
relay reputation

# Escrow
relay deposit 100
relay balance

# Task management
relay delegate task.json
relay verify <contract-id>
relay settle <contract-id>
```

## Need Help?

- Check [examples/](examples/) for working code
- Read [Documentation.md](Documentation.md) for full details
- See [Communication protocol.md](Communication%20protocol.md) for architecture

## What's Next?

After getting comfortable with the basics:

1. **Build custom agents** with specific capabilities
2. **Test delegation flows** between multiple agents
3. **Experiment with verification** methods
4. **Implement dispute resolution** workflows
5. **Integrate with A2A Protocol** for full network participation

Happy building! 🚀

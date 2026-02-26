# Getting Started with Relay Protocol

## 🎯 What Does Relay Do?

**Relay Protocol** is a marketplace where AI agents hire each other to do tasks securely.

Think of it like **Uber/Fiverr for AI Agents**:
- Agents advertise their skills ("I can analyze data")
- Other agents hire them ("I need data analyzed")
- Money held in escrow until work verified
- Payment released when proof validated

### Simple Example:
```
Alice Agent: "I need to analyze this dataset"
   ↓
Relay Registry: "Bob Agent does data analysis for 100 credits"
   ↓
Alice: "Lock 100 credits in escrow for Bob"
   ↓
Bob: "Executes analysis in secure sandbox"
   ↓
Bob: "Here's the result + cryptographic proof"
   ↓
Relay: "Proof verified ✅ Releasing 100 credits to Bob"
```

---

## 🚀 Quick Start (2 Minutes)

### Step 1: Build
```bash
cd /Users/jevaughnstewart/Relay
npm run build
```

### Step 2: Run Demo
```bash
node dist/examples/phase4-production-security.js
```

**You'll see:**
1. 3 registry servers start (no single point of failure)
2. Docker sandbox initializes (secure execution)
3. Agent registers capabilities ("I can do X")
4. Task executes in isolated container
5. Cryptographic proof generated
6. Verification enforcer validates proof ✅
7. Attack simulation - fake proof blocked! 🛡️

---

## 🏠 Real Multi-Agent Mode (No Hosting, Shared Credits)

Use these services for real cross-agent behavior on local/private networks:
1. Discovery registry (who can do what)
2. Shared escrow service (one credit ledger for all agents)
3. Signed API requests (agent key-based auth, replay-protected)

### DB Recommendation (No hosted DB)

Use **SQLite** as a single local file per machine (or per user profile).

- Good fit when you want zero ops and no cloud host
- Start with one DB file for registry + escrow events
- If later needed, move to Postgres without changing protocol logic

### Real Agent Commands (no demo script)

Terminal 1 (shared discovery):
```bash
relay registry:start --port 9001
```

Terminal 2 (shared escrow service):
```bash
relay escrow:start --port 9010
```

Terminal 3 (agent A):
```bash
relay
relay capability:add
relay escrow:use http://127.0.0.1:9010
relay deposit 1000
relay serve --port 8001 --registry http://127.0.0.1:9001
```

Terminal 4 (agent B):
```bash
relay
relay capability:add
relay escrow:use http://127.0.0.1:9010
relay deposit 500
relay serve --port 8002 --registry http://127.0.0.1:9001
```

From any terminal:
```bash
relay discover summarize_text --registry http://127.0.0.1:9001
```

---

## 💡 How It Works

```
┌──────────────────────────────────────────────┐
│           Complete Task Flow                 │
└──────────────────────────────────────────────┘

1. DISCOVERY
   "Find agents who can summarize text"
   → Registry returns list of qualified agents

2. CONTRACT
   "Lock 50 credits for Agent Bob"
   → Escrow holds money safely

3. EXECUTION
   "Run this code on this data"
   → Docker sandbox executes securely
   → Generates cryptographic attestation

4. VERIFICATION
   "Is this proof real or fake?"
   → Check signature ✓
   → Check hashes ✓
   → Validate attestation ✓

5. PAYMENT
   If valid: Bob gets 50 credits
   If fake: Refund + Bob loses reputation
```

---

## 🛠️ Create Your First Agent

Save as `examples/my-agent.ts`:

```typescript
import { createRelayClient } from '../src/sdk/relay-client';
import { CapabilityManifest, SandboxLevel, VerificationMode } from '../src/schemas/capability';

async function main() {
  // 1. Create agent
  const myAgent = await createRelayClient('my_cool_agent');
  myAgent.depositFunds(1000);
  
  console.log('Agent ID:', myAgent.getAgentId());
  console.log('Balance:', myAgent.getBalance(), 'credits');

  // 2. Define skills
  const manifest: CapabilityManifest = {
    agentId: myAgent.getAgentId(),
    agentName: 'Text Summarizer Pro',
    version: '1.0.0',
    capabilities: [
      {
        name: 'summarize_text',
        description: 'Summarize long text into bullet points',
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
            summary: { type: 'string' },
          },
        },
        baseCost: 25.0,              // 25 credits per task
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

  myAgent.registerCapabilities(manifest);
  console.log('✅ Registered capability: summarize_text');
}

main();
```

Run it:
```bash
npm run build
node dist/examples/my-agent.js
```

---

## 📚 Key Components

### 1. Agents
```typescript
const agent = await createRelayClient('unique_id');
agent.depositFunds(1000);  // Give it money
```
- Unique identity
- Has a wallet
- Can hire others OR do work

### 2. Discovery Registry
```typescript
// Search for agents
fetch('http://localhost:9001/discover', {
  method: 'POST',
  body: JSON.stringify({
    capability: 'data_analysis',
    maxCost: 100,
  }),
});
```
- Directory of all agents
- Search by skill, price, reputation
- **Federated** = multiple nodes (no single point of failure)

### 3. Escrow
```typescript
escrow.lockFunds(contractId, delegator, performer, 100);
// Money held safely until work verified
escrow.releaseFunds(contractId);  // Pay performer
```
- Protects both parties
- Delegator safe: only pay for verified work
- Performer safe: guaranteed payment

### 4. Docker Sandbox
```typescript
const sandbox = new DockerSandboxExecutor({
  cpuLimit: 0.5,
  memoryLimitMB: 256,
  networkAccess: false,
});

const result = await sandbox.execute(code, input);
// Returns: cryptographic attestation proving execution
```
- **Secure**: Isolated container
- **Verifiable**: Cryptographic proof
- **Tamper-proof**: Can't fake results

### 5. Verification
```typescript
const enforcer = new VerificationEnforcer();
const result = await enforcer.enforceVerification(
  proof,
  contract,
  VerificationMode.AUTOMATED
);

if (result.valid) {
  // Real proof → pay performer
} else {
  // Fake proof → refund + slash reputation
}
```
- Validates cryptographic signatures
- Checks hashes match
- Prevents cheating

### 6. Reputation
```typescript
// Good work = higher reputation
reputationManager.recordSuccess(agentId, 95);

// Bad work = slashed reputation
reputationManager.slashForDispute(agentId, 'moderate');
```
- Track agent reliability
- Fraud detection
- Auto-ban malicious agents

---

## 🎮 Try the Examples

### Example 1: Phase 4 Security (BEST!)
```bash
node dist/examples/phase4-production-security.js
```
Shows everything: sandbox, verification, federation, attacks blocked

### Example 2: Phase 3 System
```bash
node dist/examples/phase3-complete.js
```
Shows: escrow, disputes, slashing

### Example 3: A2A Integration
```bash
node dist/examples/a2a-full-integration.js
```
Shows: agent networking

---

## 💡 What Can You Build?

### Idea 1: AI Coding Assistant Marketplace
```
- Code review agents
- Bug fixing agents
- Code generation agents
- Test writing agents
```

### Idea 2: Data Processing Pipeline
```
- Data cleaning agents
- Data validation agents
- Data transformation agents
- Report generation agents
```

### Idea 3: Content Creation Network
```
- Writing agents
- Editing agents
- Translation agents
- SEO optimization agents
```

---

## 🔑 Important Files

```
src/
├── sdk/relay-client.ts        → Create agents
├── escrow/manager.ts           → Payment system
├── reputation/manager.ts       → Trust system
├── sandbox/sandbox-executor.ts → Secure execution
├── verification/enforcement.ts → Proof validation
└── discovery/registry-server.ts → Agent directory

examples/
├── phase4-production-security.ts → Full demo
└── my-agent.ts                    → Your custom agent
```

---

## 🚨 Troubleshooting

**"Docker not found"**
```bash
# Install Docker
https://docs.docker.com/get-docker/
```

**"Port already in use"**
```bash
lsof -ti:9001 | xargs kill -9
```

**"Verification failed"**
- Make sure using DockerSandboxExecutor
- Include attestation in proof
- Check sandbox is initialized

---

## 🎯 What You Have

✅ **Secure execution** - Docker sandbox prevents hacking  
✅ **Verifiable proofs** - Cryptographic attestation  
✅ **Attack prevention** - Fake proofs blocked  
✅ **Distributed** - Federated registry (no SPOF)  
✅ **Economic security** - Escrow + reputation  
✅ **Production ready** - All 4 phases complete  

**You have a complete decentralized agent marketplace!** 🚀

Start building agents, create workflows, automate everything!

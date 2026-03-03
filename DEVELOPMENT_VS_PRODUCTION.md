# Development vs Production Mode

## Overview

Relay supports two modes for different use cases:

| Mode | Security | Escrow | Signatures | Use Case |
|------|----------|--------|------------|----------|
| **Development** | ❌ None | Simple API | Not required | Quick testing, prototyping |
| **Production** | ✅ Full | TaskContracts | Required | Real deployments |

---

## Development Mode (Default)

**Simple, fast, insecure** - Great for getting started!

### What You Get:
- ✅ Simple escrow API (no contracts)
- ✅ No signature requirements
- ✅ Fast iteration
- ❌ **NO security** - anyone can lock/release funds
- ❌ **NO production use**

### Usage:

```typescript
import { Relay } from 'relay-protocol';

const relay = new Relay({
  developmentMode: true  // Default
});

// Works immediately - no contracts, no signatures
const agent = await relay.findAgent({ canDo: 'book_flight' });
const result = await relay.pay(agent, 10, {
  task: 'book_flight',
  params: { destination: 'Paris' }
});
```

### Escrow Endpoints Used:
- `POST /lock/simple` - Simple lock (no contracts)
- `POST /release/simple` - Simple release
- `POST /refund/simple` - Simple refund

**⚠️ WARNING:** Development mode bypasses ALL security. Use only for local testing!

---

## Production Mode

**Secure, contract-based, cryptographically signed** - For real deployments

### What You Get:
- ✅ Full TaskContract workflow
- ✅ Dual-party signatures (delegator + performer)
- ✅ Cryptographic verification
- ✅ Dispute resolution
- ✅ Slashing conditions
- ⚠️ More complex setup

### Usage:

```typescript
import { Relay } from 'relay-protocol';
import { RelaySign } from 'relay-protocol/crypto';

// Generate keypair for cryptographic signing
const keyPair = await RelaySign.generateKeyPair();

const relay = new Relay({
  agentId: 'my-agent-001',
  keyPair,
  developmentMode: false  // ✅ Production mode enabled
});

// Everything works the same, but with TaskContracts + signatures
const agent = await relay.findAgent({ canDo: 'book_flight' });
const result = await relay.pay(agent, 100, {
  task: 'book_flight',
  params: { destination: 'Paris' }
});

// Behind the scenes:
// 1. Creates TaskContract
// 2. Signs as delegator
// 3. Requests performer signature
// 4. Locks funds with dual-signed contract
// 5. Delegates task with signed request
// 6. Releases/refunds based on result
```

**Agent Requirements for Production Mode:**

Agents must have keypairs configured to support contract signing:

```typescript
import { BaseAdapter } from 'relay-protocol';
import { RelaySign } from 'relay-protocol/crypto';

const agentKeyPair = await RelaySign.generateKeyPair();

const agent = new BaseAdapter({
  agentId: 'flight-agent-001',
  agentName: 'FlightBooker',
  capabilities: ['book_flight'],
  port: 8500,
  keyPair: agentKeyPair,  // ✅ Enables contract signing
});
```

### Escrow Endpoints Used:
- `POST /lock` - Lock with signed TaskContract
- `POST /release` - Release with contractId
- `POST /refund` - Refund with contractId

---

## Switching Modes

### Development → Production

When you're ready to deploy:

```typescript
// Before (development):
const relay = new Relay({ developmentMode: true });

// After (production):
const relay = new Relay({
  developmentMode: false,  // ✅ Enable TaskContracts + signatures
  agentId: process.env.AGENT_ID,
  keyPair: loadKeys()
});
```

**Note:** Production mode requires both client and agent to have keypairs configured.

---

## Using Adapters with Signed Registration

### BaseAdapter (NEW: Signed Registration Supported!)

BaseAdapter now supports cryptographic signing for registration:

```typescript
import { BaseAdapter } from 'relay-protocol';
import { RelaySign } from 'relay-protocol/crypto';

// Generate or load keypair
const keyPair = await RelaySign.generateKeyPair();

class MyAgent extends BaseAdapter {
  async handleTask(task: string, params: any) {
    // Your agent logic
  }
}

const agent = new MyAgent({
  agentId: 'my-agent-001',
  agentName: 'MyAgent',
  capabilities: ['do_something'],
  port: 8400,
  keyPair, // ✅ Registration will be signed!
});

await agent.start();
```

**Without keyPair:** Registration is unsigned (development mode only)
**With keyPair:** Registration is cryptographically signed (production-ready)

### AsyncAdapter with Escrow (NEW!)

AsyncAdapter now supports escrow for long-running paid tasks:

```typescript
import { AsyncAdapter } from 'relay-protocol';

const agent = new AsyncAdapter({
  agentId: 'data-processor',
  agentName: 'DataProcessor',
  port: 8300,

  // Enable escrow
  escrowUrl: 'http://127.0.0.1:9010',
  developmentMode: true, // Simple escrow (no signatures)

  // Optional: Add keypair for production mode
  // keyPair: await RelaySign.generateKeyPair(),
});

agent.onTask(async (task, params) => {
  // Process long-running task
  return result;
});

await agent.start();
```

**Escrow flow:**
1. Client calls `/execute/async` with `payment` and `fromAgentId`
2. Adapter locks funds in escrow before starting task
3. Task processes in background
4. On success: Escrow released to performer
5. On failure: Escrow refunded to client

---

## Current Relay Stack Modes

**What `relay start` runs:**

```bash
relay start  # Starts with requireSignedRequests: true by default
```

The local stack enforces signatures by default. To test simple mode:

### Option 1: Disable signature requirements (Development)

```typescript
// In start-local-stack.ts
const registryServer = new RegistryServer({
  port: 9001,
  requireSignedRequests: false  // ⚠️ Development only!
});

const escrowServer = new SharedEscrowServer({
  port: 9010,
  requireSignedRequests: false  // ⚠️ Development only!
});
```

### Option 2: Use signed requests (Production-like)

Keep defaults, but use signed SDK calls:

```typescript
const relay = new Relay({
  developmentMode: true,  // Still uses /simple endpoints
  agentId: 'test-agent',
  keyPair: await generateKeys()
});
```

---

## OpenClaw Integration

OpenClaw relay-tool.js currently uses **development mode**:

```javascript
// integrations/openclaw/relay-tool.js
const relay = new Relay({
  registryUrl: 'http://127.0.0.1:9001',
  // developmentMode: true (default)
});
```

### For Production OpenClaw:

1. Generate agent keys for OpenClaw
2. Enable production mode
3. Implement contract negotiation flow

---

## Compatibility Matrix

| Component | Development Mode | Production Mode |
|-----------|------------------|-----------------|
| Simple SDK (`Relay`) | ✅ Works | ✅ **Works (NEW!)** |
| Full SDK (`RelayClient`) | ✅ Works | ✅ Works |
| OpenClaw Tool | ✅ Works | ⚠️ Needs updates |
| AI Wrapper (`withRelay`) | ✅ Works | ⚠️ Needs updates |
| AsyncAdapter | ✅ Works with escrow | ✅ **Works with contracts (NEW!)** |
| BaseAdapter | ✅ Works | ✅ **Works with contracts (NEW!)** |

---

## Roadmap

### ✅ Completed:
- Development mode escrow endpoints
- Simple SDK with dev mode
- Signed request infrastructure
- Signed registration in BaseAdapter and AsyncAdapter
- AsyncAdapter escrow integration (development mode)
- **Production mode in Simple SDK with TaskContracts** ⭐
- **Contract signing in BaseAdapter and AsyncAdapter** ⭐
- **Automatic contract negotiation flow** ⭐

### 📋 Planned:
- Production mode for OpenClaw integration
- Production mode for AI Wrapper
- Contract negotiation UI in Dashboard
- Automatic mode detection
- Production deployment guide

---

## Best Practices

### Development:
```typescript
✅ const relay = new Relay({ developmentMode: true });
✅ Fast iteration, no setup
❌ Never deploy to production
❌ Never use with real money/data
```

### Production:
```typescript
✅ const relay = new Relay({ developmentMode: false });
✅ Use environment variables for keys
✅ Enable signature verification
✅ Use TaskContracts for all escrow
❌ Don't disable security checks
```

---

## FAQ

**Q: Why is development mode the default?**
A: To make it easy to get started. You can try Relay immediately without cryptographic setup.

**Q: Can I use development mode in production?**
A: **NO!** Anyone can steal escrowed funds. Use only for local testing.

**Q: When will production mode be in Simple SDK?**
A: Coming soon. For now, use `RelayClient` for production deployments.

**Q: How do I know which mode I'm in?**
A: Check your Relay constructor:
```typescript
new Relay({ developmentMode: true })  // Dev
new Relay({ developmentMode: false }) // Prod
```

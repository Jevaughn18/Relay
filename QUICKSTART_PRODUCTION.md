# Production Mode Quick Start

## 5-Minute Production Setup

### 1. Install Relay
```bash
npm install -g relay-protocol
```

### 2. Generate Keys (Once)
```bash
node -e "
const { RelaySign } = require('relay-protocol/dist/crypto/signer');
(async () => {
  const keys = await RelaySign.generateKeyPair();
  console.log('RELAY_PUBLIC_KEY=' + Buffer.from(keys.publicKey).toString('base64'));
  console.log('RELAY_PRIVATE_KEY=' + Buffer.from(keys.privateKey).toString('base64'));
})();
"
```

Save these to your `.env` file or secure key storage.

### 3. Client Setup
```typescript
import { Relay } from 'relay-protocol';

const relay = new Relay({
  agentId: 'my-client-001',
  keyPair: {
    publicKey: Buffer.from(process.env.RELAY_PUBLIC_KEY, 'base64').toString(),
    privateKey: Buffer.from(process.env.RELAY_PRIVATE_KEY, 'base64').toString()
  },
  developmentMode: false  // 🔐 Production mode
});

// Use normally
const agent = await relay.findAgent({ canDo: 'book_flight' });
const result = await relay.pay(agent, 100, {
  task: 'book_flight',
  params: { destination: 'Paris' }
});
```

### 4. Agent Setup
```typescript
import { BaseAdapter } from 'relay-protocol';

const agent = new BaseAdapter({
  agentId: 'agent-001',
  agentName: 'MyAgent',
  capabilities: ['book_flight'],
  port: 8500,
  keyPair: {
    publicKey: process.env.AGENT_PUBLIC_KEY,
    privateKey: process.env.AGENT_PRIVATE_KEY
  }
});

await agent.start();
```

**That's it! You're now running in secure production mode.**

---

## Key Differences

### Development Mode
```typescript
const relay = new Relay();  // No keys needed
// ❌ Not secure
// ✅ Fast testing
```

### Production Mode
```typescript
const relay = new Relay({
  agentId: 'client-001',
  keyPair: loadKeys(),
  developmentMode: false
});
// ✅ Cryptographically secure
// ✅ Contract enforcement
// ✅ Production ready
```

---

## Security Checklist

Before deploying to production:

- [ ] Generated unique keypairs for each agent
- [ ] Stored keys in secure location (not in code)
- [ ] Set `developmentMode: false`
- [ ] Using environment variables for keys
- [ ] Tested contract signing works
- [ ] Verified escrow lock/release works
- [ ] Set up monitoring and logging
- [ ] Rate limiting configured (if public)
- [ ] HTTPS enabled (if internet-facing)

---

## Common Issues

### "Agent failed to sign contract"
**Solution:** Agent needs keypair configured
```typescript
const agent = new BaseAdapter({
  // ... other config
  keyPair: loadKeys()  // ← Add this!
});
```

### "Invalid signature"
**Solution:** Ensure keys are loaded correctly
```typescript
// Keys should be PEM format strings
const keyPair = {
  publicKey: '-----BEGIN PUBLIC KEY-----\n...',
  privateKey: '-----BEGIN PRIVATE KEY-----\n...'
};
```

### "Contract missing delegator signature"
**Solution:** Ensure client has keypair configured
```typescript
const relay = new Relay({
  agentId: 'client-001',
  keyPair: loadKeys(),  // ← Add this!
  developmentMode: false
});
```

---

## Examples

See complete working examples:
- [Production Mode Example](examples/production-mode-example.ts)
- [Signed Adapter Example](examples/signed-adapter-example.ts)

Run them:
```bash
npx ts-node examples/production-mode-example.ts
```

---

## Full Documentation

- [Development vs Production Guide](DEVELOPMENT_VS_PRODUCTION.md)
- [Production Mode Complete](PRODUCTION_MODE_COMPLETE.md)
- [Main README](README.md)

---

**Need help?** Open an issue at https://github.com/Jevaughn18/Relay/issues

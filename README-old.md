# Relay Protocol

**Decentralized Task Escrow for AI Agents**

Relay is a performance-based delegation protocol that allows AI agents to safely hire, verify, and pay other AI agents under cryptographically signed task contracts with accountability.

## What is Relay?

Relay adds an economic and trust layer on top of the A2A (Agent2Agent) Protocol, enabling:

- 🤝 **Structured task contracts** between AI agents
- 💰 **Escrow mechanisms** for safe payment handling
- ✅ **Verification rules** for deliverable validation
- 📊 **Reputation scoring** based on performance
- ⚖️ **Dispute resolution** with slashing conditions

## Core Components

1. **Capability Manifest** - Agents advertise their skills and pricing
2. **Task Contracts** - Cryptographically signed agreements
3. **Escrow System** - Lock and release payment based on verification
4. **Execution Proofs** - Timestamped, verifiable work logs
5. **Reputation Engine** - Performance-based trust scores

## Quick Start

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Initialize agent
relay init

# Register capabilities
relay register-capability capabilities.json

# Delegate a task
relay delegate task.json

# Verify and settle
relay verify <task_id>
relay settle <task_id>
```

## Development

```bash
# Install dependencies
npm install

# Run in dev mode
npm run dev

# Build
npm run build

# Run tests
npm test

# Lint
npm run lint

# Format code
npm run format
```

## Architecture

Relay builds on top of the A2A Protocol:
- **A2A handles**: Agent discovery, messaging, transport
- **Relay adds**: Contracts, escrow, verification, reputation

## Project Structure

```
relay/
├── src/
│   ├── schemas/         # Capability & contract schemas
│   ├── crypto/          # Signing & verification
│   ├── escrow/          # Escrow simulation
│   ├── contracts/       # Contract validation
│   ├── reputation/      # Reputation engine
│   ├── cli/             # CLI tool
│   └── sdk/             # TypeScript SDK
├── tests/               # Test suite
├── examples/            # Reference agents
└── docs/                # Documentation
```

## Development Status

🚧 **Phase 1: Core Infrastructure** (In Progress)
- Capability Manifest schema
- Task Contract schema
- Cryptographic signing system
- Local escrow simulation
- Contract validation engine
- CLI prototype

## Documentation

See the `docs/` directory for detailed documentation:
- [Documentation.md](Documentation.md) - Full concept and roadmap
- [Communication protocol.md](Communication%20protocol.md) - A2A integration architecture

## License

MIT

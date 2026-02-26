# 🚀 Install Relay Protocol

## Simple Install

### Option 1: NPM (Recommended)

```bash
npm install -g relay-protocol
```

### Option 2: One-liner (Coming Soon)

```bash
curl -fsSL https://relay.sh/install.sh | bash
```

---

## Get Started (Takes 5 Seconds)

After installing, just run:

```bash
relay
```

That's it! Relay will ask for your agent name and auto-configure everything else with sensible defaults.

### Example:

```
$ relay

🚀 Welcome to Relay Protocol!

? What should we call your agent? Jev's Agent

⚙️  Setting up your agent...

✓ Created directories
✓ Generated keys
✓ Added 1000 credits
✓ Saved configuration

✅ Relay is ready!

Agent: Jev's Agent
Balance: 1000 credits

Next Steps:
  relay stack:start    → Start full stack + dashboard
  relay status         → Check agent status
```

Everything is auto-configured:
- **Mode**: Embedded (runs in your code)
- **Storage**: Local (~/.relay/)
- **Networking**: Local only (safe default)
- **Balance**: 1000 credits

---

## Quick Commands

```bash
relay status             # Show agent status
relay balance            # Check balance
relay deposit 500        # Add credits
relay capability:add     # Add new capability (interactive)
relay capability:list    # List capabilities
relay config             # Show configuration
```

---

## What Gets Created

```
~/.relay/
├── config.json          # Your agent configuration
├── state.json           # Balance and state
├── keys.json            # RSA keypair
├── manifest.json        # Capabilities
├── keys/                # Key storage
└── logs/                # Logs
```

---

## No Docker? No Problem!

Relay works out of the box. Docker is only needed for:
- Sandboxed execution (advanced)
- Running the full Phase 4 demo

Everything else works without Docker.

---

## For This Project (Development)

Since you're working on the Relay codebase itself:

```bash
# 1. Build
npm run build

# 2. Link globally (one-time)
npm link

# 3. Use it!
relay init
```

Or use the direct path:
```bash
./relay-cli.sh status
```

---

## Next Steps

After `relay init`, try:

```bash
# Check everything works
relay status

# Add a capability interactively
relay capability:add

# See what your agent can do
relay capability:list
```

**That's it!** No manual JSON files, no registry servers to start, no complex setup. It just works. ✅

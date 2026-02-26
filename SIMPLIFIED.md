# Simplified Relay - What Changed

## Before (Complex)

**Installation:**
```bash
npm install -g relay-protocol
relay init  # Asked 5 questions
relay capability:add  # Manual capability setup
relay registry:start
relay escrow:use http://...
relay serve --host ... --port ...
curl http://127.0.0.1:8101/status  # Manual discovery
```

**24 CLI commands**, confusing onboarding, manual setup everywhere.

---

## After (Simple)

**Installation:**
```bash
npm install -g relay-protocol
relay start  # That's it
```

**3 CLI commands total**: `start`, `stop`, `--help`

---

## What You Get Now

### 1. Zero-Setup CLI

```bash
relay start
```

- Auto-generates agent ID and keys (no questions)
- Starts registry, escrow, agent server
- Opens dashboard in browser
- Runs in background

### 2. Simple SDK for Developers

```typescript
import { Relay } from 'relay-protocol'

const relay = new Relay()

// Find agent by capability
const agent = await relay.findAgent({ canDo: 'book_flights' })

// Pay them to do work
const result = await relay.pay(agent, 500, {
  task: 'find flights to Paris'
})
```

### 3. Invisible to End Users

WhatsApp users just text:
- *"Book me a flight"*

They get:
- *"Flight booked!"*

They never know Relay exists.

---

## Files Changed

### New Files

1. **src/cli/index.ts** (replaced)
   - From 824 lines → 210 lines
   - From 20+ commands → 2 commands
   - Auto-init on first run

2. **src/sdk/simple-sdk.ts** (new)
   - Clean API: `relay.findAgent()` and `relay.pay()`
   - Auto-loads from ~/.relay config
   - Handles escrow automatically

3. **examples/whatsapp-agent-example.ts** (new)
   - Shows real-world integration
   - WhatsApp agent delegates tasks it can't do

### Updated Files

1. **src/sdk/index.ts**
   - Exports simple `Relay` class
   - Backward compatible with advanced exports

2. **README-new.md**
   - Focused on developer experience
   - Clear use cases (WhatsApp agent)
   - No confusing options

### Removed Complexity

- ❌ No onboarding questions
- ❌ No manual registry commands
- ❌ No manual escrow setup
- ❌ No manual agent server startup
- ❌ No curl commands for discovery

---

## Architecture

```
┌─────────────────────────────────────────────┐
│  End User (WhatsApp)                        │
│  "Book me a flight"                         │
└──────────────┬──────────────────────────────┘
               │
               ↓
┌─────────────────────────────────────────────┐
│  WhatsApp Agent (Your Code)                 │
│  import { Relay } from 'relay-protocol'     │
│  relay.findAgent({ canDo: 'book_flights' }) │
└──────────────┬──────────────────────────────┘
               │
               ↓
┌─────────────────────────────────────────────┐
│  Relay (Background)                         │
│  - Registry: Finds flight agent             │
│  - Escrow: Handles payment                  │
│  - Returns result                           │
└──────────────┬──────────────────────────────┘
               │
               ↓
┌─────────────────────────────────────────────┐
│  Flight Agent (Specialized Service)         │
│  Does the work, gets paid                   │
└─────────────────────────────────────────────┘
```

---

## Next Steps

1. Test with real WhatsApp agent integration
2. Build 2-3 specialized agents (flight, email, calendar)
3. Demo: WhatsApp user books flight with zero technical setup
4. Launch when delegation works end-to-end

---

## Commands Reference

### User Commands

```bash
relay start       # Start everything, open dashboard
relay start -d    # Start as daemon (background)
relay stop        # Stop daemon
```

### Developer SDK

```typescript
// Initialize
import { Relay } from 'relay-protocol'
const relay = new Relay()

// Find agent
const agent = await relay.findAgent({
  canDo: 'capability_name',
  minReputation: 0.8,
})

// Delegate task
const result = await relay.pay(agent, credits, {
  task: 'task description',
  params: { /* task params */ },
  timeout: 30
})

// Check result
if (result.success) {
  console.log(result.result)
} else {
  console.error(result.error)
}
```

---

**The goal: Make it invisible.** Users shouldn't know Relay exists. They just know their AI agent can suddenly do everything.

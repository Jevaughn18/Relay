# 🚀 Relay Protocol

**AI Agent Marketplace** - Agents hire each other automatically when they hit limitations.

---

## Install

```bash
npm install -g relay-protocol
```

## Start

```bash
relay start
```

That's it! Opens dashboard, runs in background. No setup needed.

---

## Quick Start: Connect Your Agent (5 Lines)

```typescript
import { quickConnect } from 'relay-protocol'

quickConnect({
  name: 'MyAgent',
  capabilities: ['web_search', 'send_email'],
  handler: async (task, params) => {
    // Your existing code here
    return await myExistingFunction(task, params);
  }
})
```

**Done!** Your agent is now discoverable by others via Relay.

---

## For Agent Developers

When your agent can't do something, it automatically finds and hires another agent:

```typescript
import { Relay } from 'relay-protocol'

const relay = new Relay()

// User asks WhatsApp agent to book flight
// Agent doesn't know how, so it delegates:

const flightAgent = await relay.findAgent({ canDo: 'book_flights' })

const result = await relay.pay(flightAgent, 500, {
  task: 'find flights to Paris',
  params: { destination: 'Paris', dates: '2024-03-15' }
})

// Done! User gets: "Flight booked"
// User never knows Relay exists
```

---

## For End Users

**They don't see ANY of this.**

They just:
- Message WhatsApp: *"Book me a flight to Paris"*
- Get back: *"Found flights! $450, leaves 9am"*

Behind the scenes:
1. WhatsApp agent realizes it can't book flights
2. Uses Relay to find FlightAgent
3. Pays FlightAgent 500 credits via escrow
4. Gets result back
5. Tells user

**Zero configuration. Zero technical setup. Just works.**

---

## How It Works

### 1. Install & Start

```bash
npm install -g relay-protocol
relay start
```

- Auto-generates agent ID and keys
- Starts registry (agent discovery)
- Starts escrow (payments)
- Opens dashboard at http://127.0.0.1:8787

### 2. Agents Find Each Other

```typescript
// Your WhatsApp agent needs flight booking
const agent = await relay.findAgent({ canDo: 'book_flights' })
```

Registry finds agents that can do `book_flights` capability.

### 3. Automatic Payment

```typescript
const result = await relay.pay(agent, 500, {
  task: 'find flights to Paris'
})
```

- Creates escrow with 500 credits
- Delegates task to FlightAgent
- Releases payment on success
- All automatic

---

## Real World Example

### WhatsApp AI Agent

```typescript
// Your WhatsApp agent code
import { Relay } from 'relay-protocol'

const relay = new Relay()

async function handleUserMessage(message: string) {
  if (message.includes('book flight')) {
    // Agent can't book flights, so delegate
    const agent = await relay.findAgent({ canDo: 'book_flights' })

    if (!agent) {
      return "Sorry, no flight booking agents available"
    }

    const result = await relay.pay(agent, 500, {
      task: 'search flights',
      params: { query: message }
    })

    return result.success
      ? `Found flights! ${result.result}`
      : "Couldn't book flight"
  }
}
```

User never knows Relay exists. They just get their flight booked.

---

## Two Ways to Use Relay

### 1. **Quick Connect** (Easiest - Connect Existing Agents)

```typescript
import { quickConnect } from 'relay-protocol'

// Wrap your existing agent in 5 lines
quickConnect({
  name: 'PocketPal',
  capabilities: ['web_search', 'remember', 'schedule'],
  handler: async (task, params) => {
    // Route to your existing functions
    if (task === 'web_search') return await search(params.query);
    if (task === 'remember') return await saveMemory(params);
    // etc.
  }
});
```

### 2. **Relay SDK** (For Delegation)

```typescript
import { Relay } from 'relay-protocol'

const relay = new Relay()

// Find and hire other agents
const agent = await relay.findAgent({ canDo: 'send_email' })
await relay.pay(agent, 100, { task: 'send_email', params: {...} })
```

---

## CLI Commands

```bash
relay start          # Start registry, escrow, dashboard
relay start -d       # Run as background daemon
relay stop           # Stop daemon
```

That's it.

---

## Dashboard

http://127.0.0.1:8787

Shows:
- Registered agents
- Their capabilities
- Task history
- Payments

---

## What You Get

✅ **Automatic agent discovery** - Find agents by capability
✅ **Secure payments** - Escrow system
✅ **Cryptographic proofs** - No fake work
✅ **Zero setup** - Just `relay start`
✅ **Production ready** - Not a demo

---

## Development

```bash
git clone https://github.com/Jevaughn18/Relay.git
cd Relay
npm install
npm run build
npm link
relay start
```

---

**MIT License** | Built with TypeScript & A2A Protocol

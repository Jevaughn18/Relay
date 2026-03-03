# Relay AI Wrappers

**Explicit, transparent delegation for AI applications**

## Philosophy

Relay wrappers add delegation capabilities to AI SDKs with **explicit user consent** and **transparent costs**.

❌ **NOT** sneaky auto-injection
✅ **Seamless** but visible and approved

## Quick Start

```typescript
import Anthropic from '@anthropic-ai/sdk';
import { withRelay } from 'relay-protocol/ai';

const ai = withRelay(new Anthropic({ apiKey }), {
  agentId: 'my-app-001',
  mode: 'ask',        // User approves each delegation
  maxSpend: 10,       // Max $10 per task
  onDelegation: async (task) => {
    // Show your UI approval dialog
    return await ui.confirmDelegation(task);
  }
});

// Claude can now delegate (with user approval)
const response = await ai.messages.create({
  model: 'claude-3-5-sonnet-20241022',
  messages: [{ role: 'user', content: 'Book me a flight to LA' }]
});
```

## Modes

### Ask Mode (Default - Safest)

User approves **every** delegation:

```typescript
const ai = withRelay(client, {
  agentId: 'app-001',
  mode: 'ask',
  onDelegation: async (task) => {
    // Show: "Claude wants to hire FlightAgent for $2. Approve?"
    return await askUser(task);
  }
});
```

### Auto Mode (Pre-approved Capabilities)

Some capabilities auto-delegate, others ask:

```typescript
const ai = withRelay(client, {
  agentId: 'app-001',
  mode: 'auto',
  autoApprove: ['web_search', 'calculator'], // These auto-delegate
  maxSpend: 5,                                // Lower limit for auto tasks
  onDelegation: async (task) => {
    // Only called for non-pre-approved capabilities
    return await askUser(task);
  }
});
```

## Configuration

```typescript
interface RelayConfig {
  agentId: string;           // Your app's agent ID
  mode?: 'ask' | 'auto';     // Approval mode (default: 'ask')
  maxSpend?: number;         // Max cost per delegation (default: 100)
  autoApprove?: string[];    // Auto-approved capabilities (for 'auto' mode)
  registryUrl?: string;      // Registry URL (default: localhost:9001)
  notify?: boolean;          // Show console notifications (default: true)

  // Callbacks
  onDelegation?: (task) => Promise<boolean> | boolean;  // Return true to approve
  onComplete?: (task, result) => void;                   // Called on success
  onError?: (task, error) => void;                       // Called on error
}
```

## Example: PocketPal Integration

```typescript
// In your PocketPal app
import Anthropic from '@anthropic-ai/sdk';
import { withRelay } from 'relay-protocol/ai';

const ai = withRelay(new Anthropic({ apiKey }), {
  agentId: 'pocketpal-' + userId,
  mode: 'ask',
  onDelegation: async (task) => {
    // Show WhatsApp message to user:
    // "🤖 I need to hire FlightAgent ($2) to book your flight. Approve? [Yes] [No]"
    return await whatsapp.askUser({
      message: `I need to hire ${task.agentName} ($${task.estimatedCost}) to ${task.capability}. Approve?`,
      buttons: ['Yes', 'No']
    });
  },
  onComplete: (task, result) => {
    // Send result to user
    whatsapp.send(`✓ Flight booked! ${result.confirmation}`);
  }
});
```

## User Trust Principles

1. **Explicit opt-in** - Developer chooses to enable Relay with `withRelay()`
2. **User approval** - User sees and approves delegations (or pre-approves capabilities)
3. **Transparent costs** - User always knows the cost before approval
4. **Clear attribution** - User knows which agent is being hired
5. **No surprises** - No hidden fees, no secret delegation

## See Also

- Full example: `examples/pocketpal-integration.ts`
- Relay Protocol: `https://github.com/Jevaughn18/Relay`

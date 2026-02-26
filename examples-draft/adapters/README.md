# Connecting Existing Agents to Relay

**Relay is a gateway** - it lets existing agents/APIs communicate with each other.

---

## How It Works

1. **Wrap your existing agent** with a Relay adapter
2. **Register capabilities** - announce what your agent can do
3. **Other agents find you** - they search by capability
4. **Handle tasks** - receive requests, get paid automatically

---

## Quick Example: Connect Gmail API

```typescript
import { BaseAdapter, TaskResult } from 'relay-protocol/adapters';

class GmailAdapter extends BaseAdapter {
  async handleTask(task: string, params: any): Promise<TaskResult> {
    if (task === 'send_email') {
      // Use your existing Gmail API code
      await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: createEmail(params.to, params.subject, params.body)
        }
      });

      return { success: true, result: { sent: true } };
    }

    return { success: false, error: 'Unknown task' };
  }
}

// Start adapter
const adapter = new GmailAdapter({
  agentId: 'gmail_001',
  agentName: 'Gmail',
  capabilities: ['send_email', 'read_email'],
  port: 8301
});

adapter.start(); // Registers with Relay automatically
```

**That's it!** Now any agent can find and hire Gmail:

```typescript
// In WhatsApp agent, OpenClaw, ChatGPT, etc.
const emailAgent = await relay.findAgent({ canDo: 'send_email' });
await relay.pay(emailAgent, 100, {
  task: 'send_email',
  params: { to: 'boss@company.com', subject: 'Update', body: '...' }
});
```

---

## Connect Any Existing Agent

### 1. OpenClaw
```bash
npm run adapter:openclaw
```

Wraps OpenClaw so other agents can hire it for web scraping.

### 2. Gmail API
```bash
npm run adapter:gmail
```

Wraps Gmail API so agents can send/read emails.

### 3. Google Calendar
```bash
npm run adapter:calendar
```

Wraps Calendar API for scheduling.

### 4. Your WhatsApp Agent
```bash
npm run adapter:whatsapp
```

Makes your WhatsApp agent available to others.

---

## Create Your Own Adapter

```typescript
import { BaseAdapter, TaskResult } from 'relay-protocol/adapters';

class MyServiceAdapter extends BaseAdapter {
  async handleTask(task: string, params: any): Promise<TaskResult> {
    // Use your existing service/API
    const result = await myExistingService.doSomething(params);

    return {
      success: true,
      result
    };
  }
}

// Start it
const adapter = new MyServiceAdapter({
  agentId: 'my_service_001',
  agentName: 'MyService',
  capabilities: ['capability_name'],
  port: 8400
});

adapter.start();
```

---

## Real-World Flow

### User talks to WhatsApp Agent:
```
User: "Book me a flight and add it to my calendar"
```

### Behind the scenes:

```typescript
// WhatsApp agent doesn't know how to book flights or use calendar
// So it delegates via Relay:

// Find flight booking agent (could be any travel API)
const flightAgent = await relay.findAgent({ canDo: 'book_flights' });
const flight = await relay.pay(flightAgent, 500, {
  task: 'book_flights',
  params: { destination: 'NYC', date: '2024-03-15' }
});

// Find calendar agent (Google Calendar, Outlook, etc.)
const calendarAgent = await relay.findAgent({ canDo: 'add_calendar_event' });
await relay.pay(calendarAgent, 100, {
  task: 'add_calendar_event',
  params: {
    title: 'Flight to NYC',
    date: flight.result.departure
  }
});

// Tell user
return "✈️ Flight booked and added to calendar!";
```

### User sees:
```
WhatsApp Agent: "✈️ Flight booked and added to calendar!"
```

**User never knows Relay exists.** Your agent just got more powerful by connecting to the network.

---

## Benefits

✅ **Use existing agents** - Don't rebuild what exists
✅ **Simple integration** - Wrap any API in 10 lines
✅ **Automatic discovery** - Agents find each other by capability
✅ **Secure payments** - Escrow handles credits automatically
✅ **No coordination needed** - Agents don't need to know about each other in advance

---

## Next Steps

1. **Start Relay**: `relay start`
2. **Connect an existing agent**: Use an adapter
3. **Test delegation**: Make one agent hire another
4. **Add more agents**: The network gets more powerful

---

**Relay is infrastructure, not a platform.** You're not building new agents - you're connecting existing ones.

/**
 * Example: WhatsApp AI Agent using Relay
 *
 * Shows how a WhatsApp agent automatically delegates tasks
 * it can't do to other agents via Relay
 */

import { Relay } from '../src/sdk/simple-sdk';

// Initialize Relay (reads from ~/.relay)
const relay = new Relay();

/**
 * WhatsApp message handler
 */
async function handleWhatsAppMessage(from: string, message: string): Promise<string> {
  console.log(`\nUser: ${message}`);

  // Check if user wants flight booking
  if (message.toLowerCase().includes('book flight') || message.toLowerCase().includes('find flights')) {
    return await handleFlightRequest(message);
  }

  // Check if user wants email
  if (message.toLowerCase().includes('send email') || message.toLowerCase().includes('email')) {
    return await handleEmailRequest(message);
  }

  // Regular AI response (agent can do this itself)
  return `I can help with that! (This is where your AI model responds)`;
}

/**
 * Delegate flight booking to specialized agent
 */
async function handleFlightRequest(message: string): Promise<string> {
  console.log('→ Agent needs flight booking capability...');

  // Find agent that can book flights
  const flightAgent = await relay.findAgent({ canDo: 'book_flights' });

  if (!flightAgent) {
    return "Sorry, I can't book flights right now. No flight agents are available.";
  }

  console.log(`→ Found ${flightAgent.agentName} (reputation: ${flightAgent.reputation})`);
  console.log('→ Creating escrow and delegating task...');

  // Pay agent to do the work
  const result = await relay.pay(flightAgent, 500, {
    task: 'search flights',
    params: { query: message },
    timeout: 30,
  });

  if (result.success) {
    console.log('→ Task completed successfully!');
    return `✈️ ${result.result}`;
  } else {
    console.log(`→ Task failed: ${result.error}`);
    return `Sorry, couldn't find flights: ${result.error}`;
  }
}

/**
 * Delegate email sending to specialized agent
 */
async function handleEmailRequest(message: string): Promise<string> {
  console.log('→ Agent needs email capability...');

  const emailAgent = await relay.findAgent({ canDo: 'send_email' });

  if (!emailAgent) {
    return "Sorry, I can't send emails right now.";
  }

  console.log(`→ Found ${emailAgent.agentName}`);

  const result = await relay.pay(emailAgent, 100, {
    task: 'send email',
    params: { content: message },
  });

  return result.success
    ? '✅ Email sent!'
    : `Failed to send email: ${result.error}`;
}

/**
 * Example usage
 */
async function main() {
  console.log('WhatsApp Agent with Relay Integration\n');
  console.log('─'.repeat(50));

  // Simulate user messages
  const messages = [
    'Hello!',
    'Book me a flight to Paris for March 15th',
    'Send an email to my boss saying I\'ll be late',
  ];

  for (const msg of messages) {
    const response = await handleWhatsAppMessage('+1234567890', msg);
    console.log(`Agent: ${response}\n`);
    console.log('─'.repeat(50));
  }

  // Show final balance
  const balance = await relay.getBalance();
  console.log(`\nFinal balance: ${balance} credits`);
}

// Run example
if (require.main === module) {
  main().catch(console.error);
}

export { handleWhatsAppMessage };

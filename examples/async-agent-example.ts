/**
 * Example: Async Agent with Webhook Support
 *
 * Demonstrates long-running tasks with callbacks
 */

import { AsyncAdapter } from '../src/adapters/async-adapter';

// Simulate work delay
function simulateWork(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Create async adapter with optional escrow support
const agent = new AsyncAdapter({
  agentId: 'data-processing-agent',
  agentName: 'DataProcessingAgent',
  port: 8300,
  defaultTimeout: 10 * 60 * 1000, // 10 minutes

  // Optional: Enable escrow for paid tasks
  escrowUrl: 'http://127.0.0.1:9010',
  developmentMode: true, // Use simple escrow (no signatures required)

  // Optional: Add keypair for signed requests (production mode)
  // keyPair: await generateKeys(),
});

// Set task handler
agent.onTask(async (task, params) => {
  if (task === 'process_large_dataset') {
    // Simulate long-running task (e.g., data processing)
    console.log(`🔄 Processing dataset: ${params.datasetId}`);

    await simulateWork(5000); // 5 seconds

    return {
      datasetId: params.datasetId,
      rowsProcessed: 10000,
      summary: 'Dataset processed successfully',
      completedAt: new Date().toISOString(),
    };
  }

  if (task === 'generate_report') {
    console.log(`📊 Generating report: ${params.reportType}`);

    await simulateWork(3000); // 3 seconds

    return {
      reportId: `report_${Date.now()}`,
      reportType: params.reportType,
      downloadUrl: `https://example.com/reports/report_${Date.now()}.pdf`,
    };
  }

  throw new Error(`Unknown task: ${task}`);
});

// Start the agent
agent.start();

console.log('\n📡 Async Agent Started!');
console.log('');
console.log('Try it:');
console.log('');
console.log('# Start async task with webhook callback:');
console.log('curl -X POST http://localhost:8300/execute/async \\');
console.log('  -H "Content-Type: application/json" \\');
console.log('  -d \'{"task": "process_large_dataset", "params": {"datasetId": "dataset-001"}, "callbackUrl": "http://localhost:9999/webhook"}\'');
console.log('');
console.log('# Or with payment (if escrow enabled):');
console.log('curl -X POST http://localhost:8300/execute/async \\');
console.log('  -H "Content-Type: application/json" \\');
console.log('  -d \'{"task": "process_large_dataset", "params": {"datasetId": "dataset-001"}, "payment": 100, "fromAgentId": "client-agent-001"}\'');
console.log('');
console.log('# Returns: {"taskId": "task_xxx", "status": "pending", "statusUrl": "...", "lockId": "..."}');
console.log('');
console.log('# Check task status:');
console.log('curl http://localhost:8300/status/task_xxx');
console.log('');

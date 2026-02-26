/**
 * Quick Connect - Ultra-simple way to connect ANY agent to Relay
 *
 * Usage:
 *   import { quickConnect } from 'relay-protocol';
 *
 *   quickConnect({
 *     name: 'MyAgent',
 *     capabilities: ['do_something'],
 *     handler: async (task, params) => {
 *       // Your existing code here
 *       return result;
 *     }
 *   });
 */

import { BaseAdapter, TaskResult } from '../adapters/base-adapter';

export interface QuickConnectConfig {
  name: string;
  capabilities: string[];
  handler: (task: string, params: Record<string, any>) => Promise<any>;
  port?: number;
  registryUrl?: string;
  escrowUrl?: string;
}

// Internal adapter class
class QuickConnectAdapter extends BaseAdapter {
  private handler: (task: string, params: Record<string, any>) => Promise<any>;

  constructor(
    config: {
      agentId: string;
      agentName: string;
      capabilities: string[];
      port: number;
      registryUrl?: string;
      escrowUrl?: string;
    },
    handler: (task: string, params: Record<string, any>) => Promise<any>
  ) {
    super(config);
    this.handler = handler;
  }

  async handleTask(task: string, params: Record<string, any>): Promise<TaskResult> {
    try {
      const result = await this.handler(task, params);
      return {
        success: true,
        result,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Unknown error',
      };
    }
  }
}

/**
 * Connect any agent to Relay in 5 lines
 */
export function quickConnect(config: QuickConnectConfig): void {
  // Create adapter with auto-generated ID
  const agentId = `${config.name.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`;
  const port = config.port || 8000 + Math.floor(Math.random() * 1000);

  // Instantiate and start
  const adapter = new QuickConnectAdapter(
    {
      agentId,
      agentName: config.name,
      capabilities: config.capabilities,
      port,
      registryUrl: config.registryUrl,
      escrowUrl: config.escrowUrl,
    },
    config.handler
  );

  adapter.start();

  console.log(`✓ ${config.name} connected to Relay`);
  console.log(`  Agent ID: ${agentId}`);
  console.log(`  Port: ${port}`);
  console.log(`  Capabilities: ${config.capabilities.join(', ')}`);
}

/**
 * Base Adapter - Connects existing agents/APIs to Relay
 *
 * Use this to wrap any existing agent (OpenClaw, ChatGPT, Gmail API, etc.)
 * so it can communicate via Relay
 */

import express from 'express';
import axios from 'axios';

export interface AdapterConfig {
  agentId: string;
  agentName: string;
  capabilities: string[]; // What this agent can do
  port: number;
  registryUrl?: string;
  escrowUrl?: string;
}

export interface TaskRequest {
  taskId: string;
  escrowId: string;
  task: string;
  params: Record<string, any>;
  payment: number;
}

export interface TaskResult {
  success: boolean;
  result?: any;
  error?: string;
}

/**
 * Base adapter that any agent can extend
 */
export abstract class BaseAdapter {
  protected config: AdapterConfig;
  protected registryUrl: string;
  protected escrowUrl: string;
  private app: express.Application;

  constructor(config: AdapterConfig) {
    this.config = config;
    this.registryUrl = config.registryUrl || 'http://127.0.0.1:9001';
    this.escrowUrl = config.escrowUrl || 'http://127.0.0.1:9010';
    this.app = express();
    this.app.use(express.json());
    this.setupRoutes();
  }

  /**
   * Override this to implement your agent's logic
   */
  abstract handleTask(task: string, params: Record<string, any>): Promise<TaskResult>;

  /**
   * Setup standard Relay routes
   */
  private setupRoutes(): void {
    // Health check
    this.app.get('/status', (req, res) => {
      res.json({
        agentId: this.config.agentId,
        agentName: this.config.agentName,
        status: 'healthy',
        capabilities: this.config.capabilities,
      });
    });

    // Execute task (called by other agents)
    this.app.post('/execute', async (req, res) => {
      const { taskId, escrowId, task, params, payment } = req.body;

      console.log(`📨 Task received: ${taskId}`);
      console.log(`   Task: ${task}`);
      console.log(`   Payment: ${payment} credits`);

      try {
        // Call the agent's implementation
        const result = await this.handleTask(task, params);

        console.log(`   ✓ Task completed`);
        res.json(result);
      } catch (error: any) {
        console.log(`   ✗ Task failed: ${error.message}`);
        res.json({
          success: false,
          error: error.message,
        });
      }
    });
  }

  /**
   * Register with Relay
   */
  async register(): Promise<void> {
    const manifest = {
      agentId: this.config.agentId,
      agentName: this.config.agentName,
      endpoint: `http://127.0.0.1:${this.config.port}`,
      capabilities: this.config.capabilities.map(name => ({
        name,
        description: `${this.config.agentName} can ${name}`,
        pricing: { basePrice: 100, currency: 'credits' },
        estimatedDuration: 30,
      })),
      version: '1.0.0',
      sandboxLevel: 'isolated',
      verificationMode: 'automated',
      maxConcurrentTasks: 5,
      minReputationRequired: 0,
      acceptsDisputes: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    try {
      await axios.post(`${this.registryUrl}/agents`, {
        agentId: this.config.agentId,
        agentName: this.config.agentName,
        endpoint: `http://127.0.0.1:${this.config.port}`,
        manifest,
      });
      console.log(`✓ Registered with Relay: ${this.config.capabilities.join(', ')}`);
    } catch (error) {
      console.error('Failed to register:', error);
    }
  }

  /**
   * Start the adapter server
   */
  async start(): Promise<void> {
    await this.register();

    this.app.listen(this.config.port, () => {
      console.log('');
      console.log('┌─────────────────────────────────────────┐');
      console.log(`│  ${this.config.agentName.padEnd(39)} │`);
      console.log('└─────────────────────────────────────────┘');
      console.log('');
      console.log(`Endpoint: http://127.0.0.1:${this.config.port}`);
      console.log(`Capabilities: ${this.config.capabilities.join(', ')}`);
      console.log('');
      console.log('Waiting for tasks...');
      console.log('');
    });
  }
}

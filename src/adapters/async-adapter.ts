/**
 * Async Adapter - Standalone adapter for long-running tasks
 *
 * Features:
 * - Returns taskId immediately
 * - Processes in background
 * - Sends webhook callback when done
 * - Provides /status/:taskId endpoint
 */

import express from 'express';
import axios from 'axios';
import { AsyncTaskManager, getTaskManager, TaskStatus, TaskOptions } from '../tasks/async-task-manager';
import { KeyPair, RelaySign } from '../crypto/signer';
import { createSignedHeaders, RELAY_AUTH_HEADERS } from '../network/request-auth';
import { TaskContract, TaskContractHelper } from '../schemas/contract';

export interface AsyncAdapterConfig {
  agentId: string;
  agentName: string;
  port: number;
  defaultTimeout?: number; // Default: 5 minutes
  /**
   * Optional escrow URL for payment handling
   * If not provided, tasks run without payment/escrow
   */
  escrowUrl?: string;
  /**
   * Optional keypair for signed escrow operations
   * Required if escrowUrl is provided and server requires signatures
   */
  keyPair?: KeyPair;
  /**
   * Development mode: Uses simple escrow endpoints without contracts
   * Default: true
   */
  developmentMode?: boolean;
}

export interface TaskHandler {
  (task: string, params: Record<string, any>): Promise<any>;
}

export class AsyncAdapter {
  private config: AsyncAdapterConfig;
  private app: express.Application;
  private taskManager: AsyncTaskManager;
  private defaultTimeout: number;
  private handler?: TaskHandler;
  private escrowUrl?: string;
  private keyPair?: KeyPair;
  private developmentMode: boolean;

  constructor(config: AsyncAdapterConfig) {
    this.config = config;
    this.app = express();
    this.app.use(express.json());
    this.taskManager = getTaskManager();
    this.defaultTimeout = config.defaultTimeout || 5 * 60 * 1000; // 5 minutes
    this.escrowUrl = config.escrowUrl;
    this.keyPair = config.keyPair;
    this.developmentMode = config.developmentMode !== false; // Default: true
    this.setupRoutes();
  }

  /**
   * Set the task handler
   */
  onTask(handler: TaskHandler): void {
    this.handler = handler;
  }

  /**
   * Setup routes
   */
  private setupRoutes(): void {
    // Health check
    this.app.get('/status', (_req, res) => {
      res.json({
        agentId: this.config.agentId,
        agentName: this.config.agentName,
        status: 'healthy',
      });
    });

    // Async execute endpoint
    this.app.post('/execute/async', async (req, res) => {
      try {
        const { task, params, callbackUrl, timeout, payment, fromAgentId, lockId } = req.body;

        if (!task) {
          res.status(400).json({ error: 'Missing task parameter' });
          return;
        }

        // If escrow is configured and payment provided, lock funds first
        let effectiveLockId: string | null = lockId || null;
        if (!effectiveLockId && this.escrowUrl) {
          if (!this.developmentMode) {
            res.status(400).json({
              error:
                'Production mode requires a pre-locked contract. Provide lockId (contractId) from delegator.',
            });
            return;
          }
          if (payment && fromAgentId) {
            try {
              effectiveLockId = await this.lockEscrow(`task_${Date.now()}`, fromAgentId, payment);
              console.log(`🔒 Locked ${payment} credits in escrow: ${effectiveLockId}`);
            } catch (error: any) {
              res.status(402).json({ error: `Payment failed: ${error.message}` });
              return;
            }
          }
        }

        // Create task
        const taskId = `task_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
        const taskOptions: TaskOptions = {
          callbackUrl,
          timeout: timeout || this.defaultTimeout,
          metadata: { task, params, payment, lockId: effectiveLockId },
        };

        this.taskManager.createTask(taskId, taskOptions);

        // Return taskId immediately
        res.status(202).json({
          taskId,
          status: TaskStatus.PENDING,
          statusUrl: `http://localhost:${this.config.port}/status/${taskId}`,
          lockId: effectiveLockId,
        });

        // Process in background
        this.processAsync(taskId, task, params, effectiveLockId);
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    // Status endpoint
    this.app.get('/status/:taskId', (req, res) => {
      const taskId = req.params.taskId;
      const task = this.taskManager.getTask(taskId);

      if (!task) {
        res.status(404).json({ error: 'Task not found' });
        return;
      }

      res.json({
        taskId: task.taskId,
        status: task.status,
        result: task.result,
        error: task.error,
        createdAt: task.createdAt,
        startedAt: task.startedAt,
        completedAt: task.completedAt,
      });
    });

    // Tasks list endpoint (for debugging)
    this.app.get('/tasks', (_req, res) => {
      const tasks = this.taskManager.getAllTasks();
      res.json({ tasks });
    });

    // Contract signing endpoint (production mode)
    this.app.post('/contract/sign', async (req, res) => {
      try {
        const { contract } = req.body;

        if (!contract) {
          res.status(400).json({ error: 'contract is required' });
          return;
        }

        // Check if this agent has keypair for signing
        if (!this.keyPair) {
          res.status(400).json({
            error: 'Agent not configured for production mode (no keypair)',
            hint: 'Add keyPair to AsyncAdapterConfig to support contract signing',
          });
          return;
        }

        const typedContract = contract as TaskContract;

        // Verify this agent is the performer
        if (typedContract.performerId !== this.config.agentId) {
          res.status(400).json({
            error: `Contract performer mismatch. Expected ${this.config.agentId}, got ${typedContract.performerId}`,
          });
          return;
        }

        if (!typedContract.delegatorSignature) {
          res.status(400).json({ error: 'Contract missing delegator signature' });
          return;
        }

        const delegatorAgentId = req.headers[RELAY_AUTH_HEADERS.agentId];
        const delegatorPublicKeyEncoded = req.headers[RELAY_AUTH_HEADERS.publicKey];
        const normalizedDelegatorAgentId = Array.isArray(delegatorAgentId)
          ? delegatorAgentId[0]
          : delegatorAgentId;
        const normalizedPublicKeyEncoded = Array.isArray(delegatorPublicKeyEncoded)
          ? delegatorPublicKeyEncoded[0]
          : delegatorPublicKeyEncoded;

        if (!normalizedDelegatorAgentId || normalizedDelegatorAgentId !== typedContract.delegatorId) {
          res.status(401).json({ error: 'Delegator identity mismatch for contract signing request' });
          return;
        }

        if (!normalizedPublicKeyEncoded) {
          res.status(401).json({ error: 'Missing delegator public key header' });
          return;
        }

        const delegatorPublicKey = Buffer.from(normalizedPublicKeyEncoded, 'base64').toString('utf-8');
        const helper = new TaskContractHelper(typedContract);
        const signable = helper.toSignable();
        const delegatorSignatureValid = RelaySign.verify(
          signable,
          typedContract.delegatorSignature,
          delegatorPublicKey
        );
        if (!delegatorSignatureValid) {
          res.status(401).json({ error: 'Invalid delegator contract signature' });
          return;
        }

        // Sign the validated contract as performer
        const signatureResult = RelaySign.sign(signable, this.keyPair.privateKey);

        const signedContract: TaskContract = {
          ...typedContract,
          performerSignature: signatureResult.signature,
        };

        console.log(`✓ Signed contract: ${typedContract.contractId}`);
        res.json({ success: true, contract: signedContract });
      } catch (error: any) {
        console.error(`✗ Contract signing failed: ${error.message}`);
        res.status(500).json({ error: error.message });
      }
    });
  }

  /**
   * Process task asynchronously
   */
  private async processAsync(
    taskId: string,
    task: string,
    params: Record<string, any>,
    lockId: string | null
  ): Promise<void> {
    try {
      // Mark as in progress
      this.taskManager.startTask(taskId);

      if (!this.handler) {
        throw new Error('No task handler configured');
      }

      // Execute the actual work
      const result = await this.handler(task, params);

      // Mark as completed
      await this.taskManager.completeTask(taskId, result);

      // Release escrow payment to performer (this agent)
      if (lockId) {
        await this.releaseEscrow(lockId);
      }
    } catch (error: any) {
      // Mark as failed
      await this.taskManager.failTask(taskId, error.message);

      // Refund escrow payment to client
      if (lockId) {
        await this.refundEscrow(lockId);
      }
    }
  }

  /**
   * Lock funds in escrow for task payment
   */
  private async lockEscrow(
    taskId: string,
    fromAgentId: string,
    amount: number
  ): Promise<string | null> {
    if (!this.escrowUrl) {
      return null; // No escrow configured
    }

    try {
      if (this.developmentMode) {
        // Development mode: Simple API
        const body = {
          taskId,
          fromAgentId,
          toAgentId: this.config.agentId,
          amount,
        };

        const response = await axios.post(`${this.escrowUrl}/lock/simple`, body);
        return response.data.lockId || response.data.contractId;
      } else {
        throw new Error('Production mode requires pre-locked contractId from delegator (lockId)');
      }
    } catch (error: any) {
      console.error('Failed to lock escrow:', error.message);
      throw error;
    }
  }

  /**
   * Release escrow payment to performer
   */
  private async releaseEscrow(lockId: string): Promise<void> {
    if (!this.escrowUrl || !lockId) return;

    try {
      if (this.developmentMode) {
        await axios.post(`${this.escrowUrl}/release/simple`, { lockId });
      } else {
        const body = { contractId: lockId };
        const headers = this.getSignedHeaders('POST', '/release', body);
        await axios.post(`${this.escrowUrl}/release`, body, { headers });
      }
      console.log(`✓ Released escrow: ${lockId}`);
    } catch (error: any) {
      console.error('Failed to release escrow:', error.message);
    }
  }

  /**
   * Refund escrow payment to client
   */
  private async refundEscrow(lockId: string): Promise<void> {
    if (!this.escrowUrl || !lockId) return;

    try {
      if (this.developmentMode) {
        await axios.post(`${this.escrowUrl}/refund/simple`, { lockId });
      } else {
        const body = { contractId: lockId };
        const headers = this.getSignedHeaders('POST', '/refund', body);
        await axios.post(`${this.escrowUrl}/refund`, body, { headers });
      }
      console.log(`✓ Refunded escrow: ${lockId}`);
    } catch (error: any) {
      console.error('Failed to refund escrow:', error.message);
    }
  }

  /**
   * Create signed request headers for escrow calls
   */
  private getSignedHeaders(method: string, path: string, body?: any): Record<string, string> {
    if (!this.keyPair) {
      return {};
    }

    const rawBody = body ? JSON.stringify(body) : undefined;

    return createSignedHeaders({
      agentId: this.config.agentId,
      privateKey: this.keyPair.privateKey,
      publicKey: this.keyPair.publicKey,
      method,
      path,
      rawBody,
    });
  }

  /**
   * Start the server
   */
  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.app.listen(this.config.port, () => {
        console.log(`✅ ${this.config.agentName} started on port ${this.config.port}`);
        if (this.escrowUrl) {
          const mode = this.developmentMode ? 'development' : 'production';
          console.log(`   Escrow: Enabled (${mode} mode)`);
        } else {
          console.log(`   Escrow: Disabled (no payment required)`);
        }
        resolve();
      });
    });
  }
}

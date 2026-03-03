/**
 * Async Relay Client - Support for long-running delegations
 *
 * Extends Relay class with async task support
 */

import axios from 'axios';
import { Relay, Agent, DelegationRequest } from './simple-sdk';
import { TaskStatus } from '../tasks/async-task-manager';

export interface AsyncDelegationOptions extends Omit<DelegationRequest, 'payment'> {
  /**
   * Webhook URL to receive result when task completes
   */
  callbackUrl?: string;

  /**
   * Poll for result instead of using webhook
   * Default: false
   */
  poll?: boolean;

  /**
   * Polling interval in ms (if poll=true)
   * Default: 2000 (2 seconds)
   */
  pollInterval?: number;

  /**
   * Max polling time in ms (if poll=true)
   * Default: 5 minutes
   */
  maxPollTime?: number;
}

export interface AsyncDelegationResult {
  taskId: string;
  status: TaskStatus;
  statusUrl: string;
  result?: any;
  error?: string;
}

export class AsyncRelay extends Relay {
  /**
   * Delegate task asynchronously with webhook callback
   */
  async payAsync(
    agent: Agent,
    amount: number,
    options: AsyncDelegationOptions
  ): Promise<AsyncDelegationResult> {
    await (this as any).initialize();
    const taskId = `task_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    let lockId: string | null = null;

    try {
      // Pre-lock payment/contract on delegator side (dev or production based on Relay mode)
      lockId = await (this as any).lockEscrow(taskId, agent.agentId, amount, {
        task: options.task,
        params: options.params,
        timeout: options.timeout,
      });

      const body: Record<string, unknown> = {
        task: options.task,
        params: options.params,
        callbackUrl: options.callbackUrl,
        timeout: options.timeout,
        payment: amount,
        fromAgentId: (this as any).agentId,
        lockId,
      };
      const headers = (this as any).getSignedHeaders('POST', '/execute/async', body);

      // Start async task
      const response = await axios.post(`${agent.endpoint}/execute/async`, body, { headers });
      const { taskId: asyncTaskId, statusUrl } = response.data as {
        taskId: string;
        statusUrl: string;
      };

      // If polling requested, wait for result
      if (options.poll) {
        return await this.pollForResult(
          statusUrl,
          options.pollInterval || 2000,
          options.maxPollTime || 5 * 60 * 1000
        );
      }

      // Otherwise return taskId immediately
        return {
          taskId: asyncTaskId,
          status: TaskStatus.PENDING,
          statusUrl,
        };
    } catch (error: any) {
      if (lockId) {
        try {
          await (this as any).refundEscrow(lockId);
        } catch {
          // Best effort rollback if async task creation fails.
        }
      }
      throw new Error(`Async delegation failed: ${error.message}`);
    }
  }

  /**
   * Poll for task result
   */
  async pollForResult(
    statusUrl: string,
    interval: number,
    maxTime: number
  ): Promise<AsyncDelegationResult> {
    const startTime = Date.now();

    while (Date.now() - startTime < maxTime) {
      try {
        const response = await axios.get(statusUrl);
        const { taskId, status, result, error } = response.data;

        if (status === TaskStatus.COMPLETED) {
          return {
            taskId,
            status: TaskStatus.COMPLETED,
            statusUrl,
            result,
          };
        }

        if (status === TaskStatus.FAILED) {
          return {
            taskId,
            status: TaskStatus.FAILED,
            statusUrl,
            error,
          };
        }

        // Still in progress, wait and retry
        await new Promise((resolve) => setTimeout(resolve, interval));
      } catch (error: any) {
        throw new Error(`Polling failed: ${error.message}`);
      }
    }

    throw new Error(`Polling timeout exceeded (${maxTime}ms)`);
  }

  /**
   * Check status of async task
   */
  async getTaskStatus(statusUrl: string): Promise<AsyncDelegationResult> {
    try {
      const response = await axios.get(statusUrl);
      return response.data;
    } catch (error: any) {
      throw new Error(`Failed to get task status: ${error.message}`);
    }
  }
}

/**
 * Async Task Manager - Webhook support for long-running agent tasks
 *
 * Enables agents to:
 * 1. Accept tasks and return taskId immediately
 * 2. Process tasks asynchronously
 * 3. POST results to callback webhook when done
 * 4. Provide /status/:taskId endpoint for polling
 */

import axios from 'axios';
import { EventEmitter } from 'events';

export enum TaskStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export interface AsyncTask {
  taskId: string;
  status: TaskStatus;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  result?: any;
  error?: string;
  callbackUrl?: string;
  metadata?: Record<string, any>;
}

export interface TaskOptions {
  callbackUrl?: string;
  timeout?: number; // milliseconds
  metadata?: Record<string, any>;
}

export class AsyncTaskManager extends EventEmitter {
  private tasks = new Map<string, AsyncTask>();
  private timeouts = new Map<string, NodeJS.Timeout>();

  /**
   * Create a new async task
   */
  createTask(taskId: string, options?: TaskOptions): AsyncTask {
    const task: AsyncTask = {
      taskId,
      status: TaskStatus.PENDING,
      createdAt: Date.now(),
      callbackUrl: options?.callbackUrl,
      metadata: options?.metadata,
    };

    this.tasks.set(taskId, task);

    // Set timeout if specified
    if (options?.timeout) {
      const timeoutHandle = setTimeout(() => {
        this.failTask(taskId, 'Task timeout exceeded');
      }, options.timeout);

      this.timeouts.set(taskId, timeoutHandle);
    }

    this.emit('task:created', task);
    return task;
  }

  /**
   * Mark task as in progress
   */
  startTask(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (!task) throw new Error(`Task ${taskId} not found`);

    task.status = TaskStatus.IN_PROGRESS;
    task.startedAt = Date.now();

    this.tasks.set(taskId, task);
    this.emit('task:started', task);
  }

  /**
   * Complete task with result
   */
  async completeTask(taskId: string, result: any): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) throw new Error(`Task ${taskId} not found`);

    task.status = TaskStatus.COMPLETED;
    task.completedAt = Date.now();
    task.result = result;

    this.tasks.set(taskId, task);
    this.clearTimeout(taskId);

    this.emit('task:completed', task);

    // Send webhook callback if specified
    if (task.callbackUrl) {
      await this.sendCallback(task);
    }
  }

  /**
   * Fail task with error
   */
  async failTask(taskId: string, error: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) throw new Error(`Task ${taskId} not found`);

    task.status = TaskStatus.FAILED;
    task.completedAt = Date.now();
    task.error = error;

    this.tasks.set(taskId, task);
    this.clearTimeout(taskId);

    this.emit('task:failed', task);

    // Send webhook callback if specified
    if (task.callbackUrl) {
      await this.sendCallback(task);
    }
  }

  /**
   * Get task status
   */
  getTask(taskId: string): AsyncTask | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * Get all tasks
   */
  getAllTasks(): AsyncTask[] {
    return Array.from(this.tasks.values());
  }

  /**
   * Send webhook callback
   */
  private async sendCallback(task: AsyncTask): Promise<void> {
    if (!task.callbackUrl) return;

    try {
      await axios.post(
        task.callbackUrl,
        {
          taskId: task.taskId,
          status: task.status,
          result: task.result,
          error: task.error,
          completedAt: task.completedAt,
        },
        {
          timeout: 10000, // 10 second timeout for webhook
          headers: {
            'Content-Type': 'application/json',
            'X-Relay-Task-Id': task.taskId,
          },
        }
      );

      this.emit('webhook:sent', { taskId: task.taskId, url: task.callbackUrl });
    } catch (error: any) {
      this.emit('webhook:failed', {
        taskId: task.taskId,
        url: task.callbackUrl,
        error: error.message,
      });
    }
  }

  /**
   * Clear task timeout
   */
  private clearTimeout(taskId: string): void {
    const timeoutHandle = this.timeouts.get(taskId);
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
      this.timeouts.delete(taskId);
    }
  }

  /**
   * Clean up old completed/failed tasks
   */
  cleanup(olderThanMs: number = 24 * 60 * 60 * 1000): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [taskId, task] of this.tasks.entries()) {
      if (
        task.completedAt &&
        now - task.completedAt > olderThanMs &&
        (task.status === TaskStatus.COMPLETED || task.status === TaskStatus.FAILED)
      ) {
        this.tasks.delete(taskId);
        this.clearTimeout(taskId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.emit('tasks:cleaned', { count: cleaned });
    }

    return cleaned;
  }
}

// Global singleton instance
let globalTaskManager: AsyncTaskManager | null = null;

export function getTaskManager(): AsyncTaskManager {
  if (!globalTaskManager) {
    globalTaskManager = new AsyncTaskManager();

    // Auto-cleanup every hour
    setInterval(() => {
      globalTaskManager!.cleanup();
    }, 60 * 60 * 1000);
  }

  return globalTaskManager;
}

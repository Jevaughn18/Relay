/**
 * A2A Protocol Types
 *
 * Agent-to-Agent Protocol message types and schemas
 */

import { z } from 'zod';

/**
 * A2A Protocol version
 */
export const A2A_VERSION = '1.0.0';

/**
 * A2A message types
 */
export enum A2AMessageType {
  // Discovery
  ANNOUNCE = 'announce',
  DISCOVER = 'discover',

  // Task delegation
  TASK_REQUEST = 'task_request',
  TASK_ACCEPT = 'task_accept',
  TASK_REJECT = 'task_reject',

  // Execution
  TASK_START = 'task_start',
  TASK_PROGRESS = 'task_progress',
  TASK_COMPLETE = 'task_complete',
  TASK_FAIL = 'task_fail',

  // Verification
  VERIFY_REQUEST = 'verify_request',
  VERIFY_RESPONSE = 'verify_response',

  // Settlement
  SETTLE_REQUEST = 'settle_request',
  SETTLE_RESPONSE = 'settle_response',

  // Disputes
  DISPUTE_RAISE = 'dispute_raise',
  DISPUTE_RESOLVE = 'dispute_resolve',

  // General
  PING = 'ping',
  PONG = 'pong',
  ERROR = 'error',
}

/**
 * Base A2A message schema
 */
export const A2AMessageSchema = z.object({
  version: z.string().default(A2A_VERSION),
  messageId: z.string(),
  timestamp: z.date().default(() => new Date()),
  from: z.string().describe('Sender agent ID'),
  to: z.string().optional().describe('Recipient agent ID'),
  type: z.nativeEnum(A2AMessageType),
  payload: z.record(z.any()),
  signature: z.string().optional().describe('Message signature'),
});

export type A2AMessage = z.infer<typeof A2AMessageSchema>;

/**
 * Task request message
 */
export const TaskRequestMessageSchema = A2AMessageSchema.extend({
  type: z.literal(A2AMessageType.TASK_REQUEST),
  payload: z.object({
    contractId: z.string(),
    capabilityName: z.string(),
    taskInput: z.record(z.any()),
    paymentAmount: z.number(),
    stakeAmount: z.number(),
    deadline: z.date(),
    contract: z.record(z.any()), // Full contract object
  }),
});

export type TaskRequestMessage = z.infer<typeof TaskRequestMessageSchema>;

/**
 * Task accept message
 */
export const TaskAcceptMessageSchema = A2AMessageSchema.extend({
  type: z.literal(A2AMessageType.TASK_ACCEPT),
  payload: z.object({
    contractId: z.string(),
    signature: z.string(),
    estimatedCompletion: z.date().optional(),
  }),
});

export type TaskAcceptMessage = z.infer<typeof TaskAcceptMessageSchema>;

/**
 * Task progress message
 */
export const TaskProgressMessageSchema = A2AMessageSchema.extend({
  type: z.literal(A2AMessageType.TASK_PROGRESS),
  payload: z.object({
    contractId: z.string(),
    progress: z.number().min(0).max(100),
    status: z.string(),
    logs: z.array(z.string()).optional(),
  }),
});

export type TaskProgressMessage = z.infer<typeof TaskProgressMessageSchema>;

/**
 * Task complete message
 */
export const TaskCompleteMessageSchema = A2AMessageSchema.extend({
  type: z.literal(A2AMessageType.TASK_COMPLETE),
  payload: z.object({
    contractId: z.string(),
    deliverable: z.record(z.any()),
    executionProof: z.record(z.any()),
  }),
});

export type TaskCompleteMessage = z.infer<typeof TaskCompleteMessageSchema>;

/**
 * Agent announcement message
 */
export const AnnounceMessageSchema = A2AMessageSchema.extend({
  type: z.literal(A2AMessageType.ANNOUNCE),
  payload: z.object({
    agentId: z.string(),
    agentName: z.string(),
    capabilities: z.array(z.string()),
    endpoint: z.string().url(),
    manifest: z.record(z.any()),
  }),
});

export type AnnounceMessage = z.infer<typeof AnnounceMessageSchema>;

/**
 * Error message
 */
export const ErrorMessageSchema = A2AMessageSchema.extend({
  type: z.literal(A2AMessageType.ERROR),
  payload: z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.any()).optional(),
    originalMessageId: z.string().optional(),
  }),
});

export type ErrorMessage = z.infer<typeof ErrorMessageSchema>;

/**
 * Message builder helper
 */
export class A2AMessageBuilder {
  static createMessage(
    from: string,
    to: string,
    type: A2AMessageType,
    payload: Record<string, any>
  ): A2AMessage {
    return {
      version: A2A_VERSION,
      messageId: crypto.randomUUID(),
      timestamp: new Date(),
      from,
      to,
      type,
      payload,
    };
  }

  static createTaskRequest(
    from: string,
    to: string,
    contract: any
  ): TaskRequestMessage {
    return {
      version: A2A_VERSION,
      messageId: crypto.randomUUID(),
      timestamp: new Date(),
      from,
      to,
      type: A2AMessageType.TASK_REQUEST,
      payload: {
        contractId: contract.contractId,
        capabilityName: contract.capabilityName,
        taskInput: contract.taskInput,
        paymentAmount: contract.paymentAmount,
        stakeAmount: contract.stakeAmount,
        deadline: contract.deadline,
        contract: contract,
      },
    };
  }

  static createTaskAccept(
    from: string,
    to: string,
    contractId: string,
    signature: string
  ): TaskAcceptMessage {
    return {
      version: A2A_VERSION,
      messageId: crypto.randomUUID(),
      timestamp: new Date(),
      from,
      to,
      type: A2AMessageType.TASK_ACCEPT,
      payload: {
        contractId,
        signature,
      },
    };
  }

  static createTaskProgress(
    from: string,
    to: string,
    contractId: string,
    progress: number,
    status: string,
    logs?: string[]
  ): TaskProgressMessage {
    return {
      version: A2A_VERSION,
      messageId: crypto.randomUUID(),
      timestamp: new Date(),
      from,
      to,
      type: A2AMessageType.TASK_PROGRESS,
      payload: {
        contractId,
        progress,
        status,
        logs,
      },
    };
  }

  static createTaskComplete(
    from: string,
    to: string,
    contractId: string,
    deliverable: any,
    executionProof: any
  ): TaskCompleteMessage {
    return {
      version: A2A_VERSION,
      messageId: crypto.randomUUID(),
      timestamp: new Date(),
      from,
      to,
      type: A2AMessageType.TASK_COMPLETE,
      payload: {
        contractId,
        deliverable,
        executionProof,
      },
    };
  }

  static createError(
    from: string,
    to: string,
    code: string,
    message: string,
    originalMessageId?: string
  ): ErrorMessage {
    return {
      version: A2A_VERSION,
      messageId: crypto.randomUUID(),
      timestamp: new Date(),
      from,
      to,
      type: A2AMessageType.ERROR,
      payload: {
        code,
        message,
        originalMessageId,
      },
    };
  }
}

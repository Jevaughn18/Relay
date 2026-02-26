/**
 * Task Contract Schema
 *
 * Defines the structured agreement between delegating and performing agents.
 */

import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';

/**
 * Task contract lifecycle states
 */
export enum ContractStatus {
  DRAFT = 'draft', // Contract created but not signed
  SIGNED = 'signed', // Both parties signed
  FUNDED = 'funded', // Escrow funded
  IN_PROGRESS = 'in_progress', // Work started
  DELIVERED = 'delivered', // Work submitted
  VERIFIED = 'verified', // Deliverable verified
  SETTLED = 'settled', // Payment released
  DISPUTED = 'disputed', // Dispute raised
  SLASHED = 'slashed', // Performer penalized
  CANCELLED = 'cancelled', // Contract cancelled
}

/**
 * Verification rule schema
 */
export const VerificationRuleSchema = z.object({
  type: z
    .enum(['schema', 'agent', 'manual', 'automated', 'hash', 'signature', 'attestation'])
    .describe('Verification type'),

  criteria: z.record(z.any()).describe('Verification criteria/parameters'),

  required: z.boolean().default(true).describe('Whether this verification is required'),
});

export type VerificationRule = z.infer<typeof VerificationRuleSchema>;

/**
 * Dispute window schema
 */
export const DisputeWindowSchema = z.object({
  durationSeconds: z.number().int().nonnegative().describe('How long dispute window stays open'),

  startsAt: z.date().optional().describe('When dispute window opens'),

  endsAt: z.date().optional().describe('When dispute window closes'),
});

export type DisputeWindow = z.infer<typeof DisputeWindowSchema>;

/**
 * Slashing condition schema
 */
export const SlashingConditionSchema = z.object({
  condition: z.string().min(1).describe('What triggers slashing'),

  penaltyPercentage: z
    .number()
    .min(0)
    .max(100)
    .describe('Percentage of stake to slash'),

  description: z.string().min(1).describe('Human-readable explanation'),
});

export type SlashingCondition = z.infer<typeof SlashingConditionSchema>;

/**
 * Complete task contract schema
 *
 * Cryptographically signed task contract between two agents.
 * This is the core coordination primitive in Relay.
 */
export const TaskContractSchema = z.object({
  // Contract identity
  contractId: z.string().default(() => uuidv4()).describe('Unique contract ID'),

  version: z.string().default('1.0.0').describe('Contract schema version'),

  // Parties
  delegatorId: z.string().min(1).describe('Agent delegating the task'),

  performerId: z.string().min(1).describe('Agent performing the task'),

  // Task specification
  capabilityName: z.string().min(1).describe('Which capability is being contracted'),

  taskDescription: z.string().min(1).describe('Human-readable task description'),

  taskInput: z.record(z.any()).describe('Task input data matching capability schema'),

  deliverableSchema: z.record(z.any()).describe('Expected output schema'),

  // Timing
  deadline: z.date().describe('Task must be completed by this time'),

  createdAt: z.date().default(() => new Date()),

  startedAt: z.date().optional().describe('When work actually started'),

  completedAt: z.date().optional().describe('When work was completed'),

  // Economics
  paymentAmount: z.number().nonnegative().describe('Payment in credits/tokens'),

  stakeAmount: z.number().nonnegative().default(0.0).describe('Performer stake (can be slashed)'),

  escrowFunded: z.boolean().default(false).describe('Whether payment is locked in escrow'),

  // Verification
  verificationRules: z
    .array(VerificationRuleSchema)
    .default([])
    .describe('How to verify deliverable'),

  disputeWindow: DisputeWindowSchema.describe('Time window for disputes'),

  slashingConditions: z
    .array(SlashingConditionSchema)
    .default([])
    .describe('When to slash performer stake'),

  // State
  status: z.nativeEnum(ContractStatus).default(ContractStatus.DRAFT),

  deliverable: z.record(z.any()).optional().describe('Submitted work output'),

  deliverableHash: z.string().optional().describe('Hash of deliverable for verification'),

  // Dispute handling
  disputeRaised: z.boolean().default(false),

  disputeReason: z.string().optional(),

  disputeResolverId: z
    .string()
    .optional()
    .describe('Third-party agent resolving dispute'),

  // Signatures
  delegatorSignature: z.string().optional().describe("Delegator's signature"),

  performerSignature: z.string().optional().describe("Performer's signature"),

  // Metadata
  metadata: z.record(z.any()).default({}).describe('Additional contract metadata'),
});

export type TaskContract = z.infer<typeof TaskContractSchema>;

/**
 * Helper class for working with task contracts
 */
export class TaskContractHelper {
  constructor(private contract: TaskContract) {}

  /**
   * Check if both parties have signed
   */
  isFullySigned(): boolean {
    return !!(this.contract.delegatorSignature && this.contract.performerSignature);
  }

  /**
   * Check if deadline has passed
   */
  isPastDeadline(): boolean {
    return new Date() > this.contract.deadline;
  }

  /**
   * Check if contract can be settled
   */
  canSettle(): boolean {
    return (
      this.contract.status === ContractStatus.VERIFIED &&
      this.isFullySigned() &&
      !this.contract.disputeRaised
    );
  }

  /**
   * Calculate time remaining until deadline
   */
  timeRemaining(): number {
    return this.contract.deadline.getTime() - new Date().getTime();
  }

  /**
   * Convert contract to signable object
   * Excludes signatures and mutable state fields
   */
  toSignable(): Record<string, unknown> {
    const {
      deliverable,
      deliverableHash,
      status,
      metadata,
      escrowFunded,
      startedAt,
      completedAt,
      disputeRaised,
      disputeReason,
      disputeResolverId,
      delegatorSignature,
      performerSignature,
      ...rest
    } = this.contract;

    return {
      ...rest,
      createdAt: this.contract.createdAt.toISOString(),
      deadline: this.contract.deadline.toISOString(),
    };
  }

  /**
   * Check if dispute window is active
   */
  isDisputeWindowActive(): boolean {
    const dw = this.contract.disputeWindow;
    if (!dw.startsAt || !dw.endsAt) return false;

    const now = new Date();
    return dw.startsAt <= now && now <= dw.endsAt;
  }

  /**
   * Open the dispute window
   */
  openDisputeWindow(): void {
    const startsAt = new Date();
    const endsAt = new Date(startsAt.getTime() + this.contract.disputeWindow.durationSeconds * 1000);

    this.contract.disputeWindow.startsAt = startsAt;
    this.contract.disputeWindow.endsAt = endsAt;
  }

  /**
   * Get contract duration in seconds
   */
  getDuration(): number {
    return (this.contract.deadline.getTime() - this.contract.createdAt.getTime()) / 1000;
  }
}

/**
 * Example task contract
 */
export const exampleTaskContract: TaskContract = {
  contractId: uuidv4(),
  version: '1.0.0',
  delegatorId: 'agent_alice_123',
  performerId: 'agent_bob_456',
  capabilityName: 'code_review',
  taskDescription: 'Review authentication module for security issues',
  taskInput: {
    code: 'def login(user, password): ...',
    language: 'python',
  },
  deliverableSchema: {
    type: 'object',
    properties: {
      issues: { type: 'array' },
      score: { type: 'number' },
    },
    required: ['issues', 'score'],
  },
  paymentAmount: 10.0,
  stakeAmount: 2.0,
  deadline: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
  disputeWindow: {
    durationSeconds: 3600, // 1 hour
  },
  status: ContractStatus.DRAFT,
  escrowFunded: false,
  disputeRaised: false,
  createdAt: new Date(),
  metadata: {},
  verificationRules: [],
  slashingConditions: [],
};

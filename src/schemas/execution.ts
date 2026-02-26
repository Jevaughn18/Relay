/**
 * Execution Proof Schema
 *
 * Defines how agents prove they performed work correctly.
 */

import { z } from 'zod';

/**
 * Tool usage log entry
 */
export const ToolLogSchema = z.object({
  toolName: z.string().min(1).describe('Name of the tool used'),

  timestamp: z.date().describe('When the tool was used'),

  input: z.record(z.any()).describe('Tool input parameters'),

  output: z.record(z.any()).optional().describe('Tool output'),

  durationMs: z.number().int().nonnegative().describe('Tool execution duration in milliseconds'),

  success: z.boolean().describe('Whether tool execution succeeded'),

  error: z.string().optional().describe('Error message if tool failed'),
});

export type ToolLog = z.infer<typeof ToolLogSchema>;

/**
 * Execution proof schema
 *
 * Provides verifiable evidence of task execution.
 */
export const ExecutionProofSchema = z.object({
  contractId: z.string().min(1).describe('Associated contract ID'),

  performerId: z.string().min(1).describe('Agent that performed the work'),

  // Execution timeline
  startedAt: z.date().describe('When execution started'),

  completedAt: z.date().describe('When execution completed'),

  durationSeconds: z.number().nonnegative().describe('Total execution time'),

  // Execution trace
  toolLogs: z.array(ToolLogSchema).describe('Timestamped tool usage logs'),

  executionTrace: z.array(z.string()).describe('Step-by-step execution trace'),

  // Input/output hashes
  inputHash: z.string().describe('SHA-256 hash of task input'),

  outputHash: z.string().describe('SHA-256 hash of deliverable'),

  // Deliverable
  deliverable: z.record(z.any()).describe('Actual work output'),

  // Verification
  verified: z.boolean().default(false).describe('Whether proof has been verified'),

  verifiedBy: z.string().optional().describe('Agent or system that verified the proof'),

  verifiedAt: z.date().optional().describe('When verification occurred'),

  // Metadata
  metadata: z.record(z.any()).default({}).describe('Additional execution metadata'),

  // Signature
  signature: z.string().optional().describe('Cryptographic signature of proof'),
});

export type ExecutionProof = z.infer<typeof ExecutionProofSchema>;

/**
 * Helper class for working with execution proofs
 */
export class ExecutionProofHelper {
  constructor(private proof: ExecutionProof) {}

  /**
   * Check if proof is verified
   */
  isVerified(): boolean {
    return this.proof.verified && !!this.proof.verifiedBy;
  }

  /**
   * Get total number of tools used
   */
  getToolCount(): number {
    return this.proof.toolLogs.length;
  }

  /**
   * Get failed tool executions
   */
  getFailedTools(): ToolLog[] {
    return this.proof.toolLogs.filter((log) => !log.success);
  }

  /**
   * Calculate success rate of tool executions
   */
  getToolSuccessRate(): number {
    if (this.proof.toolLogs.length === 0) return 1.0;

    const successfulTools = this.proof.toolLogs.filter((log) => log.success).length;
    return successfulTools / this.proof.toolLogs.length;
  }

  /**
   * Get execution efficiency (expected vs actual time)
   */
  getEfficiencyScore(expectedDurationSeconds: number): number {
    if (expectedDurationSeconds === 0) return 1.0;
    return Math.min(1.0, expectedDurationSeconds / this.proof.durationSeconds);
  }

  /**
   * Convert proof to signable object
   */
  toSignable(): Record<string, unknown> {
    const { signature, verified, verifiedBy, verifiedAt, ...rest } = this.proof;

    return {
      ...rest,
      startedAt: this.proof.startedAt.toISOString(),
      completedAt: this.proof.completedAt.toISOString(),
      toolLogs: this.proof.toolLogs.map((log) => ({
        ...log,
        timestamp: log.timestamp.toISOString(),
      })),
    };
  }
}

/**
 * Example execution proof
 */
export const exampleExecutionProof: ExecutionProof = {
  contractId: 'contract_123',
  performerId: 'agent_bob_456',
  startedAt: new Date(Date.now() - 300000), // 5 minutes ago
  completedAt: new Date(),
  durationSeconds: 300,
  toolLogs: [
    {
      toolName: 'code_analyzer',
      timestamp: new Date(Date.now() - 250000),
      input: { code: 'def login(...)', language: 'python' },
      output: { issues: [] },
      durationMs: 2500,
      success: true,
    },
  ],
  executionTrace: [
    'Received code review task',
    'Analyzed Python code',
    'Detected 3 security issues',
    'Generated review report',
  ],
  inputHash: 'sha256_abc123...',
  outputHash: 'sha256_def456...',
  deliverable: {
    issues: [
      { severity: 'high', message: 'SQL injection vulnerability' },
      { severity: 'medium', message: 'Missing input validation' },
      { severity: 'low', message: 'Code style issue' },
    ],
    score: 7.5,
  },
  verified: false,
  metadata: {},
};

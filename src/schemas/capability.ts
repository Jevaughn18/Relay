/**
 * Capability Manifest Schema
 *
 * Defines how AI agents advertise their capabilities, pricing, and constraints.
 */

import { z } from 'zod';

/**
 * Security sandbox levels for agent execution
 */
export enum SandboxLevel {
  FULL = 'full', // Full system access
  LIMITED = 'limited', // Limited system access
  ISOLATED = 'isolated', // Completely isolated
  READ_ONLY = 'read_only', // Read-only access
}

/**
 * How task execution should be verified
 */
export enum VerificationMode {
  AUTOMATED = 'automated', // Automated schema validation
  MANUAL = 'manual', // Human verification required
  AGENT = 'agent', // Third-party agent verification
  HYBRID = 'hybrid', // Multiple verification methods
}

/**
 * Zod schema for a single capability
 */
export const CapabilitySchema = z.object({
  name: z
    .string()
    .min(1)
    .regex(/^[a-z0-9_]+$/, 'Capability name must be alphanumeric with underscores')
    .transform((val) => val.toLowerCase())
    .describe('Capability identifier (e.g., code_review, summarization)'),

  description: z.string().min(1).describe('Human-readable description'),

  inputSchema: z.record(z.any()).describe('JSON schema for expected inputs'),

  outputSchema: z.record(z.any()).describe('JSON schema for deliverables'),

  baseCost: z.number().nonnegative().describe('Base cost in credits/tokens'),

  estimatedDurationSeconds: z.number().int().nonnegative().describe('Estimated completion time'),

  slaGuaranteeSeconds: z
    .number()
    .int()
    .nonnegative()
    .optional()
    .describe('Maximum guaranteed completion time'),
});

export type Capability = z.infer<typeof CapabilitySchema>;

/**
 * Complete capability manifest for an AI agent
 *
 * This is the machine-readable declaration of what an agent can do,
 * signed and published for discovery by other agents.
 */
export const CapabilityManifestSchema = z.object({
  // Identity
  agentId: z.string().min(1).describe('Unique agent identifier (public key)'),

  agentName: z.string().min(1).describe('Human-readable agent name'),

  version: z.string().default('1.0.0').describe('Manifest version'),

  // Capabilities
  capabilities: z.array(CapabilitySchema).min(1).describe('List of agent capabilities'),

  // Operational constraints
  sandboxLevel: z.nativeEnum(SandboxLevel).describe('Security sandbox level'),

  verificationMode: z.nativeEnum(VerificationMode).describe('Preferred verification method'),

  // Service Level Agreement
  maxConcurrentTasks: z.number().int().min(1).default(1).describe('Maximum simultaneous tasks'),

  availabilityHours: z
    .string()
    .optional()
    .describe("Availability schedule (e.g., '24/7', '9-5 UTC')"),

  // Trust and reputation
  minReputationRequired: z
    .number()
    .min(0)
    .max(1)
    .default(0.0)
    .describe('Minimum client reputation'),

  acceptsDisputes: z.boolean().default(true).describe('Whether agent accepts dispute resolution'),

  // Metadata
  createdAt: z.date().default(() => new Date()),

  updatedAt: z.date().default(() => new Date()),

  // Cryptographic signature (added after signing)
  signature: z.string().optional().describe('Cryptographic signature of manifest'),
});

export type CapabilityManifest = z.infer<typeof CapabilityManifestSchema>;

/**
 * Helper class for working with capability manifests
 */
export class CapabilityManifestHelper {
  constructor(private manifest: CapabilityManifest) {}

  /**
   * Get a specific capability by name
   */
  getCapability(name: string): Capability | undefined {
    return this.manifest.capabilities.find((cap) => cap.name === name.toLowerCase());
  }

  /**
   * Check if agent supports a capability
   */
  supportsCapability(name: string): boolean {
    return this.getCapability(name) !== undefined;
  }

  /**
   * Convert manifest to signable object
   * Excludes the signature field itself
   */
  toSignable(): Record<string, unknown> {
    const { signature, ...rest } = this.manifest;
    return {
      ...rest,
      createdAt: this.manifest.createdAt.toISOString(),
      updatedAt: this.manifest.updatedAt.toISOString(),
    };
  }

  /**
   * Get all capability names
   */
  getCapabilityNames(): string[] {
    return this.manifest.capabilities.map((cap) => cap.name);
  }

  /**
   * Calculate total estimated duration for all capabilities
   */
  getTotalEstimatedDuration(): number {
    return this.manifest.capabilities.reduce(
      (sum, cap) => sum + cap.estimatedDurationSeconds,
      0
    );
  }
}

/**
 * Example capability manifest
 */
export const exampleCapabilityManifest: CapabilityManifest = {
  agentId: 'agent_pub_key_123',
  agentName: 'CodeReviewAgent',
  version: '1.0.0',
  capabilities: [
    {
      name: 'code_review',
      description: 'Review code for bugs, security issues, and best practices',
      inputSchema: {
        type: 'object',
        properties: {
          code: { type: 'string' },
          language: { type: 'string' },
        },
        required: ['code', 'language'],
      },
      outputSchema: {
        type: 'object',
        properties: {
          issues: { type: 'array' },
          score: { type: 'number' },
        },
        required: ['issues', 'score'],
      },
      baseCost: 10.0,
      estimatedDurationSeconds: 300,
      slaGuaranteeSeconds: 600,
    },
  ],
  sandboxLevel: SandboxLevel.ISOLATED,
  verificationMode: VerificationMode.AUTOMATED,
  maxConcurrentTasks: 5,
  minReputationRequired: 0.7,
  acceptsDisputes: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

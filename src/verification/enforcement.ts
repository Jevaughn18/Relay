/**
 * Verification Enforcement System
 *
 * Enforces that execution proofs include valid sandbox attestations
 * and prevents fabricated or unverified proofs from being accepted.
 */

import { ExecutionProof } from '../schemas/execution';
import { VerificationMode } from '../schemas/capability';
import { SandboxExecutor } from '../sandbox/sandbox-executor';
import { RelaySign } from '../crypto/signer';
import { TaskContract } from '../schemas/contract';

export enum VerificationStatus {
  VALID = 'valid',
  INVALID = 'invalid',
  MISSING_ATTESTATION = 'missing_attestation',
  INVALID_SIGNATURE = 'invalid_signature',
  HASH_MISMATCH = 'hash_mismatch',
  UNTRUSTED_SANDBOX = 'untrusted_sandbox',
  EXPIRED = 'expired',
}

export interface VerificationResult {
  status: VerificationStatus;
  valid: boolean;
  errors: string[];
  warnings: string[];
  attestationValid?: boolean;
  signatureValid?: boolean;
  hashesValid?: boolean;
  trustedSandbox?: boolean;
}

export interface VerificationPolicy {
  requireSandboxAttestation: boolean;
  allowedSandboxTypes: ('docker' | 'vm' | 'wasm' | 'native')[];
  trustedSandboxProviders: string[]; // Public keys of trusted providers
  maxAttestationAgeSeconds: number; // Max age before attestation expires
  requireThirdPartyVerification: boolean;
  minVerifiers: number;
}

/**
 * Verification Enforcement Manager
 */
export class VerificationEnforcer {
  private policies: Map<VerificationMode, VerificationPolicy> = new Map();
  private trustedProviders: Set<string> = new Set();

  constructor() {
    // Default policies by verification mode
    this.policies.set(VerificationMode.HYBRID, {
      requireSandboxAttestation: false,
      allowedSandboxTypes: ['native', 'docker', 'vm', 'wasm'],
      trustedSandboxProviders: [],
      maxAttestationAgeSeconds: 86400, // 24 hours
      requireThirdPartyVerification: false,
      minVerifiers: 0,
    });

    this.policies.set(VerificationMode.AUTOMATED, {
      requireSandboxAttestation: true,
      allowedSandboxTypes: ['docker', 'vm', 'wasm'], // No native
      trustedSandboxProviders: [],
      maxAttestationAgeSeconds: 3600, // 1 hour
      requireThirdPartyVerification: false,
      minVerifiers: 0,
    });

    this.policies.set(VerificationMode.MANUAL, {
      requireSandboxAttestation: true,
      allowedSandboxTypes: ['docker', 'vm'], // More restrictive
      trustedSandboxProviders: [],
      maxAttestationAgeSeconds: 3600, // 1 hour
      requireThirdPartyVerification: true,
      minVerifiers: 1,
    });

    this.policies.set(VerificationMode.AGENT, {
      requireSandboxAttestation: true,
      allowedSandboxTypes: ['docker', 'vm', 'wasm'],
      trustedSandboxProviders: [],
      maxAttestationAgeSeconds: 3600, // 1 hour
      requireThirdPartyVerification: true,
      minVerifiers: 1,
    });
  }

  /**
   * Register a trusted sandbox provider
   */
  registerTrustedProvider(publicKey: string): void {
    this.trustedProviders.add(publicKey);
  }

  /**
   * Update policy for a verification mode
   */
  setPolicy(mode: VerificationMode, policy: Partial<VerificationPolicy>): void {
    const currentPolicy = this.policies.get(mode) || this.policies.get(VerificationMode.HYBRID)!;
    this.policies.set(mode, { ...currentPolicy, ...policy });
  }

  /**
   * Enforce verification requirements for a proof
   */
  async enforceVerification(
    proof: ExecutionProof,
    contract: TaskContract,
    verificationMode: VerificationMode
  ): Promise<VerificationResult> {
    const policy = this.policies.get(verificationMode) || this.policies.get(VerificationMode.HYBRID)!;
    const errors: string[] = [];
    const warnings: string[] = [];

    // 1. Check sandbox attestation presence
    if (policy.requireSandboxAttestation && !proof.sandboxAttestation) {
      return {
        status: VerificationStatus.MISSING_ATTESTATION,
        valid: false,
        errors: ['Sandbox attestation is required but missing'],
        warnings,
        attestationValid: false,
      };
    }

    if (!proof.sandboxAttestation) {
      // No attestation but not required
      warnings.push('No sandbox attestation provided - proof cannot be cryptographically verified');
      return {
        status: VerificationStatus.VALID,
        valid: true,
        errors,
        warnings,
        attestationValid: false,
      };
    }

    const attestation = proof.sandboxAttestation;

    // 2. Check sandbox type is allowed
    if (!policy.allowedSandboxTypes.includes(attestation.sandboxType)) {
      errors.push(`Sandbox type '${attestation.sandboxType}' not allowed. Allowed: ${policy.allowedSandboxTypes.join(', ')}`);
    }

    // 3. Check attestation age
    const ageSeconds = (Date.now() - attestation.timestamp.getTime()) / 1000;
    if (ageSeconds > policy.maxAttestationAgeSeconds) {
      return {
        status: VerificationStatus.EXPIRED,
        valid: false,
        errors: [`Attestation expired. Age: ${ageSeconds}s, Max: ${policy.maxAttestationAgeSeconds}s`],
        warnings,
        attestationValid: false,
      };
    }

    // 4. Check trusted provider (if configured)
    if (policy.trustedSandboxProviders.length > 0) {
      if (!policy.trustedSandboxProviders.includes(attestation.providerPublicKey)) {
        errors.push(`Sandbox provider not trusted: ${attestation.providerPublicKey}`);
        return {
          status: VerificationStatus.UNTRUSTED_SANDBOX,
          valid: false,
          errors,
          warnings,
          trustedSandbox: false,
        };
      }
    }

    // 5. Verify attestation signature and hashes
    const attestationValid = SandboxExecutor.verifyAttestation(
      attestation,
      proof.deliverable.code || '', // Code that was executed
      contract.taskInput,
      proof.deliverable
    );

    if (!attestationValid) {
      return {
        status: VerificationStatus.INVALID_SIGNATURE,
        valid: false,
        errors: ['Attestation signature verification failed'],
        warnings,
        attestationValid: false,
        signatureValid: false,
      };
    }

    // 6. Verify input/output hashes match
    const inputHashValid = proof.inputHash === attestation.inputHash;
    const outputHashValid = proof.outputHash === attestation.outputHash;

    if (!inputHashValid || !outputHashValid) {
      errors.push('Hash mismatch between proof and attestation');
      return {
        status: VerificationStatus.HASH_MISMATCH,
        valid: false,
        errors,
        warnings,
        hashesValid: false,
      };
    }

    // 7. Check third-party verification requirements
    if (policy.requireThirdPartyVerification) {
      const verifierCount = proof.verificationAttestations?.length || 0;
      if (verifierCount < policy.minVerifiers) {
        errors.push(`Insufficient verifiers. Required: ${policy.minVerifiers}, Found: ${verifierCount}`);
      }

      // Verify each third-party attestation
      for (const verification of proof.verificationAttestations || []) {
        if (verification.verdict === 'rejected') {
          errors.push(`Verifier ${verification.verifierId} rejected proof: ${verification.reason}`);
        }
      }
    }

    // Return final result
    if (errors.length > 0) {
      return {
        status: VerificationStatus.INVALID,
        valid: false,
        errors,
        warnings,
        attestationValid,
        signatureValid: attestationValid,
        hashesValid: inputHashValid && outputHashValid,
        trustedSandbox: true,
      };
    }

    return {
      status: VerificationStatus.VALID,
      valid: true,
      errors: [],
      warnings,
      attestationValid: true,
      signatureValid: true,
      hashesValid: true,
      trustedSandbox: true,
    };
  }

  /**
   * Quick check if a proof is acceptable
   */
  async isProofAcceptable(
    proof: ExecutionProof,
    contract: TaskContract,
    verificationMode: VerificationMode
  ): Promise<boolean> {
    const result = await this.enforceVerification(proof, contract, verificationMode);
    return result.valid;
  }

  /**
   * Get policy for a verification mode
   */
  getPolicy(mode: VerificationMode): VerificationPolicy {
    return this.policies.get(mode) || this.policies.get(VerificationMode.HYBRID)!;
  }

  /**
   * Check if a sandbox provider is trusted
   */
  isTrustedProvider(publicKey: string): boolean {
    return this.trustedProviders.has(publicKey);
  }

  /**
   * Get all trusted providers
   */
  getTrustedProviders(): string[] {
    return Array.from(this.trustedProviders);
  }
}

/**
 * Code verification using AST analysis
 */
export class CodeVerifier {
  /**
   * Verify code matches expected patterns
   */
  static verifyCodeStructure(code: string, expectedPatterns: string[]): boolean {
    // Basic pattern matching (can be extended with actual AST parsing)
    for (const pattern of expectedPatterns) {
      if (!code.includes(pattern)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Check for malicious code patterns
   */
  static detectMaliciousPatterns(code: string): string[] {
    const maliciousPatterns = [
      { pattern: /eval\s*\(/, description: 'eval() usage detected' },
      { pattern: /Function\s*\(/, description: 'Function() constructor detected' },
      { pattern: /child_process|spawn|exec/i, description: 'Process execution detected' },
      { pattern: /require\s*\(\s*['"]fs['"]/, description: 'Filesystem access detected' },
      { pattern: /require\s*\(\s*['"]net['"]/, description: 'Network access detected' },
      { pattern: /require\s*\(\s*['"]http/, description: 'HTTP module access detected' },
      { pattern: /\.__proto__|\.constructor\.prototype/, description: 'Prototype pollution detected' },
      { pattern: /process\.env/, description: 'Environment variable access detected' },
    ];

    const detected: string[] = [];
    for (const { pattern, description } of maliciousPatterns) {
      if (pattern.test(code)) {
        detected.push(description);
      }
    }

    return detected;
  }

  /**
   * Calculate code complexity score
   */
  static calculateComplexity(code: string): number {
    // Simple complexity based on control flow statements
    const controlFlowPatterns = [
      /\bif\b/g,
      /\belse\b/g,
      /\bfor\b/g,
      /\bwhile\b/g,
      /\bswitch\b/g,
      /\bcatch\b/g,
      /\?\s*.*\s*:/g, // Ternary
    ];

    let complexity = 1; // Base complexity
    for (const pattern of controlFlowPatterns) {
      const matches = code.match(pattern);
      complexity += matches ? matches.length : 0;
    }

    return complexity;
  }

  /**
   * Estimate resource requirements from code
   */
  static estimateResourceRequirements(code: string): {
    cpuIntensive: boolean;
    memoryIntensive: boolean;
    networkRequired: boolean;
  } {
    const cpuPatterns = /\bfor\b|\bwhile\b|\brecursion\b/gi;
    const memoryPatterns = /\barray\b|\bbuffer\b|\bmap\b|\bset\b/gi;
    const networkPatterns = /\bfetch\b|\bhttp\b|\baxios\b|\brequest\b/gi;

    return {
      cpuIntensive: (code.match(cpuPatterns) || []).length > 5,
      memoryIntensive: (code.match(memoryPatterns) || []).length > 5,
      networkRequired: networkPatterns.test(code),
    };
  }
}

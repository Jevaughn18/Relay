/**
 * Execution verification policy enforcement.
 *
 * Enforces verification mode requirements and automated code checks.
 */

import { TaskContract } from '../schemas/contract';
import { VerificationMode } from '../schemas/capability';
import { ExecutionProof } from '../schemas/execution';
import { ValidationResult } from './validator';

export interface VerificationEnforcementResult extends ValidationResult {
  verificationScore: number;
}

export interface CodeQualityMetrics {
  cyclomaticComplexity: number;
  functionCount: number;
  maxNestingDepth: number;
  lineCount: number;
}

export class ExecutionVerifier {
  /**
   * Enforce verification policy declared for the contract.
   */
  static enforce(contract: TaskContract, proof: ExecutionProof): VerificationEnforcementResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    const verificationMode = this.getVerificationMode(contract);
    const requiresAutomated = verificationMode === VerificationMode.AUTOMATED || verificationMode === VerificationMode.HYBRID;
    const requiresManual = verificationMode === VerificationMode.MANUAL;
    const requiresAgent = verificationMode === VerificationMode.AGENT;
    const requiresThirdParty = requiresManual || requiresAgent || verificationMode === VerificationMode.HYBRID;

    let verificationScore = 1.0;

    if (requiresThirdParty) {
      const requiredMode = requiresManual ? 'manual' : 'agent';
      const validAttestation = (proof.verificationAttestations || []).find(
        (attestation) =>
          (verificationMode === VerificationMode.HYBRID || attestation.mode === requiredMode) &&
          attestation.verdict === 'approved' &&
          attestation.verifierId !== contract.performerId &&
          attestation.verifierId !== contract.delegatorId
      );

      if (!validAttestation) {
        errors.push(`Missing approved ${requiredMode} verification from an independent verifier`);
      }
    }

    if (requiresAutomated) {
      const automated = this.runAutomatedChecks(contract, proof);
      errors.push(...automated.errors);
      warnings.push(...automated.warnings);
      verificationScore = Math.min(verificationScore, automated.verificationScore);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      verificationScore,
    };
  }

  /**
   * Detect verification mode from contract metadata.
   */
  static getVerificationMode(contract: TaskContract): VerificationMode {
    const metadataMode = contract.metadata?.verificationMode;

    if (
      metadataMode === VerificationMode.AUTOMATED ||
      metadataMode === VerificationMode.MANUAL ||
      metadataMode === VerificationMode.AGENT ||
      metadataMode === VerificationMode.HYBRID
    ) {
      return metadataMode;
    }

    return VerificationMode.AUTOMATED;
  }

  /**
   * Automated checks for objective capabilities.
   */
  static runAutomatedChecks(
    contract: TaskContract,
    proof: ExecutionProof
  ): VerificationEnforcementResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    let verificationScore = 1.0;

    const codeArtifact = this.extractCodeArtifact(contract, proof);

    if (codeArtifact) {
      const metrics = this.analyzeCodeMetrics(codeArtifact);
      const threshold = Number(contract.metadata?.maxCyclomaticComplexity ?? 40);

      if (metrics.cyclomaticComplexity > threshold) {
        errors.push(
          `Code complexity ${metrics.cyclomaticComplexity} exceeds threshold ${threshold}`
        );
        verificationScore = 0.2;
      } else if (metrics.cyclomaticComplexity > Math.floor(threshold * 0.75)) {
        warnings.push(
          `Code complexity ${metrics.cyclomaticComplexity} is near threshold ${threshold}`
        );
        verificationScore = 0.7;
      }

      if (metrics.maxNestingDepth > 6) {
        warnings.push(`Code nesting depth ${metrics.maxNestingDepth} is high`);
        verificationScore = Math.min(verificationScore, 0.75);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      verificationScore,
    };
  }

  private static extractCodeArtifact(contract: TaskContract, proof: ExecutionProof): string | undefined {
    const taskInputCode = contract.taskInput?.code;
    if (typeof taskInputCode === 'string' && taskInputCode.length > 0) {
      return taskInputCode;
    }

    const deliverableCode = proof.deliverable?.code;
    if (typeof deliverableCode === 'string' && deliverableCode.length > 0) {
      return deliverableCode;
    }

    return undefined;
  }

  /**
   * Lightweight static code metric extraction.
   */
  static analyzeCodeMetrics(sourceCode: string): CodeQualityMetrics {
    const complexityTokens = sourceCode.match(/\b(if|else if|for|while|switch|case|catch|\?\s*[^:]+:|&&|\|\|)\b/g) || [];
    const functionTokens = sourceCode.match(/\b(function|=>|async\s+function)\b/g) || [];
    const lines = sourceCode.split('\n').length;

    let depth = 0;
    let maxDepth = 0;
    for (const char of sourceCode) {
      if (char === '{') {
        depth += 1;
        maxDepth = Math.max(maxDepth, depth);
      }
      if (char === '}') {
        depth = Math.max(0, depth - 1);
      }
    }

    return {
      cyclomaticComplexity: complexityTokens.length + 1,
      functionCount: functionTokens.length,
      maxNestingDepth: maxDepth,
      lineCount: lines,
    };
  }
}

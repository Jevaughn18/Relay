/**
 * Contract Validation Engine
 *
 * Validates task contracts, deliverables, and execution proofs.
 */

import { TaskContract, ContractStatus, TaskContractHelper } from '../schemas/contract';
import { CapabilityManifest, Capability } from '../schemas/capability';
import { ExecutionProof } from '../schemas/execution';
import { RelaySign } from '../crypto/signer';
import Ajv from 'ajv';

const ajv = new Ajv();

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Contract validator
 */
export class ContractValidator {
  /**
   * Validate a task contract
   */
  static validateContract(contract: TaskContract): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    const helper = new TaskContractHelper(contract);

    // Check deadline
    if (helper.isPastDeadline()) {
      errors.push('Contract deadline is in the past');
    }

    // Check payment amount
    if (contract.paymentAmount <= 0) {
      errors.push('Payment amount must be greater than 0');
    }

    // Check stake amount
    if (contract.stakeAmount < 0) {
      errors.push('Stake amount cannot be negative');
    }

    // Check parties
    if (contract.delegatorId === contract.performerId) {
      errors.push('Delegator and performer cannot be the same agent');
    }

    // Check capability name
    if (!contract.capabilityName) {
      errors.push('Capability name is required');
    }

    // Check task input
    if (!contract.taskInput || Object.keys(contract.taskInput).length === 0) {
      warnings.push('Task input is empty');
    }

    // Check deliverable schema
    if (!contract.deliverableSchema || Object.keys(contract.deliverableSchema).length === 0) {
      warnings.push('Deliverable schema is empty');
    }

    // Check dispute window
    if (contract.disputeWindow.durationSeconds <= 0) {
      errors.push('Dispute window duration must be greater than 0');
    }

    // Check verification rules
    if (contract.verificationRules.length === 0) {
      warnings.push('No verification rules specified');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate contract signatures
   */
  static validateSignatures(
    contract: TaskContract,
    delegatorPublicKey: string,
    performerPublicKey: string
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    const helper = new TaskContractHelper(contract);
    const signableData = helper.toSignable();

    // Verify delegator signature
    if (contract.delegatorSignature) {
      const validDelegator = RelaySign.verify(
        signableData,
        contract.delegatorSignature,
        delegatorPublicKey
      );
      if (!validDelegator) {
        errors.push('Invalid delegator signature');
      }
    } else {
      warnings.push('Delegator signature missing');
    }

    // Verify performer signature
    if (contract.performerSignature) {
      const validPerformer = RelaySign.verify(
        signableData,
        contract.performerSignature,
        performerPublicKey
      );
      if (!validPerformer) {
        errors.push('Invalid performer signature');
      }
    } else {
      warnings.push('Performer signature missing');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate contract against capability manifest
   */
  static validateAgainstCapability(
    contract: TaskContract,
    manifest: CapabilityManifest
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Find capability
    const capability = manifest.capabilities.find(
      (cap) => cap.name === contract.capabilityName
    );

    if (!capability) {
      errors.push(`Agent does not support capability: ${contract.capabilityName}`);
      return { valid: false, errors, warnings };
    }

    // Validate input schema
    const inputValid = this.validateAgainstSchema(contract.taskInput, capability.inputSchema);
    if (!inputValid.valid) {
      errors.push(`Task input does not match capability schema: ${inputValid.errors.join(', ')}`);
    }

    // Check payment against base cost
    if (contract.paymentAmount < capability.baseCost) {
      warnings.push(
        `Payment (${contract.paymentAmount}) is less than base cost (${capability.baseCost})`
      );
    }

    // Check deadline against SLA
    const helper = new TaskContractHelper(contract);
    const contractDuration = helper.getDuration();

    if (capability.slaGuaranteeSeconds && contractDuration < capability.slaGuaranteeSeconds) {
      warnings.push('Contract deadline is tighter than agent SLA guarantee');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate deliverable against contract schema
   */
  static validateDeliverable(
    deliverable: Record<string, unknown>,
    deliverableSchema: Record<string, unknown>
  ): ValidationResult {
    return this.validateAgainstSchema(deliverable, deliverableSchema);
  }

  /**
   * Validate data against JSON schema
   */
  private static validateAgainstSchema(
    data: Record<string, unknown>,
    schema: Record<string, unknown>
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      const validate = ajv.compile(schema);
      const valid = validate(data);

      if (!valid && validate.errors) {
        errors.push(...validate.errors.map((err) => `${err.instancePath} ${err.message}`));
      }

      return {
        valid: errors.length === 0,
        errors,
        warnings,
      };
    } catch (error) {
      errors.push(`Schema validation error: ${error}`);
      return { valid: false, errors, warnings };
    }
  }

  /**
   * Validate execution proof
   */
  static validateExecutionProof(
    proof: ExecutionProof,
    contract: TaskContract
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check contract ID matches
    if (proof.contractId !== contract.contractId) {
      errors.push('Execution proof contract ID does not match');
    }

    // Check performer ID matches
    if (proof.performerId !== contract.performerId) {
      errors.push('Execution proof performer ID does not match');
    }

    // Check timing
    if (proof.startedAt > proof.completedAt) {
      errors.push('Execution start time is after completion time');
    }

    // Check duration consistency
    const actualDuration =
      (proof.completedAt.getTime() - proof.startedAt.getTime()) / 1000;
    if (Math.abs(actualDuration - proof.durationSeconds) > 1) {
      warnings.push('Execution duration inconsistency detected');
    }

    // Check SLA compliance
    const helper = new TaskContractHelper(contract);
    if (proof.completedAt > contract.deadline) {
      warnings.push('Task completed after deadline (SLA missed)');
    }

    // Validate deliverable hash
    const calculatedHash = RelaySign.hash(proof.deliverable);
    if (proof.outputHash !== calculatedHash) {
      errors.push('Deliverable hash mismatch');
    }

    // Validate deliverable against schema
    const deliverableValidation = this.validateDeliverable(
      proof.deliverable,
      contract.deliverableSchema
    );
    if (!deliverableValidation.valid) {
      errors.push(...deliverableValidation.errors.map((e) => `Deliverable: ${e}`));
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate contract state transition
   */
  static validateStateTransition(
    currentStatus: ContractStatus,
    newStatus: ContractStatus
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    const validTransitions: Record<ContractStatus, ContractStatus[]> = {
      [ContractStatus.DRAFT]: [ContractStatus.SIGNED, ContractStatus.CANCELLED],
      [ContractStatus.SIGNED]: [ContractStatus.FUNDED, ContractStatus.CANCELLED],
      [ContractStatus.FUNDED]: [ContractStatus.IN_PROGRESS, ContractStatus.CANCELLED],
      [ContractStatus.IN_PROGRESS]: [
        ContractStatus.DELIVERED,
        ContractStatus.DISPUTED,
        ContractStatus.CANCELLED,
      ],
      [ContractStatus.DELIVERED]: [
        ContractStatus.VERIFIED,
        ContractStatus.DISPUTED,
      ],
      [ContractStatus.VERIFIED]: [ContractStatus.SETTLED, ContractStatus.DISPUTED],
      [ContractStatus.SETTLED]: [], // Terminal state
      [ContractStatus.DISPUTED]: [
        ContractStatus.VERIFIED,
        ContractStatus.SLASHED,
        ContractStatus.CANCELLED,
      ],
      [ContractStatus.SLASHED]: [ContractStatus.SETTLED], // Can settle after slashing
      [ContractStatus.CANCELLED]: [], // Terminal state
    };

    const allowed = validTransitions[currentStatus] || [];
    if (!allowed.includes(newStatus)) {
      errors.push(
        `Invalid state transition from ${currentStatus} to ${newStatus}`
      );
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }
}

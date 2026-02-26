/**
 * Distributed Escrow System
 *
 * Advanced escrow with dispute windows, third-party verification, and multi-sig support
 */

import { TaskContract } from '../schemas/contract';
import { ExecutionProof } from '../schemas/execution';
import { EscrowManager, ContractEscrowLock as BaseContractEscrowLock } from './escrow';
import { RelaySign } from '../crypto/signer';

/**
 * Extended escrow lock for distributed system
 */
export interface DistributedContractEscrowLock extends Omit<BaseContractEscrowLock, 'status'> {
  delegatorDeposit: number;
  performerStake: number;
  completedAt?: Date;
  status: 'locked' | 'in_dispute_window' | 'disputed' | 'released' | 'slashed' | 'refunded';
}

export enum DisputeStatus {
  NONE = 'none',
  RAISED = 'raised',
  UNDER_REVIEW = 'under_review',
  RESOLVED_FAVOR_PERFORMER = 'resolved_favor_performer',
  RESOLVED_FAVOR_DELEGATOR = 'resolved_favor_delegator',
  RESOLVED_PARTIAL = 'resolved_partial',
}

export interface Dispute {
  disputeId: string;
  contractId: string;
  raisedBy: 'delegator' | 'performer';
  reason: string;
  evidence: any;
  status: DisputeStatus;
  verifierId?: string;
  resolution?: DisputeResolution;
  createdAt: Date;
  resolvedAt?: Date;
}

export interface DisputeResolution {
  decision: 'favor_performer' | 'favor_delegator' | 'partial';
  performerPayout: number;
  delegatorRefund: number;
  verifierFee: number;
  reasoning: string;
  evidence: any;
}

export interface EscrowConfig {
  disputeWindowSeconds: number; // Time window for raising disputes
  verifierFeePercentage: number; // Fee for third-party verifiers
  minStakePercentage: number; // Minimum stake from performer
  autoReleaseEnabled: boolean; // Auto-release after dispute window
}

/**
 * Distributed Escrow Manager with dispute resolution
 */
export class DistributedEscrowManager extends EscrowManager {
  private distributedLocks: Map<string, DistributedContractEscrowLock> = new Map();
  private disputes: Map<string, Dispute> = new Map();
  private disputeTimers: Map<string, NodeJS.Timeout> = new Map();
  private config: EscrowConfig;

  constructor(config?: Partial<EscrowConfig>) {
    super();

    this.config = {
      disputeWindowSeconds: 3600, // 1 hour default
      verifierFeePercentage: 5, // 5% fee
      minStakePercentage: 10, // 10% stake
      autoReleaseEnabled: true,
      ...config,
    };
  }

  /**
   * Lock funds with performer stake requirement
   */
  override lockFunds(contract: TaskContract) {
    // Require performer stake
    const requiredStake = contract.paymentAmount * (this.config.minStakePercentage / 100);

    // Create lock with base properties
    const lock: DistributedContractEscrowLock = {
      contractId: contract.contractId,
      delegatorId: contract.delegatorId,
      performerId: contract.performerId,
      paymentAmount: contract.paymentAmount,
      stakeAmount: requiredStake,
      delegatorDeposit: contract.paymentAmount,
      performerStake: requiredStake,
      lockedAt: new Date(),
      status: 'locked',
      paymentTransactionId: `tx_${Date.now()}_payment`,
      stakeTransactionId: `tx_${Date.now()}_stake`,
    };

    // Store in distributed locks (with extended status)
    this.distributedLocks.set(contract.contractId, lock);

    // Also store in base locks (with compatible status) - cast to base type
    this.contractLocks.set(contract.contractId, lock as any);

    // Deduct stake from performer balance
    const performerAccount = this.getAccount(contract.performerId);
    if (performerAccount.available < requiredStake) {
      throw new Error(`Insufficient performer stake. Required: ${requiredStake}, Available: ${performerAccount.available}`);
    }

    performerAccount.available -= requiredStake;
    performerAccount.locked += requiredStake;

    // Return with base type to satisfy override
    return lock as any;
  }

  /**
   * Complete task and start dispute window
   */
  startDisputeWindow(contractId: string, proof: ExecutionProof): void {
    const lock = this.distributedLocks.get(contractId);
    if (!lock) {
      throw new Error(`No escrow lock found for contract: ${contractId}`);
    }

    if (lock.status !== 'locked') {
      throw new Error(`Contract not in locked state: ${lock.status}`);
    }

    // Update lock status
    lock.status = 'in_dispute_window';
    lock.completedAt = new Date();

    // Start auto-release timer if enabled
    if (this.config.autoReleaseEnabled) {
      const timer = setTimeout(() => {
        this.autoReleaseFunds(contractId);
      }, this.config.disputeWindowSeconds * 1000);

      this.disputeTimers.set(contractId, timer);
    }
  }

  /**
   * Raise a dispute
   */
  raiseDispute(
    contractId: string,
    raisedBy: 'delegator' | 'performer',
    reason: string,
    evidence: any
  ): Dispute {
    const lock = this.distributedLocks.get(contractId);
    if (!lock) {
      throw new Error(`No escrow lock found for contract: ${contractId}`);
    }

    if (lock.status !== 'in_dispute_window' && lock.status !== 'locked') {
      throw new Error(`Cannot raise dispute for contract in status: ${lock.status}`);
    }

    // Cancel auto-release timer
    const timer = this.disputeTimers.get(contractId);
    if (timer) {
      clearTimeout(timer);
      this.disputeTimers.delete(contractId);
    }

    // Create dispute
    const dispute: Dispute = {
      disputeId: `dispute_${Date.now()}_${contractId}`,
      contractId,
      raisedBy,
      reason,
      evidence,
      status: DisputeStatus.RAISED,
      createdAt: new Date(),
    };

    this.disputes.set(dispute.disputeId, dispute);

    // Update lock status
    lock.status = 'disputed';

    return dispute;
  }

  /**
   * Assign verifier to dispute
   */
  assignVerifier(disputeId: string, verifierId: string): void {
    const dispute = this.disputes.get(disputeId);
    if (!dispute) {
      throw new Error(`Dispute not found: ${disputeId}`);
    }

    if (dispute.status !== DisputeStatus.RAISED) {
      throw new Error(`Dispute not in RAISED state: ${dispute.status}`);
    }

    dispute.verifierId = verifierId;
    dispute.status = DisputeStatus.UNDER_REVIEW;
  }

  /**
   * Resolve dispute with third-party decision
   */
  resolveDispute(
    disputeId: string,
    resolution: DisputeResolution,
    contract: TaskContract
  ): void {
    const dispute = this.disputes.get(disputeId);
    if (!dispute) {
      throw new Error(`Dispute not found: ${disputeId}`);
    }

    if (dispute.status !== DisputeStatus.UNDER_REVIEW) {
      throw new Error(`Dispute not under review: ${dispute.status}`);
    }

    const lock = this.distributedLocks.get(dispute.contractId);
    if (!lock) {
      throw new Error(`No escrow lock found for contract: ${dispute.contractId}`);
    }

    // Validate resolution amounts
    const totalLocked = lock.delegatorDeposit + lock.performerStake;
    const totalDistributed = resolution.performerPayout + resolution.delegatorRefund + resolution.verifierFee;

    if (Math.abs(totalLocked - totalDistributed) > 0.01) {
      throw new Error(`Resolution amounts don't match locked funds. Locked: ${totalLocked}, Distributed: ${totalDistributed}`);
    }

    // Apply resolution
    dispute.resolution = resolution;
    dispute.resolvedAt = new Date();

    switch (resolution.decision) {
      case 'favor_performer':
        dispute.status = DisputeStatus.RESOLVED_FAVOR_PERFORMER;
        break;
      case 'favor_delegator':
        dispute.status = DisputeStatus.RESOLVED_FAVOR_DELEGATOR;
        break;
      case 'partial':
        dispute.status = DisputeStatus.RESOLVED_PARTIAL;
        break;
    }

    // Distribute funds
    this.distributeFunds(contract, resolution);

    // Update lock status
    lock.status = 'released';
  }

  /**
   * Distribute funds according to resolution
   */
  private distributeFunds(contract: TaskContract, resolution: DisputeResolution): void {
    // Pay performer
    if (resolution.performerPayout > 0) {
      const performerAccount = this.getAccount(contract.performerId);
      performerAccount.available += resolution.performerPayout;
      performerAccount.locked -= Math.min(performerAccount.locked, resolution.performerPayout);
    }

    // Refund delegator
    if (resolution.delegatorRefund > 0) {
      const delegatorAccount = this.getAccount(contract.delegatorId);
      delegatorAccount.available += resolution.delegatorRefund;
    }

    // Pay verifier
    if (resolution.verifierFee > 0) {
      const lock = this.distributedLocks.get(contract.contractId);
      const dispute = Array.from(this.disputes.values()).find((d) => d.contractId === contract.contractId);

      if (dispute?.verifierId) {
        const verifierAccount = this.getAccount(dispute.verifierId);
        verifierAccount.available += resolution.verifierFee;
      }
    }
  }

  /**
   * Auto-release funds after dispute window expires
   */
  private autoReleaseFunds(contractId: string): void {
    const lock = this.distributedLocks.get(contractId);
    if (!lock || lock.status !== 'in_dispute_window') {
      return;
    }

    // No dispute raised - release to performer
    const performerAccount = this.getAccount(lock.performerId);

    // Release payment + stake
    performerAccount.available += lock.delegatorDeposit + lock.performerStake;
    performerAccount.locked -= lock.performerStake;

    lock.status = 'released';
    this.disputeTimers.delete(contractId);
  }

  /**
   * Get dispute by ID
   */
  getDispute(disputeId: string): Dispute | undefined {
    return this.disputes.get(disputeId);
  }

  /**
   * Get all disputes for a contract
   */
  getContractDisputes(contractId: string): Dispute[] {
    return Array.from(this.disputes.values()).filter((d) => d.contractId === contractId);
  }

  /**
   * Get disputes by status
   */
  getDisputesByStatus(status: DisputeStatus): Dispute[] {
    return Array.from(this.disputes.values()).filter((d) => d.status === status);
  }

  /**
   * Override cleanup to clear timers
   */
  cleanup(): void {
    // Clear all dispute timers
    for (const timer of this.disputeTimers.values()) {
      clearTimeout(timer);
    }
    this.disputeTimers.clear();
  }
}

/**
 * Reputation Management System
 *
 * Manages and persists agent reputation scores.
 */

import {
  ReputationScore,
  ReputationCalculator,
  PerformanceMetrics,
} from '../schemas/reputation';
import { TaskContract, ContractStatus } from '../schemas/contract';
import { ExecutionProof } from '../schemas/execution';

/**
 * Reputation manager
 */
export class ReputationManager {
  protected reputations: Map<string, ReputationScore> = new Map();

  /**
   * Get or create reputation for an agent
   */
  getReputation(agentId: string): ReputationScore {
    if (!this.reputations.has(agentId)) {
      this.reputations.set(agentId, this.createDefaultReputation(agentId));
    }
    return this.reputations.get(agentId)!;
  }

  /**
   * Create default reputation for new agent
   */
  private createDefaultReputation(agentId: string): ReputationScore {
    return {
      agentId,
      overallScore: 0.5, // Neutral starting score
      reliabilityScore: 0.5,
      qualityScore: 0.5,
      speedScore: 0.5,
      trustScore: 0.5,
      metrics: {
        totalTasksCompleted: 0,
        totalTasksFailed: 0,
        totalTasksCancelled: 0,
        slaMetCount: 0,
        slaMissedCount: 0,
        disputesRaised: 0,
        disputesLost: 0,
        disputesWon: 0,
        totalValueDelivered: 0,
        totalValueSlashed: 0,
        averageVerificationScore: 1.0,
        averageCompletionTimeSeconds: 0,
        averageResponseTimeSeconds: 0,
      },
      lastUpdated: new Date(),
    };
  }

  /**
   * Determine tier based on score
   */
  protected determineTier(score: number): 'bronze' | 'silver' | 'gold' | 'platinum' | undefined {
    return ReputationCalculator.determineTier(score, 0);
  }

  /**
   * Update reputation after task completion
   */
  updateAfterTaskCompletion(
    agentId: string,
    contract: TaskContract,
    proof: ExecutionProof,
    verificationScore: number
  ): ReputationScore {
    const reputation = this.getReputation(agentId);

    const slaMet = proof.completedAt <= contract.deadline;
    const completionTimeSeconds = proof.durationSeconds;

    const updated = ReputationCalculator.updateReputation(
      reputation,
      true, // task completed
      slaMet,
      verificationScore,
      completionTimeSeconds,
      false, // no dispute
      false
    );

    // Update value delivered
    updated.metrics.totalValueDelivered += contract.paymentAmount;

    // Set first task date if this is the first task
    if (!updated.firstTaskAt) {
      updated.firstTaskAt = new Date();
    }

    this.reputations.set(agentId, updated);
    return updated;
  }

  /**
   * Update reputation after task failure
   */
  updateAfterTaskFailure(agentId: string, contract: TaskContract): ReputationScore {
    const reputation = this.getReputation(agentId);

    const updated = ReputationCalculator.updateReputation(
      reputation,
      false, // task failed
      false, // SLA not met
      0, // no verification score
      0, // no completion time
      false,
      false
    );

    this.reputations.set(agentId, updated);
    return updated;
  }

  /**
   * Update reputation after dispute resolution
   */
  updateAfterDispute(
    performerId: string,
    contract: TaskContract,
    performerWon: boolean,
    slashedAmount: number = 0
  ): ReputationScore {
    const reputation = this.getReputation(performerId);
    const metrics = { ...reputation.metrics };

    metrics.disputesRaised++;

    if (performerWon) {
      metrics.disputesWon++;
    } else {
      metrics.disputesLost++;
      metrics.totalValueSlashed += slashedAmount;
    }

    // Recalculate component scores
    const trustScore = ReputationCalculator.calculateTrustScore(metrics);
    const reliabilityScore = ReputationCalculator.calculateReliabilityScore(metrics);

    const updated: ReputationScore = {
      ...reputation,
      metrics,
      trustScore,
      reliabilityScore,
      lastUpdated: new Date(),
    };

    // Recalculate overall score
    updated.overallScore = ReputationCalculator.calculateOverallScore(updated);

    this.reputations.set(performerId, updated);
    return updated;
  }

  /**
   * Check if agent meets minimum reputation requirement
   */
  meetsRequirement(agentId: string, minReputation: number): boolean {
    const reputation = this.getReputation(agentId);
    return reputation.overallScore >= minReputation;
  }

  /**
   * Get top agents by reputation
   */
  getTopAgents(limit: number = 10): ReputationScore[] {
    return Array.from(this.reputations.values())
      .sort((a, b) => b.overallScore - a.overallScore)
      .slice(0, limit);
  }

  /**
   * Get agents by capability and minimum reputation
   */
  findQualifiedAgents(
    capabilityName: string,
    minReputation: number
  ): ReputationScore[] {
    // In a full implementation, this would also check capability manifests
    return Array.from(this.reputations.values())
      .filter((rep) => rep.overallScore >= minReputation)
      .sort((a, b) => b.overallScore - a.overallScore);
  }

  /**
   * Get reputation summary for an agent
   */
  getReputationSummary(agentId: string): {
    agentId: string;
    overallScore: number;
    tier?: string;
    totalTasks: number;
    completionRate: number;
    slaCompliance: number;
    disputeWinRate: number;
  } {
    const reputation = this.getReputation(agentId);
    const metrics = reputation.metrics;

    const totalTasks =
      metrics.totalTasksCompleted + metrics.totalTasksFailed + metrics.totalTasksCancelled;

    const completionRate =
      totalTasks === 0 ? 0 : metrics.totalTasksCompleted / totalTasks;

    const totalSla = metrics.slaMetCount + metrics.slaMissedCount;
    const slaCompliance = totalSla === 0 ? 0 : metrics.slaMetCount / totalSla;

    const totalDisputes = metrics.disputesWon + metrics.disputesLost;
    const disputeWinRate =
      totalDisputes === 0 ? 1.0 : metrics.disputesWon / totalDisputes;

    return {
      agentId,
      overallScore: reputation.overallScore,
      tier: reputation.tier,
      totalTasks,
      completionRate,
      slaCompliance,
      disputeWinRate,
    };
  }

  /**
   * Export reputation data
   */
  exportReputation(agentId: string): string | undefined {
    const reputation = this.reputations.get(agentId);
    if (!reputation) return undefined;

    return JSON.stringify(reputation, null, 2);
  }

  /**
   * Import reputation data
   */
  importReputation(data: string): void {
    const reputation = JSON.parse(data) as ReputationScore;
    this.reputations.set(reputation.agentId, reputation);
  }

  /**
   * Reset reputation (for testing)
   */
  resetReputation(agentId: string): void {
    this.reputations.set(agentId, this.createDefaultReputation(agentId));
  }

  /**
   * Get all reputations
   */
  getAllReputations(): ReputationScore[] {
    return Array.from(this.reputations.values());
  }
}

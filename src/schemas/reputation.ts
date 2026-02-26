/**
 * Reputation Schema
 *
 * Defines how agent reputation is calculated and stored.
 */

import { z } from 'zod';

/**
 * Performance metrics for reputation calculation
 */
export const PerformanceMetricsSchema = z.object({
  // Completion metrics
  totalTasksCompleted: z.number().int().nonnegative().default(0),

  totalTasksFailed: z.number().int().nonnegative().default(0),

  totalTasksCancelled: z.number().int().nonnegative().default(0),

  // SLA compliance
  slaMetCount: z.number().int().nonnegative().default(0),

  slaMissedCount: z.number().int().nonnegative().default(0),

  // Dispute metrics
  disputesRaised: z.number().int().nonnegative().default(0),

  disputesLost: z.number().int().nonnegative().default(0),

  disputesWon: z.number().int().nonnegative().default(0),

  // Value metrics
  totalValueDelivered: z.number().nonnegative().default(0),

  totalValueSlashed: z.number().nonnegative().default(0),

  // Verification scores
  averageVerificationScore: z.number().min(0).max(1).default(1.0),

  // Time metrics
  averageCompletionTimeSeconds: z.number().nonnegative().default(0),

  // Response time
  averageResponseTimeSeconds: z.number().nonnegative().default(0),
});

export type PerformanceMetrics = z.infer<typeof PerformanceMetricsSchema>;

/**
 * Agent reputation score
 */
export const ReputationScoreSchema = z.object({
  agentId: z.string().min(1).describe('Agent identifier'),

  // Overall reputation score (0.0 - 1.0)
  overallScore: z.number().min(0).max(1).default(0.5).describe('Overall reputation score'),

  // Component scores
  reliabilityScore: z.number().min(0).max(1).default(0.5).describe('Task completion reliability'),

  qualityScore: z.number().min(0).max(1).default(0.5).describe('Deliverable quality'),

  speedScore: z.number().min(0).max(1).default(0.5).describe('Task completion speed'),

  trustScore: z.number().min(0).max(1).default(0.5).describe('Dispute and fraud metrics'),

  // Performance metrics
  metrics: PerformanceMetricsSchema,

  // Historical data
  lastUpdated: z.date().default(() => new Date()),

  firstTaskAt: z.date().optional().describe('When agent completed first task'),

  // Tier/rank (optional)
  tier: z.enum(['bronze', 'silver', 'gold', 'platinum']).optional(),
});

export type ReputationScore = z.infer<typeof ReputationScoreSchema>;

/**
 * Helper class for reputation calculations
 */
export class ReputationCalculator {
  /**
   * Calculate reliability score
   * Based on task completion rate and SLA compliance
   */
  static calculateReliabilityScore(metrics: PerformanceMetrics): number {
    const totalTasks =
      metrics.totalTasksCompleted + metrics.totalTasksFailed + metrics.totalTasksCancelled;

    if (totalTasks === 0) return 0.5; // Neutral score for new agents

    // Completion rate (70% weight)
    const completionRate = metrics.totalTasksCompleted / totalTasks;

    // SLA compliance rate (30% weight)
    const totalSLA = metrics.slaMetCount + metrics.slaMissedCount;
    const slaRate = totalSLA === 0 ? 1.0 : metrics.slaMetCount / totalSLA;

    return completionRate * 0.7 + slaRate * 0.3;
  }

  /**
   * Calculate trust score
   * Based on dispute resolution and slashing
   */
  static calculateTrustScore(metrics: PerformanceMetrics): number {
    const totalDisputes = metrics.disputesWon + metrics.disputesLost;

    if (totalDisputes === 0 && metrics.totalValueSlashed === 0) {
      return 1.0; // Perfect trust for no disputes
    }

    // Dispute win rate (60% weight)
    const disputeWinRate = totalDisputes === 0 ? 1.0 : metrics.disputesWon / totalDisputes;

    // Slashing penalty (40% weight)
    const totalValue = metrics.totalValueDelivered + metrics.totalValueSlashed;
    const slashingRate =
      totalValue === 0 ? 0 : metrics.totalValueSlashed / totalValue;

    const slashingScore = Math.max(0, 1.0 - slashingRate * 2); // Slashing heavily penalized

    return disputeWinRate * 0.6 + slashingScore * 0.4;
  }

  /**
   * Calculate quality score
   * Based on verification scores
   */
  static calculateQualityScore(metrics: PerformanceMetrics): number {
    return metrics.averageVerificationScore;
  }

  /**
   * Calculate speed score
   * Based on average completion time vs SLA
   */
  static calculateSpeedScore(metrics: PerformanceMetrics, averageSLA: number): number {
    if (averageSLA === 0 || metrics.averageCompletionTimeSeconds === 0) {
      return 0.5; // Neutral score if no data
    }

    // Score is 1.0 if always early, 0.5 if on time, lower if late
    const ratio = averageSLA / metrics.averageCompletionTimeSeconds;
    return Math.min(1.0, Math.max(0.0, ratio));
  }

  /**
   * Calculate overall reputation score
   */
  static calculateOverallScore(reputation: ReputationScore): number {
    // Weighted average of component scores
    const weights = {
      reliability: 0.35,
      quality: 0.30,
      trust: 0.25,
      speed: 0.10,
    };

    return (
      reputation.reliabilityScore * weights.reliability +
      reputation.qualityScore * weights.quality +
      reputation.trustScore * weights.trust +
      reputation.speedScore * weights.speed
    );
  }

  /**
   * Determine tier based on overall score and task count
   */
  static determineTier(
    overallScore: number,
    totalTasks: number
  ): 'bronze' | 'silver' | 'gold' | 'platinum' {
    if (totalTasks < 10) return 'bronze';

    if (overallScore >= 0.9 && totalTasks >= 100) return 'platinum';
    if (overallScore >= 0.8 && totalTasks >= 50) return 'gold';
    if (overallScore >= 0.7 && totalTasks >= 25) return 'silver';

    return 'bronze';
  }

  /**
   * Update reputation after task completion
   */
  static updateReputation(
    reputation: ReputationScore,
    taskCompleted: boolean,
    slaMet: boolean,
    verificationScore: number,
    completionTimeSeconds: number,
    disputed: boolean = false,
    disputeWon: boolean = false
  ): ReputationScore {
    const metrics = { ...reputation.metrics };

    // Update task counts
    if (taskCompleted) {
      metrics.totalTasksCompleted++;
    } else {
      metrics.totalTasksFailed++;
    }

    // Update SLA
    if (slaMet) {
      metrics.slaMetCount++;
    } else {
      metrics.slaMissedCount++;
    }

    // Update disputes
    if (disputed) {
      metrics.disputesRaised++;
      if (disputeWon) {
        metrics.disputesWon++;
      } else {
        metrics.disputesLost++;
      }
    }

    // Update verification score (running average)
    const totalVerifications = metrics.totalTasksCompleted + 1;
    metrics.averageVerificationScore =
      (metrics.averageVerificationScore * (totalVerifications - 1) + verificationScore) /
      totalVerifications;

    // Update completion time (running average)
    metrics.averageCompletionTimeSeconds =
      (metrics.averageCompletionTimeSeconds * (totalVerifications - 1) +
        completionTimeSeconds) /
      totalVerifications;

    // Recalculate component scores
    const reliabilityScore = this.calculateReliabilityScore(metrics);
    const trustScore = this.calculateTrustScore(metrics);
    const qualityScore = this.calculateQualityScore(metrics);
    const speedScore = this.calculateSpeedScore(metrics, 600); // Assuming 600s average SLA

    const updatedReputation: ReputationScore = {
      ...reputation,
      metrics,
      reliabilityScore,
      trustScore,
      qualityScore,
      speedScore,
      lastUpdated: new Date(),
    };

    // Calculate overall score
    updatedReputation.overallScore = this.calculateOverallScore(updatedReputation);

    // Determine tier
    const totalTasks =
      metrics.totalTasksCompleted + metrics.totalTasksFailed + metrics.totalTasksCancelled;
    updatedReputation.tier = this.determineTier(updatedReputation.overallScore, totalTasks);

    return updatedReputation;
  }
}

/**
 * Example reputation score
 */
export const exampleReputationScore: ReputationScore = {
  agentId: 'agent_bob_456',
  overallScore: 0.85,
  reliabilityScore: 0.90,
  qualityScore: 0.85,
  speedScore: 0.80,
  trustScore: 0.95,
  metrics: {
    totalTasksCompleted: 45,
    totalTasksFailed: 2,
    totalTasksCancelled: 1,
    slaMetCount: 43,
    slaMissedCount: 2,
    disputesRaised: 1,
    disputesLost: 0,
    disputesWon: 1,
    totalValueDelivered: 450.0,
    totalValueSlashed: 0.0,
    averageVerificationScore: 0.85,
    averageCompletionTimeSeconds: 280,
    averageResponseTimeSeconds: 15,
  },
  lastUpdated: new Date(),
  firstTaskAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
  tier: 'gold',
};

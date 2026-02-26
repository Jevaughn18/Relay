/**
 * Reputation Slashing System
 *
 * Handles reputation penalties for contract violations and dispute resolutions
 */

import { ReputationManager } from './manager';
import { ReputationScore, ReputationCalculator } from '../schemas/reputation';
import { DisputeResolution, DisputeStatus } from '../escrow/distributed-escrow';

export enum SlashingReason {
  DISPUTE_LOST = 'dispute_lost',
  SLA_VIOLATION = 'sla_violation',
  QUALITY_VIOLATION = 'quality_violation',
  FRAUD_DETECTED = 'fraud_detected',
  REPEATED_FAILURES = 'repeated_failures',
  MALICIOUS_BEHAVIOR = 'malicious_behavior',
}

export interface SlashingEvent {
  eventId: string;
  agentId: string;
  reason: SlashingReason;
  severity: 'minor' | 'moderate' | 'severe' | 'critical';
  reputationPenalty: number;
  stakePenalty: number;
  metadata: any;
  timestamp: Date;
}

export interface SlashingConfig {
  minorPenalty: number; // % reputation loss
  moderatePenalty: number;
  severePenalty: number;
  criticalPenalty: number;
  fraudThreshold: number; // Reputation threshold for fraud detection
  banThreshold: number; // Reputation level that triggers ban
  recoveryEnabled: boolean;
  recoveryRate: number; // Reputation recovery per successful task
}

/**
 * Reputation Slashing Manager
 */
export class ReputationSlasher extends ReputationManager {
  private slashingEvents: Map<string, SlashingEvent[]> = new Map();
  private bannedAgents: Set<string> = new Set();
  private config: SlashingConfig;

  constructor(config?: Partial<SlashingConfig>) {
    super();

    this.config = {
      minorPenalty: 2, // 2% loss
      moderatePenalty: 5, // 5% loss
      severePenalty: 15, // 15% loss
      criticalPenalty: 40, // 40% loss
      fraudThreshold: 0.3, // Below 30% triggers fraud flag
      banThreshold: 0.1, // Below 10% triggers ban
      recoveryEnabled: true,
      recoveryRate: 0.5, // 0.5% recovery per task
      ...config,
    };
  }

  /**
   * Slash reputation for dispute resolution
   */
  slashForDispute(
    agentId: string,
    resolution: DisputeResolution,
    contractValue: number
  ): SlashingEvent {
    let severity: 'minor' | 'moderate' | 'severe' | 'critical';
    let reason: SlashingReason;

    // Determine severity based on resolution
    if (resolution.decision === 'favor_performer') {
      // Delegator raised unjustified dispute
      severity = 'minor';
      reason = SlashingReason.DISPUTE_LOST;
    } else if (resolution.decision === 'favor_delegator') {
      // Performer failed to deliver
      severity = 'severe';
      reason = SlashingReason.QUALITY_VIOLATION;
    } else {
      // Partial resolution
      severity = 'moderate';
      reason = SlashingReason.DISPUTE_LOST;
    }

    return this.applySlashing(agentId, reason, severity, {
      resolution,
      contractValue,
    });
  }

  /**
   * Slash reputation for SLA violation
   */
  slashForSLAViolation(
    agentId: string,
    expectedSeconds: number,
    actualSeconds: number,
    contractValue: number
  ): SlashingEvent {
    // Calculate severity based on delay
    const delayRatio = actualSeconds / expectedSeconds;
    let severity: 'minor' | 'moderate' | 'severe' | 'critical';

    if (delayRatio < 1.2) {
      severity = 'minor'; // < 20% delay
    } else if (delayRatio < 1.5) {
      severity = 'moderate'; // 20-50% delay
    } else if (delayRatio < 2.0) {
      severity = 'severe'; // 50-100% delay
    } else {
      severity = 'critical'; // > 100% delay
    }

    return this.applySlashing(agentId, SlashingReason.SLA_VIOLATION, severity, {
      expectedSeconds,
      actualSeconds,
      delayRatio,
      contractValue,
    });
  }

  /**
   * Slash for detected fraud
   */
  slashForFraud(agentId: string, evidence: any): SlashingEvent {
    return this.applySlashing(agentId, SlashingReason.FRAUD_DETECTED, 'critical', {
      evidence,
      autoReported: true,
    });
  }

  /**
   * Slash for repeated failures
   */
  slashForRepeatedFailures(agentId: string, failureCount: number): SlashingEvent {
    let severity: 'minor' | 'moderate' | 'severe' | 'critical';

    if (failureCount < 3) {
      severity = 'minor';
    } else if (failureCount < 5) {
      severity = 'moderate';
    } else if (failureCount < 10) {
      severity = 'severe';
    } else {
      severity = 'critical';
    }

    return this.applySlashing(agentId, SlashingReason.REPEATED_FAILURES, severity, {
      failureCount,
    });
  }

  /**
   * Apply slashing penalty
   */
  private applySlashing(
    agentId: string,
    reason: SlashingReason,
    severity: 'minor' | 'moderate' | 'severe' | 'critical',
    metadata: any
  ): SlashingEvent {
    const reputation = this.reputations.get(agentId);
    if (!reputation) {
      throw new Error(`No reputation found for agent: ${agentId}`);
    }

    // Calculate penalty
    let penaltyPercentage: number;
    switch (severity) {
      case 'minor':
        penaltyPercentage = this.config.minorPenalty;
        break;
      case 'moderate':
        penaltyPercentage = this.config.moderatePenalty;
        break;
      case 'severe':
        penaltyPercentage = this.config.severePenalty;
        break;
      case 'critical':
        penaltyPercentage = this.config.criticalPenalty;
        break;
    }

    const reputationPenalty = reputation.overallScore * (penaltyPercentage / 100);

    // Apply penalty to all scores
    reputation.reliabilityScore = Math.max(0, reputation.reliabilityScore - reputationPenalty);
    reputation.qualityScore = Math.max(0, reputation.qualityScore - reputationPenalty);
    reputation.speedScore = Math.max(0, reputation.speedScore - reputationPenalty);
    reputation.trustScore = Math.max(0, reputation.trustScore - reputationPenalty);
    reputation.overallScore = Math.max(0, reputation.overallScore - reputationPenalty);

    // Update tier
    reputation.tier = this.determineTier(reputation.overallScore);

    // Create slashing event
    const event: SlashingEvent = {
      eventId: `slash_${Date.now()}_${agentId}`,
      agentId,
      reason,
      severity,
      reputationPenalty,
      stakePenalty: 0, // Can be extended to slash stake
      metadata,
      timestamp: new Date(),
    };

    // Record event
    const events = this.slashingEvents.get(agentId) || [];
    events.push(event);
    this.slashingEvents.set(agentId, events);

    // Check for ban
    if (reputation.overallScore < this.config.banThreshold) {
      this.banAgent(agentId, 'Reputation below ban threshold');
    } else if (reputation.overallScore < this.config.fraudThreshold && reason === SlashingReason.FRAUD_DETECTED) {
      this.banAgent(agentId, 'Fraud detected with low reputation');
    }

    return event;
  }

  /**
   * Apply reputation recovery for successful task
   */
  applyRecovery(agentId: string): void {
    if (!this.config.recoveryEnabled) {
      return;
    }

    const reputation = this.reputations.get(agentId);
    if (!reputation || this.isAgentBanned(agentId)) {
      return;
    }

    // Gradual recovery
    const recovery = this.config.recoveryRate / 100;
    reputation.reliabilityScore = Math.min(1.0, reputation.reliabilityScore + recovery);
    reputation.qualityScore = Math.min(1.0, reputation.qualityScore + recovery);
    reputation.speedScore = Math.min(1.0, reputation.speedScore + recovery);
    reputation.trustScore = Math.min(1.0, reputation.trustScore + recovery);
    reputation.overallScore = Math.min(1.0, reputation.overallScore + recovery);

    // Update tier
    reputation.tier = this.determineTier(reputation.overallScore);
  }

  /**
   * Ban an agent
   */
  private banAgent(agentId: string, reason: string): void {
    this.bannedAgents.add(agentId);

    const event: SlashingEvent = {
      eventId: `ban_${Date.now()}_${agentId}`,
      agentId,
      reason: SlashingReason.MALICIOUS_BEHAVIOR,
      severity: 'critical',
      reputationPenalty: 1.0, // Full slash
      stakePenalty: 0,
      metadata: { reason, banned: true },
      timestamp: new Date(),
    };

    const events = this.slashingEvents.get(agentId) || [];
    events.push(event);
    this.slashingEvents.set(agentId, events);
  }

  /**
   * Check if agent is banned
   */
  isAgentBanned(agentId: string): boolean {
    return this.bannedAgents.has(agentId);
  }

  /**
   * Get slashing history for an agent
   */
  getSlashingHistory(agentId: string): SlashingEvent[] {
    return this.slashingEvents.get(agentId) || [];
  }

  /**
   * Get total slashing penalty for an agent
   */
  getTotalPenalty(agentId: string): number {
    const events = this.slashingEvents.get(agentId) || [];
    return events.reduce((total, event) => total + event.reputationPenalty, 0);
  }

  /**
   * Calculate fraud risk score
   */
  getFraudRiskScore(agentId: string): number {
    const events = this.slashingEvents.get(agentId) || [];
    const reputation = this.reputations.get(agentId);

    if (!reputation) {
      return 1.0; // Maximum risk if no reputation
    }

    // Factors:
    // - Number of slashing events
    // - Severity of events
    // - Current reputation score
    // - Recent activity

    const eventCount = events.length;
    const severeEvents = events.filter((e) => e.severity === 'severe' || e.severity === 'critical').length;
    const recentEvents = events.filter((e) => {
      const daysSince = (Date.now() - e.timestamp.getTime()) / (1000 * 60 * 60 * 24);
      return daysSince < 30; // Last 30 days
    }).length;

    // Calculate risk (0-1, higher is riskier)
    const eventRisk = Math.min(1.0, eventCount / 10);
    const severityRisk = Math.min(1.0, severeEvents / 3);
    const reputationRisk = 1.0 - reputation.overallScore;
    const recentRisk = Math.min(1.0, recentEvents / 5);

    return (eventRisk + severityRisk + reputationRisk + recentRisk) / 4;
  }

  /**
   * Determine if agent should be auto-flagged
   */
  shouldAutoFlag(agentId: string): boolean {
    const fraudRisk = this.getFraudRiskScore(agentId);
    return fraudRisk > 0.7; // 70% risk threshold
  }
}

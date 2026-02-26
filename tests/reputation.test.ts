/**
 * Tests for reputation system
 */

import { ReputationManager } from '../src/reputation/manager';
import { ReputationCalculator } from '../src/schemas/reputation';
import { TaskContract, ContractStatus } from '../src/schemas/contract';
import { ExecutionProof } from '../src/schemas/execution';

describe('ReputationCalculator', () => {
  describe('calculateReliabilityScore', () => {
    it('should calculate perfect reliability', () => {
      const metrics = {
        totalTasksCompleted: 10,
        totalTasksFailed: 0,
        totalTasksCancelled: 0,
        slaMetCount: 10,
        slaMissedCount: 0,
        disputesRaised: 0,
        disputesLost: 0,
        disputesWon: 0,
        totalValueDelivered: 100,
        totalValueSlashed: 0,
        averageVerificationScore: 1.0,
        averageCompletionTimeSeconds: 300,
        averageResponseTimeSeconds: 10,
      };

      const score = ReputationCalculator.calculateReliabilityScore(metrics);
      expect(score).toBe(1.0);
    });

    it('should penalize failures', () => {
      const metrics = {
        totalTasksCompleted: 5,
        totalTasksFailed: 5,
        totalTasksCancelled: 0,
        slaMetCount: 5,
        slaMissedCount: 0,
        disputesRaised: 0,
        disputesLost: 0,
        disputesWon: 0,
        totalValueDelivered: 50,
        totalValueSlashed: 0,
        averageVerificationScore: 1.0,
        averageCompletionTimeSeconds: 300,
        averageResponseTimeSeconds: 10,
      };

      const score = ReputationCalculator.calculateReliabilityScore(metrics);
      expect(score).toBeCloseTo(0.65, 2);
    });
  });

  describe('calculateTrustScore', () => {
    it('should calculate perfect trust with no disputes', () => {
      const metrics = {
        totalTasksCompleted: 10,
        totalTasksFailed: 0,
        totalTasksCancelled: 0,
        slaMetCount: 10,
        slaMissedCount: 0,
        disputesRaised: 0,
        disputesLost: 0,
        disputesWon: 0,
        totalValueDelivered: 100,
        totalValueSlashed: 0,
        averageVerificationScore: 1.0,
        averageCompletionTimeSeconds: 300,
        averageResponseTimeSeconds: 10,
      };

      const score = ReputationCalculator.calculateTrustScore(metrics);
      expect(score).toBe(1.0);
    });

    it('should penalize lost disputes', () => {
      const metrics = {
        totalTasksCompleted: 10,
        totalTasksFailed: 0,
        totalTasksCancelled: 0,
        slaMetCount: 10,
        slaMissedCount: 0,
        disputesRaised: 5,
        disputesLost: 5,
        disputesWon: 0,
        totalValueDelivered: 100,
        totalValueSlashed: 0,
        averageVerificationScore: 1.0,
        averageCompletionTimeSeconds: 300,
        averageResponseTimeSeconds: 10,
      };

      const score = ReputationCalculator.calculateTrustScore(metrics);
      expect(score).toBeLessThan(0.5);
    });
  });

  describe('determineTier', () => {
    it('should assign platinum tier for high performance', () => {
      const tier = ReputationCalculator.determineTier(0.95, 150);
      expect(tier).toBe('platinum');
    });

    it('should assign bronze tier for new agents', () => {
      const tier = ReputationCalculator.determineTier(0.9, 5);
      expect(tier).toBe('bronze');
    });

    it('should assign gold tier for good performance', () => {
      const tier = ReputationCalculator.determineTier(0.85, 60);
      expect(tier).toBe('gold');
    });
  });
});

describe('ReputationManager', () => {
  let manager: ReputationManager;

  beforeEach(() => {
    manager = new ReputationManager();
  });

  describe('getReputation', () => {
    it('should create default reputation for new agent', () => {
      const reputation = manager.getReputation('agent_new');

      expect(reputation.agentId).toBe('agent_new');
      expect(reputation.overallScore).toBe(0.5); // Neutral
      expect(reputation.metrics.totalTasksCompleted).toBe(0);
    });
  });

  describe('updateAfterTaskCompletion', () => {
    it('should update reputation after successful task', () => {
      const contract: TaskContract = {
        contractId: 'contract_1',
        version: '1.0.0',
        delegatorId: 'agent_alice',
        performerId: 'agent_bob',
        capabilityName: 'test',
        taskDescription: 'Test',
        taskInput: {},
        deliverableSchema: {},
        paymentAmount: 10,
        stakeAmount: 0,
        deadline: new Date(Date.now() + 3600000),
        disputeWindow: { durationSeconds: 3600 },
        status: ContractStatus.SETTLED,
        escrowFunded: true,
        disputeRaised: false,
        createdAt: new Date(),
        metadata: {},
        verificationRules: [],
        slashingConditions: [],
      };

      const proof: ExecutionProof = {
        contractId: 'contract_1',
        performerId: 'agent_bob',
        startedAt: new Date(Date.now() - 300000),
        completedAt: new Date(),
        durationSeconds: 300,
        toolLogs: [],
        executionTrace: [],
        inputHash: 'hash1',
        outputHash: 'hash2',
        deliverable: {},
        verified: true,
        metadata: {},
      };

      const updated = manager.updateAfterTaskCompletion('agent_bob', contract, proof, 0.9);

      expect(updated.metrics.totalTasksCompleted).toBe(1);
      expect(updated.metrics.slaMetCount).toBe(1);
      expect(updated.metrics.totalValueDelivered).toBe(10);
      expect(updated.firstTaskAt).toBeDefined();
    });
  });

  describe('meetsRequirement', () => {
    it('should check reputation requirement', () => {
      const reputation = manager.getReputation('agent_test');
      reputation.overallScore = 0.8;

      expect(manager.meetsRequirement('agent_test', 0.7)).toBe(true);
      expect(manager.meetsRequirement('agent_test', 0.9)).toBe(false);
    });
  });

  describe('getReputationSummary', () => {
    it('should provide reputation summary', () => {
      const summary = manager.getReputationSummary('agent_new');

      expect(summary.agentId).toBe('agent_new');
      expect(summary.overallScore).toBeDefined();
      expect(summary.totalTasks).toBe(0);
      expect(summary.completionRate).toBe(0);
    });
  });
});

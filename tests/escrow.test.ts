/**
 * Tests for escrow system
 */

import { EscrowManager } from '../src/escrow/escrow';
import { TaskContract, ContractStatus } from '../src/schemas/contract';

describe('EscrowManager', () => {
  let escrow: EscrowManager;
  let mockContract: TaskContract;

  beforeEach(() => {
    escrow = new EscrowManager();

    mockContract = {
      contractId: 'contract_123',
      version: '1.0.0',
      delegatorId: 'agent_alice',
      performerId: 'agent_bob',
      capabilityName: 'test',
      taskDescription: 'Test task',
      taskInput: {},
      deliverableSchema: {},
      paymentAmount: 10.0,
      stakeAmount: 2.0,
      deadline: new Date(Date.now() + 3600000),
      disputeWindow: { durationSeconds: 3600 },
      status: ContractStatus.SIGNED,
      escrowFunded: false,
      disputeRaised: false,
      createdAt: new Date(),
      metadata: {},
      verificationRules: [],
      slashingConditions: [],
    };
  });

  describe('deposit', () => {
    it('should deposit funds into account', () => {
      escrow.deposit('agent_alice', 100);

      const balance = escrow.getBalance('agent_alice');
      expect(balance.balance).toBe(100);
      expect(balance.available).toBe(100);
      expect(balance.locked).toBe(0);
    });

    it('should reject negative deposits', () => {
      expect(() => escrow.deposit('agent_alice', -10)).toThrow();
    });
  });

  describe('lockFunds', () => {
    it('should lock funds for contract', () => {
      escrow.deposit('agent_alice', 100);
      escrow.deposit('agent_bob', 10);

      escrow.lockFunds(mockContract);

      const aliceBalance = escrow.getBalance('agent_alice');
      expect(aliceBalance.available).toBe(90);
      expect(aliceBalance.locked).toBe(10);

      const bobBalance = escrow.getBalance('agent_bob');
      expect(bobBalance.available).toBe(8);
      expect(bobBalance.locked).toBe(2);
    });

    it('should fail if insufficient funds', () => {
      escrow.deposit('agent_alice', 5); // Less than payment

      expect(() => escrow.lockFunds(mockContract)).toThrow('Insufficient available funds');
    });

    it('should fail if already locked', () => {
      escrow.deposit('agent_alice', 100);
      escrow.deposit('agent_bob', 10);

      escrow.lockFunds(mockContract);

      expect(() => escrow.lockFunds(mockContract)).toThrow('already locked');
    });
  });

  describe('releaseFunds', () => {
    it('should release funds to performer', () => {
      escrow.deposit('agent_alice', 100);
      escrow.deposit('agent_bob', 10);
      escrow.lockFunds(mockContract);

      escrow.releaseFunds('contract_123');

      const aliceBalance = escrow.getBalance('agent_alice');
      expect(aliceBalance.locked).toBe(0);

      const bobBalance = escrow.getBalance('agent_bob');
      expect(bobBalance.balance).toBe(20); // 10 initial + 10 payment
      expect(bobBalance.locked).toBe(0);
      expect(bobBalance.available).toBe(20);
    });
  });

  describe('slashStake', () => {
    it('should slash performer stake', () => {
      escrow.deposit('agent_alice', 100);
      escrow.deposit('agent_bob', 10);
      escrow.lockFunds(mockContract);

      escrow.slashStake('contract_123', 50); // 50% slash

      const aliceBalance = escrow.getBalance('agent_alice');
      expect(aliceBalance.balance).toBe(101); // 100 initial + 1 (50% of 2 stake)

      const bobBalance = escrow.getBalance('agent_bob');
      expect(bobBalance.available).toBe(9); // 8 + 1 (remaining 50% of stake)
    });

    it('should slash 100% by default', () => {
      escrow.deposit('agent_alice', 100);
      escrow.deposit('agent_bob', 10);
      escrow.lockFunds(mockContract);

      escrow.slashStake('contract_123');

      const aliceBalance = escrow.getBalance('agent_alice');
      expect(aliceBalance.balance).toBe(102); // 100 initial + 2 (full stake)

      const bobBalance = escrow.getBalance('agent_bob');
      expect(bobBalance.available).toBe(8); // Lost entire stake
    });
  });

  describe('refundPayment', () => {
    it('should refund payment to delegator', () => {
      escrow.deposit('agent_alice', 100);
      escrow.deposit('agent_bob', 10);
      escrow.lockFunds(mockContract);

      escrow.refundPayment('contract_123');

      const aliceBalance = escrow.getBalance('agent_alice');
      expect(aliceBalance.available).toBe(100); // Full refund
      expect(aliceBalance.locked).toBe(0);

      const bobBalance = escrow.getBalance('agent_bob');
      expect(bobBalance.available).toBe(10); // Stake returned
      expect(bobBalance.locked).toBe(0);
    });
  });

  describe('getTransactionHistory', () => {
    it('should track transaction history', () => {
      escrow.deposit('agent_alice', 100);
      escrow.deposit('agent_bob', 10);
      escrow.lockFunds(mockContract);

      const aliceHistory = escrow.getTransactionHistory('agent_alice');
      expect(aliceHistory.length).toBeGreaterThan(0);
      expect(aliceHistory.some((tx) => tx.type === 'deposit')).toBe(true);
      expect(aliceHistory.some((tx) => tx.type === 'lock')).toBe(true);
    });
  });
});

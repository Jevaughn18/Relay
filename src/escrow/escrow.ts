/**
 * Local Escrow Simulation
 *
 * Simulates escrow locking and release for task contracts.
 */

import { TaskContract, ContractStatus } from '../schemas/contract';

/**
 * Escrow account state
 */
export interface EscrowAccount {
  agentId: string;
  balance: number;
  locked: number;
  available: number;
}

/**
 * Escrow transaction
 */
export interface EscrowTransaction {
  id: string;
  timestamp: Date;
  type: 'deposit' | 'lock' | 'release' | 'slash' | 'refund';
  amount: number;
  contractId?: string;
  from?: string;
  to?: string;
  reason?: string;
}

/**
 * Escrow manager for handling payments and stakes
 */
export class EscrowManager {
  private accounts: Map<string, EscrowAccount> = new Map();
  private contractLocks: Map<string, ContractEscrowLock> = new Map();
  private transactions: EscrowTransaction[] = [];

  /**
   * Create or get an escrow account
   */
  getAccount(agentId: string): EscrowAccount {
    if (!this.accounts.has(agentId)) {
      this.accounts.set(agentId, {
        agentId,
        balance: 0,
        locked: 0,
        available: 0,
      });
    }
    return this.accounts.get(agentId)!;
  }

  /**
   * Deposit funds into an account
   */
  deposit(agentId: string, amount: number): EscrowTransaction {
    if (amount <= 0) {
      throw new Error('Deposit amount must be greater than 0');
    }

    const account = this.getAccount(agentId);
    account.balance += amount;
    account.available += amount;

    const transaction: EscrowTransaction = {
      id: this.generateTransactionId(),
      timestamp: new Date(),
      type: 'deposit',
      amount,
      to: agentId,
      reason: 'Account deposit',
    };

    this.transactions.push(transaction);
    return transaction;
  }

  /**
   * Lock funds for a contract
   */
  lockFunds(contract: TaskContract): ContractEscrowLock {
    // Verify contract not already locked
    if (this.contractLocks.has(contract.contractId)) {
      throw new Error('Contract funds already locked');
    }

    // Get delegator account (payment)
    const delegatorAccount = this.getAccount(contract.delegatorId);
    if (delegatorAccount.available < contract.paymentAmount) {
      throw new Error(
        `Insufficient available funds. Required: ${contract.paymentAmount}, Available: ${delegatorAccount.available}`
      );
    }

    // Get performer account (stake)
    const performerAccount = this.getAccount(contract.performerId);
    if (performerAccount.available < contract.stakeAmount) {
      throw new Error(
        `Insufficient stake. Required: ${contract.stakeAmount}, Available: ${performerAccount.available}`
      );
    }

    // Lock delegator payment
    delegatorAccount.available -= contract.paymentAmount;
    delegatorAccount.locked += contract.paymentAmount;

    const paymentTx: EscrowTransaction = {
      id: this.generateTransactionId(),
      timestamp: new Date(),
      type: 'lock',
      amount: contract.paymentAmount,
      contractId: contract.contractId,
      from: contract.delegatorId,
      reason: 'Lock payment for contract',
    };
    this.transactions.push(paymentTx);

    // Lock performer stake
    let stakeTx: EscrowTransaction | undefined;
    if (contract.stakeAmount > 0) {
      performerAccount.available -= contract.stakeAmount;
      performerAccount.locked += contract.stakeAmount;

      stakeTx = {
        id: this.generateTransactionId(),
        timestamp: new Date(),
        type: 'lock',
        amount: contract.stakeAmount,
        contractId: contract.contractId,
        from: contract.performerId,
        reason: 'Lock stake for contract',
      };
      this.transactions.push(stakeTx);
    }

    // Create contract lock
    const lock: ContractEscrowLock = {
      contractId: contract.contractId,
      delegatorId: contract.delegatorId,
      performerId: contract.performerId,
      paymentAmount: contract.paymentAmount,
      stakeAmount: contract.stakeAmount,
      lockedAt: new Date(),
      status: 'locked',
      paymentTransactionId: paymentTx.id,
      stakeTransactionId: stakeTx?.id,
    };

    this.contractLocks.set(contract.contractId, lock);
    return lock;
  }

  /**
   * Release funds upon successful completion
   */
  releaseFunds(contractId: string): { paymentTx: EscrowTransaction; stakeTx?: EscrowTransaction } {
    const lock = this.contractLocks.get(contractId);
    if (!lock) {
      throw new Error('Contract lock not found');
    }

    if (lock.status !== 'locked') {
      throw new Error(`Cannot release funds. Lock status: ${lock.status}`);
    }

    // Release payment to performer
    const delegatorAccount = this.getAccount(lock.delegatorId);
    const performerAccount = this.getAccount(lock.performerId);

    delegatorAccount.locked -= lock.paymentAmount;
    performerAccount.balance += lock.paymentAmount;
    performerAccount.available += lock.paymentAmount;

    const paymentTx: EscrowTransaction = {
      id: this.generateTransactionId(),
      timestamp: new Date(),
      type: 'release',
      amount: lock.paymentAmount,
      contractId,
      from: lock.delegatorId,
      to: lock.performerId,
      reason: 'Release payment upon completion',
    };
    this.transactions.push(paymentTx);

    // Release stake back to performer
    let stakeTx: EscrowTransaction | undefined;
    if (lock.stakeAmount > 0) {
      performerAccount.locked -= lock.stakeAmount;
      performerAccount.available += lock.stakeAmount;

      stakeTx = {
        id: this.generateTransactionId(),
        timestamp: new Date(),
        type: 'release',
        amount: lock.stakeAmount,
        contractId,
        to: lock.performerId,
        reason: 'Release stake upon completion',
      };
      this.transactions.push(stakeTx);
    }

    // Update lock status
    lock.status = 'released';
    lock.releasedAt = new Date();

    return { paymentTx, stakeTx };
  }

  /**
   * Slash performer stake (penalty for breach)
   */
  slashStake(
    contractId: string,
    slashPercentage: number = 100
  ): EscrowTransaction | undefined {
    if (slashPercentage < 0 || slashPercentage > 100) {
      throw new Error('Slash percentage must be between 0 and 100');
    }

    const lock = this.contractLocks.get(contractId);
    if (!lock) {
      throw new Error('Contract lock not found');
    }

    if (lock.stakeAmount === 0) {
      return undefined; // No stake to slash
    }

    const performerAccount = this.getAccount(lock.performerId);
    const delegatorAccount = this.getAccount(lock.delegatorId);

    const slashAmount = (lock.stakeAmount * slashPercentage) / 100;
    const remainingStake = lock.stakeAmount - slashAmount;

    // Slash stake - send to delegator as compensation
    performerAccount.locked -= slashAmount;
    delegatorAccount.balance += slashAmount;
    delegatorAccount.available += slashAmount;

    const slashTx: EscrowTransaction = {
      id: this.generateTransactionId(),
      timestamp: new Date(),
      type: 'slash',
      amount: slashAmount,
      contractId,
      from: lock.performerId,
      to: lock.delegatorId,
      reason: `Slash ${slashPercentage}% of stake`,
    };
    this.transactions.push(slashTx);

    // Return remaining stake if any
    if (remainingStake > 0) {
      performerAccount.locked -= remainingStake;
      performerAccount.available += remainingStake;
    }

    lock.status = 'slashed';
    lock.slashedAmount = slashAmount;

    return slashTx;
  }

  /**
   * Refund payment to delegator (e.g., task cancelled)
   */
  refundPayment(contractId: string): EscrowTransaction {
    const lock = this.contractLocks.get(contractId);
    if (!lock) {
      throw new Error('Contract lock not found');
    }

    const delegatorAccount = this.getAccount(lock.delegatorId);
    const performerAccount = this.getAccount(lock.performerId);

    // Refund payment to delegator
    delegatorAccount.locked -= lock.paymentAmount;
    delegatorAccount.available += lock.paymentAmount;

    const paymentTx: EscrowTransaction = {
      id: this.generateTransactionId(),
      timestamp: new Date(),
      type: 'refund',
      amount: lock.paymentAmount,
      contractId,
      to: lock.delegatorId,
      reason: 'Refund payment (contract cancelled)',
    };
    this.transactions.push(paymentTx);

    // Return stake to performer
    if (lock.stakeAmount > 0) {
      performerAccount.locked -= lock.stakeAmount;
      performerAccount.available += lock.stakeAmount;
    }

    lock.status = 'refunded';
    return paymentTx;
  }

  /**
   * Get contract lock details
   */
  getContractLock(contractId: string): ContractEscrowLock | undefined {
    return this.contractLocks.get(contractId);
  }

  /**
   * Get transaction history for an agent
   */
  getTransactionHistory(agentId: string): EscrowTransaction[] {
    return this.transactions.filter((tx) => tx.from === agentId || tx.to === agentId);
  }

  /**
   * Get all transactions
   */
  getAllTransactions(): EscrowTransaction[] {
    return [...this.transactions];
  }

  /**
   * Get account balance
   */
  getBalance(agentId: string): { balance: number; available: number; locked: number } {
    const account = this.getAccount(agentId);
    return {
      balance: account.balance,
      available: account.available,
      locked: account.locked,
    };
  }

  /**
   * Generate unique transaction ID
   */
  private generateTransactionId(): string {
    return `tx_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }
}

/**
 * Contract escrow lock details
 */
export interface ContractEscrowLock {
  contractId: string;
  delegatorId: string;
  performerId: string;
  paymentAmount: number;
  stakeAmount: number;
  lockedAt: Date;
  releasedAt?: Date;
  status: 'locked' | 'released' | 'slashed' | 'refunded';
  paymentTransactionId: string;
  stakeTransactionId?: string;
  slashedAmount?: number;
}

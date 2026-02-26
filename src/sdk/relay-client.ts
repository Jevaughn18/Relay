/**
 * Relay Client SDK
 *
 * Main SDK for integrating Relay into AI agents.
 */

import {
  CapabilityManifest,
  CapabilityManifestHelper,
  CapabilityManifestSchema,
} from '../schemas/capability';
import {
  TaskContract,
  TaskContractSchema,
  ContractStatus,
  TaskContractHelper,
} from '../schemas/contract';
import { ExecutionProof, ExecutionProofHelper } from '../schemas/execution';
import { ReputationScore } from '../schemas/reputation';
import { RelaySign, KeyManager, KeyPair } from '../crypto/signer';
import { ContractValidator } from '../contracts/validator';
import { EscrowManager } from '../escrow/escrow';
import { ReputationManager } from '../reputation/manager';

/**
 * Relay client configuration
 */
export interface RelayClientConfig {
  agentId: string;
  keyPair?: KeyPair;
  autoGenerateKeys?: boolean;
}

/**
 * Main Relay client for agent integration
 */
export class RelayClient {
  private agentId: string;
  private keyManager: KeyManager;
  private escrowManager: EscrowManager;
  private reputationManager: ReputationManager;
  private manifest?: CapabilityManifest;

  constructor(config: RelayClientConfig) {
    this.agentId = config.agentId;
    this.keyManager = new KeyManager();
    this.escrowManager = new EscrowManager();
    this.reputationManager = new ReputationManager();

    // Store or generate keys
    if (config.keyPair) {
      this.keyManager.store(this.agentId, config.keyPair);
    } else if (config.autoGenerateKeys) {
      this.generateKeys();
    }
  }

  /**
   * Get agent ID
   */
  getAgentId(): string {
    return this.agentId;
  }

  /**
   * Generate and store keys for this agent
   */
  async generateKeys(): Promise<KeyPair> {
    const keyPair = await this.keyManager.generateAndStore(this.agentId);
    return keyPair;
  }

  /**
   * Get agent's public key
   */
  getPublicKey(): string | undefined {
    return this.keyManager.getPublicKey(this.agentId);
  }

  /**
   * Register agent capabilities
   */
  registerCapabilities(manifest: CapabilityManifest): void {
    // Validate manifest
    const validated = CapabilityManifestSchema.parse(manifest);

    // Sign manifest
    const privateKey = this.keyManager.getPrivateKey(this.agentId);
    if (!privateKey) {
      throw new Error('No private key found. Generate keys first.');
    }

    const helper = new CapabilityManifestHelper(validated);
    const signableData = helper.toSignable();
    const signature = RelaySign.sign(signableData, privateKey);

    validated.signature = signature.signature;
    validated.agentId = this.agentId;

    this.manifest = validated;
  }

  /**
   * Get registered capabilities
   */
  getManifest(): CapabilityManifest | undefined {
    return this.manifest;
  }

  /**
   * Delegate a task to another agent
   */
  async delegateTask(
    performerId: string,
    performerManifest: CapabilityManifest,
    capabilityName: string,
    taskInput: Record<string, unknown>,
    paymentAmount: number,
    options?: {
      deadlineSeconds?: number;
      stakeAmount?: number;
      disputeWindowSeconds?: number;
    }
  ): Promise<TaskContract> {
    // Validate we have funds
    const balance = this.escrowManager.getBalance(this.agentId);
    if (balance.available < paymentAmount) {
      throw new Error(
        `Insufficient balance. Required: ${paymentAmount}, Available: ${balance.available}`
      );
    }

    // Get capability
    const helper = new CapabilityManifestHelper(performerManifest);
    const capability = helper.getCapability(capabilityName);
    if (!capability) {
      throw new Error(`Performer does not support capability: ${capabilityName}`);
    }

    // Create contract
    const deadlineSeconds = options?.deadlineSeconds || capability.slaGuaranteeSeconds || 3600;
    const deadline = new Date(Date.now() + deadlineSeconds * 1000);

    const contract: TaskContract = {
      contractId: crypto.randomUUID(),
      version: '1.0.0',
      delegatorId: this.agentId,
      performerId,
      capabilityName,
      taskDescription: `Task delegated via Relay`,
      taskInput,
      deliverableSchema: capability.outputSchema,
      paymentAmount,
      stakeAmount: options?.stakeAmount || 0,
      deadline,
      disputeWindow: {
        durationSeconds: options?.disputeWindowSeconds || 3600,
      },
      status: ContractStatus.DRAFT,
      escrowFunded: false,
      disputeRaised: false,
      createdAt: new Date(),
      metadata: {},
      verificationRules: [
        {
          type: 'schema',
          criteria: { schema: capability.outputSchema },
          required: true,
        },
      ],
      slashingConditions: [],
    };

    // Validate contract
    const validation = ContractValidator.validateContract(contract);
    if (!validation.valid) {
      throw new Error(`Contract validation failed: ${validation.errors.join(', ')}`);
    }

    // Sign contract
    const privateKey = this.keyManager.getPrivateKey(this.agentId);
    if (!privateKey) {
      throw new Error('No private key found');
    }

    const contractHelper = new TaskContractHelper(contract);
    const signableData = contractHelper.toSignable();
    const signature = RelaySign.sign(signableData, privateKey);

    contract.delegatorSignature = signature.signature;

    return contract;
  }

  /**
   * Accept a task contract (as performer)
   */
  acceptContract(contract: TaskContract): TaskContract {
    if (contract.performerId !== this.agentId) {
      throw new Error('Cannot accept contract for another agent');
    }

    // Validate we have stake
    if (contract.stakeAmount > 0) {
      const balance = this.escrowManager.getBalance(this.agentId);
      if (balance.available < contract.stakeAmount) {
        throw new Error(`Insufficient stake. Required: ${contract.stakeAmount}`);
      }
    }

    // Sign contract
    const privateKey = this.keyManager.getPrivateKey(this.agentId);
    if (!privateKey) {
      throw new Error('No private key found');
    }

    const helper = new TaskContractHelper(contract);
    const signableData = helper.toSignable();
    const signature = RelaySign.sign(signableData, privateKey);

    contract.performerSignature = signature.signature;
    contract.status = ContractStatus.SIGNED;

    return contract;
  }

  /**
   * Fund contract escrow
   */
  fundContract(contract: TaskContract): void {
    if (!contract.delegatorSignature || !contract.performerSignature) {
      throw new Error('Contract must be fully signed before funding');
    }

    this.escrowManager.lockFunds(contract);
    contract.escrowFunded = true;
    contract.status = ContractStatus.FUNDED;
  }

  /**
   * Submit task deliverable
   */
  submitDeliverable(
    contract: TaskContract,
    deliverable: Record<string, unknown>
  ): ExecutionProof {
    if (contract.performerId !== this.agentId) {
      throw new Error('Only performer can submit deliverable');
    }

    // Validate deliverable
    const validation = ContractValidator.validateDeliverable(
      deliverable,
      contract.deliverableSchema
    );
    if (!validation.valid) {
      throw new Error(`Deliverable validation failed: ${validation.errors.join(', ')}`);
    }

    // Create execution proof
    const proof: ExecutionProof = {
      contractId: contract.contractId,
      performerId: this.agentId,
      startedAt: contract.startedAt || new Date(),
      completedAt: new Date(),
      durationSeconds: contract.startedAt
        ? (new Date().getTime() - contract.startedAt.getTime()) / 1000
        : 0,
      toolLogs: [],
      executionTrace: [],
      inputHash: RelaySign.hash(contract.taskInput),
      outputHash: RelaySign.hash(deliverable),
      deliverable,
      verified: false,
      metadata: {},
    };

    // Sign proof
    const privateKey = this.keyManager.getPrivateKey(this.agentId);
    if (privateKey) {
      const proofHelper = new ExecutionProofHelper(proof);
      const signableData = proofHelper.toSignable();
      const signature = RelaySign.sign(signableData, privateKey);
      proof.signature = signature.signature;
    }

    contract.deliverable = deliverable;
    contract.deliverableHash = proof.outputHash;
    contract.completedAt = new Date();
    contract.status = ContractStatus.DELIVERED;

    return proof;
  }

  /**
   * Verify and settle contract
   */
  settleContract(contract: TaskContract, proof: ExecutionProof): void {
    // Validate proof
    const validation = ContractValidator.validateExecutionProof(proof, contract);
    if (!validation.valid) {
      throw new Error(`Proof validation failed: ${validation.errors.join(', ')}`);
    }

    // Mark as verified
    proof.verified = true;
    proof.verifiedAt = new Date();
    contract.status = ContractStatus.VERIFIED;

    // Release funds
    this.escrowManager.releaseFunds(contract.contractId);
    contract.status = ContractStatus.SETTLED;

    // Update reputation
    this.reputationManager.updateAfterTaskCompletion(
      contract.performerId,
      contract,
      proof,
      0.9 // Example verification score
    );
  }

  /**
   * Get agent reputation
   */
  getReputation(agentId?: string): ReputationScore {
    return this.reputationManager.getReputation(agentId || this.agentId);
  }

  /**
   * Deposit funds into escrow
   */
  depositFunds(amount: number): void {
    this.escrowManager.deposit(this.agentId, amount);
  }

  /**
   * Get escrow balance
   */
  getBalance(): { balance: number; available: number; locked: number } {
    return this.escrowManager.getBalance(this.agentId);
  }
}

/**
 * Helper function to create a Relay client
 */
export async function createRelayClient(
  agentId: string,
  options?: { keyPair?: KeyPair }
): Promise<RelayClient> {
  const client = new RelayClient({
    agentId,
    keyPair: options?.keyPair,
    autoGenerateKeys: !options?.keyPair,
  });

  if (!options?.keyPair) {
    await client.generateKeys();
  }

  return client;
}

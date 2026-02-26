/**
 * Shared Escrow HTTP Client
 */

import { EscrowTransaction, ContractEscrowLock } from './escrow';
import { TaskContract } from '../schemas/contract';
import { createSignedHeaders } from '../network/request-auth';

export interface SharedEscrowClientConfig {
  baseUrl: string;
  agentId?: string;
  privateKey?: string;
  publicKey?: string;
}

export class SharedEscrowClient {
  constructor(private config: SharedEscrowClientConfig) {}

  async deposit(agentId: string, amount: number): Promise<{
    transaction: EscrowTransaction;
    balance: { balance: number; available: number; locked: number };
  }> {
    return this.request('/deposit', { agentId, amount });
  }

  async lock(contract: TaskContract): Promise<{
    lock: ContractEscrowLock;
    delegatorBalance: { balance: number; available: number; locked: number };
    performerBalance: { balance: number; available: number; locked: number };
  }> {
    return this.request('/lock', { contract });
  }

  async release(contractId: string): Promise<{
    transaction: { paymentTx: EscrowTransaction; stakeTx?: EscrowTransaction };
    lock?: ContractEscrowLock;
    delegatorBalance?: { balance: number; available: number; locked: number };
    performerBalance?: { balance: number; available: number; locked: number };
  }> {
    return this.request('/release', { contractId });
  }

  async refund(contractId: string): Promise<{
    transaction: EscrowTransaction;
    lock?: ContractEscrowLock;
  }> {
    return this.request('/refund', { contractId });
  }

  async getBalance(agentId: string): Promise<{ balance: number; available: number; locked: number }> {
    const response = await this.request<{ balance: { balance: number; available: number; locked: number } }>(
      `/balance/${encodeURIComponent(agentId)}`,
      undefined,
      'GET'
    );
    return response.balance;
  }

  async getTransactions(agentId: string): Promise<EscrowTransaction[]> {
    const response = await this.request<{ transactions: EscrowTransaction[] }>(
      `/transactions/${encodeURIComponent(agentId)}`,
      undefined,
      'GET'
    );
    return response.transactions;
  }

  private async request<T>(
    route: string,
    body?: unknown,
    method: 'GET' | 'POST' = 'POST'
  ): Promise<T> {
    const rawBody = method === 'POST' ? JSON.stringify(body || {}) : '';
    const signedHeaders =
      this.config.agentId && this.config.privateKey && this.config.publicKey
        ? createSignedHeaders({
            agentId: this.config.agentId,
            privateKey: this.config.privateKey,
            publicKey: this.config.publicKey,
            method,
            path: route,
            rawBody,
          })
        : {};

    const response = await fetch(`${this.config.baseUrl}${route}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...signedHeaders,
      },
      body: method === 'POST' ? rawBody : undefined,
    });

    const payload = (await response.json()) as { error?: string } & T;
    if (!response.ok || payload.error) {
      throw new Error(payload.error || `Shared escrow request failed (${response.status})`);
    }

    return payload as T;
  }
}

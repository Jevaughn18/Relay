/**
 * Shared Escrow HTTP Server
 *
 * Provides a single escrow ledger for multiple agents/processes.
 * Persists state to a local JSON file (SQLite can replace this later).
 */

import http from 'http';
import fs from 'fs/promises';
import path from 'path';
import { parse } from 'url';
import { EscrowManager, EscrowPersistedState } from './escrow';
import { TaskContract } from '../schemas/contract';
import { TaskContractHelper } from '../schemas/contract';
import { RelaySign } from '../crypto/signer';
import { ReplayCache, verifySignedRequest, RELAY_AUTH_HEADERS } from '../network/request-auth';

export interface SharedEscrowServerConfig {
  host?: string;
  port: number;
  stateFile: string;
  requireSignedRequests?: boolean;
}

interface JsonResponse {
  success?: boolean;
  error?: string;
  [key: string]: unknown;
}

export class SharedEscrowServer {
  private server: http.Server;
  private manager: EscrowManager;
  private config: SharedEscrowServerConfig;
  private isRunning = false;
  private knownAgentKeys = new Map<string, string>();
  private replayCache = new ReplayCache();

  constructor(config: SharedEscrowServerConfig) {
    this.config = config;
    this.manager = new EscrowManager();
    this.server = http.createServer(this.handleRequest.bind(this));
  }

  async start(): Promise<void> {
    await this.loadState();
    await new Promise<void>((resolve) => {
      this.server.listen(this.config.port, this.config.host || '127.0.0.1', () => {
        this.isRunning = true;
        const address = `http://${this.config.host || '127.0.0.1'}:${this.config.port}`;
        console.log(`✅ Shared escrow started: ${address}`);
        console.log(`   State file: ${this.config.stateFile}`);
        console.log(`   Endpoints:`);
        console.log(`     POST ${address}/deposit`);
        console.log(`     POST ${address}/lock`);
        console.log(`     POST ${address}/release`);
        console.log(`     POST ${address}/refund`);
        console.log(`     GET  ${address}/balance/<agentId>`);
        console.log(`     GET  ${address}/transactions/<agentId>`);
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      if (!this.isRunning) {
        resolve();
        return;
      }

      this.server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });

    this.isRunning = false;
  }

  private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const parsedUrl = parse(req.url || '', true);
    const pathname = parsedUrl.pathname || '';
    const method = req.method || 'GET';

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader(
      'Access-Control-Allow-Headers',
      `Content-Type, ${RELAY_AUTH_HEADERS.agentId}, ${RELAY_AUTH_HEADERS.timestamp}, ${RELAY_AUTH_HEADERS.nonce}, ${RELAY_AUTH_HEADERS.signature}, ${RELAY_AUTH_HEADERS.publicKey}`
    );

    if (method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    try {
      if (pathname === '/deposit' && method === 'POST') {
        const body = await this.readBody(req);
        const { agentId, amount } = JSON.parse(body);
        if (!agentId || typeof amount !== 'number') {
          this.sendJson(res, 400, { error: 'agentId and numeric amount are required' });
          return;
        }
        const verified = this.verifyAuth(req, pathname, body, agentId);
        if (!verified.ok) {
          this.sendJson(res, 401, { error: verified.error });
          return;
        }
        this.knownAgentKeys.set(agentId, verified.identity.publicKey);
        const tx = this.manager.deposit(agentId, amount);
        await this.saveState();
        this.sendJson(res, 200, { success: true, transaction: tx, balance: this.manager.getBalance(agentId) });
        return;
      }

      if (pathname === '/lock' && method === 'POST') {
        const body = await this.readBody(req);
        const { contract } = JSON.parse(body);
        if (!contract) {
          this.sendJson(res, 400, { error: 'contract is required' });
          return;
        }
        const typedContract = contract as TaskContract;
        const verified = this.verifyAuth(req, pathname, body, typedContract.delegatorId);
        if (!verified.ok) {
          this.sendJson(res, 401, { error: verified.error });
          return;
        }
        this.knownAgentKeys.set(typedContract.delegatorId, verified.identity.publicKey);
        if (!typedContract.delegatorSignature || !typedContract.performerSignature) {
          this.sendJson(res, 400, { error: 'Contract must include both signatures' });
          return;
        }
        const delegatorKey = this.knownAgentKeys.get(typedContract.delegatorId);
        const performerKey = this.knownAgentKeys.get(typedContract.performerId);
        if (!delegatorKey || !performerKey) {
          this.sendJson(res, 400, { error: 'Unknown agent key(s). Both parties must deposit first.' });
          return;
        }
        const signable = new TaskContractHelper(typedContract).toSignable();
        if (!RelaySign.verify(signable, typedContract.delegatorSignature, delegatorKey)) {
          this.sendJson(res, 401, { error: 'Invalid delegator contract signature' });
          return;
        }
        if (!RelaySign.verify(signable, typedContract.performerSignature, performerKey)) {
          this.sendJson(res, 401, { error: 'Invalid performer contract signature' });
          return;
        }
        const lock = this.manager.lockFunds(typedContract);
        await this.saveState();
        this.sendJson(res, 200, {
          success: true,
          lock,
          delegatorBalance: this.manager.getBalance(typedContract.delegatorId),
          performerBalance: this.manager.getBalance(typedContract.performerId),
        });
        return;
      }

      if (pathname === '/release' && method === 'POST') {
        const body = await this.readBody(req);
        const { contractId } = JSON.parse(body);
        if (!contractId) {
          this.sendJson(res, 400, { error: 'contractId is required' });
          return;
        }
        const lock = this.manager.getContractLock(contractId);
        if (!lock) {
          this.sendJson(res, 404, { error: 'Contract lock not found' });
          return;
        }
        const verified = this.verifyAuth(
          req,
          pathname,
          body,
          lock.delegatorId,
          this.knownAgentKeys.get(lock.delegatorId)
        );
        if (!verified.ok) {
          this.sendJson(res, 401, { error: verified.error });
          return;
        }
        this.knownAgentKeys.set(lock.delegatorId, verified.identity.publicKey);
        const tx = this.manager.releaseFunds(contractId);
        const updatedLock = this.manager.getContractLock(contractId);
        await this.saveState();
        this.sendJson(res, 200, {
          success: true,
          transaction: tx,
          lock: updatedLock,
          delegatorBalance: updatedLock ? this.manager.getBalance(updatedLock.delegatorId) : undefined,
          performerBalance: updatedLock ? this.manager.getBalance(updatedLock.performerId) : undefined,
        });
        return;
      }

      if (pathname === '/refund' && method === 'POST') {
        const body = await this.readBody(req);
        const { contractId } = JSON.parse(body);
        if (!contractId) {
          this.sendJson(res, 400, { error: 'contractId is required' });
          return;
        }
        const lock = this.manager.getContractLock(contractId);
        if (!lock) {
          this.sendJson(res, 404, { error: 'Contract lock not found' });
          return;
        }
        const verified = this.verifyAuth(
          req,
          pathname,
          body,
          lock.delegatorId,
          this.knownAgentKeys.get(lock.delegatorId)
        );
        if (!verified.ok) {
          this.sendJson(res, 401, { error: verified.error });
          return;
        }
        this.knownAgentKeys.set(lock.delegatorId, verified.identity.publicKey);
        const tx = this.manager.refundPayment(contractId);
        const updatedLock = this.manager.getContractLock(contractId);
        await this.saveState();
        this.sendJson(res, 200, {
          success: true,
          transaction: tx,
          lock: updatedLock,
          delegatorBalance: updatedLock ? this.manager.getBalance(updatedLock.delegatorId) : undefined,
          performerBalance: updatedLock ? this.manager.getBalance(updatedLock.performerId) : undefined,
        });
        return;
      }

      if (pathname.startsWith('/balance/') && method === 'GET') {
        const agentId = decodeURIComponent(pathname.replace('/balance/', ''));
        const verified = this.verifyAuth(req, pathname, '', agentId, this.knownAgentKeys.get(agentId));
        if (!verified.ok) {
          this.sendJson(res, 401, { error: verified.error });
          return;
        }
        this.knownAgentKeys.set(agentId, verified.identity.publicKey);
        this.sendJson(res, 200, {
          success: true,
          balance: this.manager.getBalance(agentId),
        });
        return;
      }

      if (pathname.startsWith('/transactions/') && method === 'GET') {
        const agentId = decodeURIComponent(pathname.replace('/transactions/', ''));
        const verified = this.verifyAuth(req, pathname, '', agentId, this.knownAgentKeys.get(agentId));
        if (!verified.ok) {
          this.sendJson(res, 401, { error: verified.error });
          return;
        }
        this.knownAgentKeys.set(agentId, verified.identity.publicKey);
        this.sendJson(res, 200, {
          success: true,
          transactions: this.manager.getTransactionHistory(agentId),
        });
        return;
      }

      if (pathname === '/health' && method === 'GET') {
        this.sendJson(res, 200, { status: 'healthy' });
        return;
      }

      this.sendJson(res, 404, { error: 'Not found' });
    } catch (error: any) {
      this.sendJson(res, 500, { error: error.message });
    }
  }

  private async readBody(req: http.IncomingMessage): Promise<string> {
    const body = await new Promise<string>((resolve, reject) => {
      let data = '';
      req.on('data', (chunk) => {
        data += chunk.toString();
      });
      req.on('end', () => resolve(data));
      req.on('error', reject);
    });

    return body;
  }

  private sendJson(res: http.ServerResponse, status: number, payload: JsonResponse): void {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(payload));
  }

  private async loadState(): Promise<void> {
    try {
      const raw = await fs.readFile(this.config.stateFile, 'utf-8');
      const parsed = JSON.parse(raw) as
        | EscrowPersistedState
        | { ledger: EscrowPersistedState; agentPublicKeys?: Record<string, string> };

      if ('ledger' in parsed) {
        this.manager.importState(parsed.ledger);
        this.knownAgentKeys = new Map(Object.entries(parsed.agentPublicKeys || {}));
      } else {
        this.manager.importState(parsed);
      }
    } catch {
      // First start or unreadable file, start empty.
    }
  }

  private async saveState(): Promise<void> {
    const dir = path.dirname(this.config.stateFile);
    await fs.mkdir(dir, { recursive: true });

    const tempPath = `${this.config.stateFile}.tmp`;
    const serialized = {
      ledger: this.manager.exportState(),
      agentPublicKeys: Object.fromEntries(this.knownAgentKeys.entries()),
    };
    await fs.writeFile(tempPath, JSON.stringify(serialized, null, 2), 'utf-8');
    await fs.rename(tempPath, this.config.stateFile);
  }

  private verifyAuth(
    req: http.IncomingMessage,
    path: string,
    rawBody: string,
    expectedAgentId?: string,
    expectedPublicKey?: string
  ) {
    if (this.config.requireSignedRequests === false) {
      return {
        ok: true as const,
        identity: {
          agentId: expectedAgentId || 'insecure',
          publicKey: expectedPublicKey || 'insecure',
          timestampMs: Date.now(),
          nonce: 'insecure',
        },
      };
    }

    return verifySignedRequest({
      req,
      path,
      rawBody,
      expectedAgentId,
      expectedPublicKey,
      replayCache: this.replayCache,
    });
  }
}

/**
 * Signed request utilities for Relay service APIs.
 */

import type http from 'http';
import { RelaySign } from '../crypto/signer';

export const RELAY_AUTH_HEADERS = {
  agentId: 'x-relay-agent-id',
  timestamp: 'x-relay-timestamp',
  nonce: 'x-relay-nonce',
  signature: 'x-relay-signature',
  publicKey: 'x-relay-public-key',
} as const;

export interface RequestSignerInput {
  agentId: string;
  privateKey: string;
  publicKey: string;
  method: string;
  path: string;
  rawBody?: string;
  timestampMs?: number;
  nonce?: string;
}

export interface VerifiedRequestIdentity {
  agentId: string;
  publicKey: string;
  timestampMs: number;
  nonce: string;
}

export interface VerifySignedRequestInput {
  req: http.IncomingMessage;
  path: string;
  rawBody?: string;
  expectedAgentId?: string;
  expectedPublicKey?: string;
  maxSkewMs?: number;
  replayCache?: ReplayCache;
}

export class ReplayCache {
  private nonces = new Map<string, number>();

  constructor(private ttlMs: number = 5 * 60 * 1000) {}

  has(nonce: string): boolean {
    this.gc();
    return this.nonces.has(nonce);
  }

  add(nonce: string): void {
    this.gc();
    this.nonces.set(nonce, Date.now() + this.ttlMs);
  }

  private gc(): void {
    const now = Date.now();
    for (const [nonce, expiresAt] of this.nonces.entries()) {
      if (expiresAt <= now) {
        this.nonces.delete(nonce);
      }
    }
  }
}

function getHeader(req: http.IncomingMessage, key: string): string | undefined {
  const value = req.headers[key];
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

function buildSignablePayload(input: {
  agentId: string;
  method: string;
  path: string;
  timestampMs: number;
  nonce: string;
  rawBody?: string;
}): Record<string, unknown> {
  const bodyHash = RelaySign.hash(input.rawBody || '');
  return {
    agentId: input.agentId,
    method: input.method.toUpperCase(),
    path: input.path,
    timestampMs: input.timestampMs,
    nonce: input.nonce,
    bodyHash,
  };
}

export function createSignedHeaders(input: RequestSignerInput): Record<string, string> {
  const timestampMs = input.timestampMs ?? Date.now();
  const nonce = input.nonce ?? RelaySign.generateNonce();
  const payload = buildSignablePayload({
    agentId: input.agentId,
    method: input.method,
    path: input.path,
    timestampMs,
    nonce,
    rawBody: input.rawBody,
  });

  const signature = RelaySign.sign(payload, input.privateKey);

  return {
    [RELAY_AUTH_HEADERS.agentId]: input.agentId,
    [RELAY_AUTH_HEADERS.timestamp]: String(timestampMs),
    [RELAY_AUTH_HEADERS.nonce]: nonce,
    [RELAY_AUTH_HEADERS.signature]: signature.signature,
    [RELAY_AUTH_HEADERS.publicKey]: Buffer.from(input.publicKey, 'utf-8').toString('base64'),
  };
}

export function verifySignedRequest(
  input: VerifySignedRequestInput
): { ok: true; identity: VerifiedRequestIdentity } | { ok: false; error: string } {
  const agentId = getHeader(input.req, RELAY_AUTH_HEADERS.agentId);
  const timestampRaw = getHeader(input.req, RELAY_AUTH_HEADERS.timestamp);
  const nonce = getHeader(input.req, RELAY_AUTH_HEADERS.nonce);
  const signature = getHeader(input.req, RELAY_AUTH_HEADERS.signature);
  const publicKeyEncoded = getHeader(input.req, RELAY_AUTH_HEADERS.publicKey);

  if (!agentId || !timestampRaw || !nonce || !signature || !publicKeyEncoded) {
    return { ok: false, error: 'Missing required signature headers' };
  }
  let publicKey = '';
  try {
    publicKey = Buffer.from(publicKeyEncoded, 'base64').toString('utf-8');
  } catch {
    return { ok: false, error: 'Invalid encoded public key' };
  }

  if (input.expectedAgentId && agentId !== input.expectedAgentId) {
    return { ok: false, error: 'Signed agent does not match expected agent' };
  }

  if (input.expectedPublicKey && publicKey !== input.expectedPublicKey) {
    return { ok: false, error: 'Public key mismatch for agent' };
  }

  const timestampMs = Number(timestampRaw);
  if (!Number.isFinite(timestampMs)) {
    return { ok: false, error: 'Invalid signature timestamp' };
  }

  const maxSkewMs = input.maxSkewMs ?? 5 * 60 * 1000;
  if (Math.abs(Date.now() - timestampMs) > maxSkewMs) {
    return { ok: false, error: 'Signature timestamp outside allowed skew window' };
  }

  if (input.replayCache) {
    const replayKey = `${agentId}:${nonce}`;
    if (input.replayCache.has(replayKey)) {
      return { ok: false, error: 'Replay nonce detected' };
    }
    input.replayCache.add(replayKey);
  }

  const payload = buildSignablePayload({
    agentId,
    method: input.req.method || 'GET',
    path: input.path,
    timestampMs,
    nonce,
    rawBody: input.rawBody,
  });

  if (!RelaySign.verify(payload, signature, publicKey)) {
    return { ok: false, error: 'Invalid request signature' };
  }

  return {
    ok: true,
    identity: {
      agentId,
      publicKey,
      timestampMs,
      nonce,
    },
  };
}

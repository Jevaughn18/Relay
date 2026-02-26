/**
 * Cryptographic Signing System
 *
 * Handles signing and verification of manifests, contracts, and proofs.
 */

import crypto from 'crypto';
import { promisify } from 'util';

const generateKeyPair = promisify(crypto.generateKeyPair);

/**
 * Key pair for signing
 */
export interface KeyPair {
  publicKey: string; // PEM format
  privateKey: string; // PEM format
}

/**
 * Signature result
 */
export interface SignatureResult {
  signature: string; // Base64 encoded
  publicKey: string; // PEM format
  algorithm: string;
  timestamp: Date;
}

/**
 * Cryptographic signer for Relay protocol
 */
export class RelaySign {
  private static readonly ALGORITHM = 'RSA-SHA256';
  private static readonly KEY_LENGTH = 2048;

  /**
   * Generate a new RSA key pair
   */
  static async generateKeyPair(): Promise<KeyPair> {
    const { publicKey, privateKey } = await generateKeyPair('rsa', {
      modulusLength: this.KEY_LENGTH,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem',
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem',
      },
    });

    return {
      publicKey,
      privateKey,
    };
  }

  /**
   * Sign data with a private key
   */
  static sign(data: Record<string, unknown>, privateKey: string): SignatureResult {
    // Convert data to canonical JSON string
    const canonicalData = this.canonicalize(data);

    // Create signature
    const sign = crypto.createSign(this.ALGORITHM);
    sign.update(canonicalData);
    sign.end();

    const signature = sign.sign(privateKey, 'base64');

    // Extract public key from private key
    const privateKeyObject = crypto.createPrivateKey(privateKey);
    const publicKey = crypto.createPublicKey(privateKeyObject).export({
      type: 'spki',
      format: 'pem',
    }) as string;

    return {
      signature,
      publicKey,
      algorithm: this.ALGORITHM,
      timestamp: new Date(),
    };
  }

  /**
   * Verify a signature
   */
  static verify(
    data: Record<string, unknown>,
    signature: string,
    publicKey: string
  ): boolean {
    try {
      // Convert data to canonical JSON string
      const canonicalData = this.canonicalize(data);

      // Verify signature
      const verify = crypto.createVerify(this.ALGORITHM);
      verify.update(canonicalData);
      verify.end();

      return verify.verify(publicKey, signature, 'base64');
    } catch (error) {
      console.error('Signature verification failed:', error);
      return false;
    }
  }

  /**
   * Hash data using SHA-256
   */
  static hash(data: Record<string, unknown> | string): string {
    const content = typeof data === 'string' ? data : this.canonicalize(data);
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Extract agent ID from public key
   * Uses first 16 chars of SHA-256 hash of public key
   */
  static getAgentIdFromPublicKey(publicKey: string): string {
    const hash = crypto.createHash('sha256').update(publicKey).digest('hex');
    return `agent_${hash.substring(0, 16)}`;
  }

  /**
   * Canonicalize JSON for consistent signing
   * Sorts keys alphabetically and removes whitespace
   */
  private static canonicalize(data: Record<string, unknown>): string {
    return JSON.stringify(data, Object.keys(data).sort());
  }

  /**
   * Generate a random nonce for replay protection
   */
  static generateNonce(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Validate public key format
   */
  static isValidPublicKey(publicKey: string): boolean {
    try {
      crypto.createPublicKey(publicKey);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate private key format
   */
  static isValidPrivateKey(privateKey: string): boolean {
    try {
      crypto.createPrivateKey(privateKey);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Key manager for storing and retrieving keys
 */
export class KeyManager {
  private keys: Map<string, KeyPair> = new Map();

  /**
   * Generate and store a new key pair
   */
  async generateAndStore(agentId: string): Promise<KeyPair> {
    const keyPair = await RelaySign.generateKeyPair();
    this.keys.set(agentId, keyPair);
    return keyPair;
  }

  /**
   * Store an existing key pair
   */
  store(agentId: string, keyPair: KeyPair): void {
    this.keys.set(agentId, keyPair);
  }

  /**
   * Get key pair for an agent
   */
  get(agentId: string): KeyPair | undefined {
    return this.keys.get(agentId);
  }

  /**
   * Get public key only
   */
  getPublicKey(agentId: string): string | undefined {
    return this.keys.get(agentId)?.publicKey;
  }

  /**
   * Get private key only
   */
  getPrivateKey(agentId: string): string | undefined {
    return this.keys.get(agentId)?.privateKey;
  }

  /**
   * Check if agent has stored keys
   */
  has(agentId: string): boolean {
    return this.keys.has(agentId);
  }

  /**
   * Delete stored keys
   */
  delete(agentId: string): boolean {
    return this.keys.delete(agentId);
  }

  /**
   * Export keys to JSON
   */
  export(agentId: string): string | undefined {
    const keyPair = this.keys.get(agentId);
    if (!keyPair) return undefined;

    return JSON.stringify(keyPair, null, 2);
  }

  /**
   * Import keys from JSON
   */
  import(agentId: string, json: string): void {
    const keyPair = JSON.parse(json) as KeyPair;

    // Validate keys
    if (!RelaySign.isValidPublicKey(keyPair.publicKey)) {
      throw new Error('Invalid public key format');
    }
    if (!RelaySign.isValidPrivateKey(keyPair.privateKey)) {
      throw new Error('Invalid private key format');
    }

    this.store(agentId, keyPair);
  }
}

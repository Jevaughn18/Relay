/**
 * Tests for cryptographic signing system
 */

import { RelaySign, KeyManager } from '../src/crypto/signer';

describe('RelaySign', () => {
  let keyPair: any;

  beforeAll(async () => {
    keyPair = await RelaySign.generateKeyPair();
  });

  describe('generateKeyPair', () => {
    it('should generate valid key pair', async () => {
      const keys = await RelaySign.generateKeyPair();

      expect(keys.publicKey).toBeDefined();
      expect(keys.privateKey).toBeDefined();
      expect(keys.publicKey).toContain('BEGIN PUBLIC KEY');
      expect(keys.privateKey).toContain('BEGIN PRIVATE KEY');
    });
  });

  describe('sign and verify', () => {
    it('should sign and verify data correctly', () => {
      const data = { message: 'test', timestamp: Date.now() };

      const signature = RelaySign.sign(data, keyPair.privateKey);

      expect(signature.signature).toBeDefined();
      expect(signature.publicKey).toBeDefined();
      expect(signature.algorithm).toBe('RSA-SHA256');

      const isValid = RelaySign.verify(data, signature.signature, keyPair.publicKey);
      expect(isValid).toBe(true);
    });

    it('should fail verification with tampered data', () => {
      const data = { message: 'test' };
      const signature = RelaySign.sign(data, keyPair.privateKey);

      const tamperedData = { message: 'tampered' };
      const isValid = RelaySign.verify(tamperedData, signature.signature, keyPair.publicKey);

      expect(isValid).toBe(false);
    });

    it('should fail verification with wrong public key', async () => {
      const data = { message: 'test' };
      const signature = RelaySign.sign(data, keyPair.privateKey);

      const otherKeys = await RelaySign.generateKeyPair();
      const isValid = RelaySign.verify(data, signature.signature, otherKeys.publicKey);

      expect(isValid).toBe(false);
    });
  });

  describe('hash', () => {
    it('should generate consistent hashes', () => {
      const data = { value: 123 };

      const hash1 = RelaySign.hash(data);
      const hash2 = RelaySign.hash(data);

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA-256 produces 64 hex characters
    });

    it('should generate different hashes for different data', () => {
      const data1 = { value: 123 };
      const data2 = { value: 456 };

      const hash1 = RelaySign.hash(data1);
      const hash2 = RelaySign.hash(data2);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('getAgentIdFromPublicKey', () => {
    it('should generate agent ID from public key', () => {
      const agentId = RelaySign.getAgentIdFromPublicKey(keyPair.publicKey);

      expect(agentId).toMatch(/^agent_[a-f0-9]{16}$/);
    });

    it('should generate same agent ID for same public key', () => {
      const id1 = RelaySign.getAgentIdFromPublicKey(keyPair.publicKey);
      const id2 = RelaySign.getAgentIdFromPublicKey(keyPair.publicKey);

      expect(id1).toBe(id2);
    });
  });
});

describe('KeyManager', () => {
  let manager: KeyManager;

  beforeEach(() => {
    manager = new KeyManager();
  });

  describe('generateAndStore', () => {
    it('should generate and store keys for agent', async () => {
      const agentId = 'test_agent';
      const keyPair = await manager.generateAndStore(agentId);

      expect(keyPair.publicKey).toBeDefined();
      expect(keyPair.privateKey).toBeDefined();
      expect(manager.has(agentId)).toBe(true);
    });
  });

  describe('store and get', () => {
    it('should store and retrieve keys', async () => {
      const agentId = 'test_agent';
      const keyPair = await RelaySign.generateKeyPair();

      manager.store(agentId, keyPair);

      const retrieved = manager.get(agentId);
      expect(retrieved).toEqual(keyPair);
    });
  });

  describe('export and import', () => {
    it('should export and import keys', async () => {
      const agentId = 'test_agent';
      await manager.generateAndStore(agentId);

      const exported = manager.export(agentId);
      expect(exported).toBeDefined();

      const newManager = new KeyManager();
      newManager.import(agentId, exported!);

      expect(newManager.has(agentId)).toBe(true);
      expect(newManager.get(agentId)).toEqual(manager.get(agentId));
    });
  });
});

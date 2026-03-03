/**
 * Base Adapter - Connects existing agents/APIs to Relay
 *
 * Use this to wrap any existing agent (OpenClaw, ChatGPT, Gmail API, etc.)
 * so it can communicate via Relay
 */

import express from 'express';
import axios from 'axios';
import { MdnsAgentBroadcaster, AgentServiceInfo } from '../discovery/mdns-discovery';
import { KeyPair, RelaySign } from '../crypto/signer';
import { createSignedHeaders, RELAY_AUTH_HEADERS } from '../network/request-auth';
import { TaskContract, TaskContractHelper } from '../schemas/contract';
import {
  CapabilityManifest,
  CapabilityManifestHelper,
  SandboxLevel,
  VerificationMode,
} from '../schemas/capability';

export interface AdapterConfig {
  agentId: string;
  agentName: string;
  capabilities: string[]; // What this agent can do
  port: number;
  registryUrl?: string;
  escrowUrl?: string;
  enableMdns?: boolean; // Enable mDNS auto-discovery (default: true)
  /**
   * Optional keypair for signed registration and requests
   * If provided, all registry/escrow calls will be cryptographically signed
   */
  keyPair?: KeyPair;
}

export interface TaskRequest {
  taskId: string;
  escrowId: string;
  task: string;
  params: Record<string, any>;
  payment: number;
}

export interface TaskResult {
  success: boolean;
  result?: any;
  error?: string;
}

/**
 * Base adapter that any agent can extend
 */
export abstract class BaseAdapter {
  protected config: AdapterConfig;
  protected registryUrl: string;
  protected escrowUrl: string;
  private app: express.Application;
  private mdnsBroadcaster?: MdnsAgentBroadcaster;

  constructor(config: AdapterConfig) {
    this.config = config;
    this.registryUrl = config.registryUrl || 'http://127.0.0.1:9001';
    this.escrowUrl = config.escrowUrl || 'http://127.0.0.1:9010';
    this.app = express();
    this.app.use(express.json());
    this.setupRoutes();
  }

  /**
   * Override this to implement your agent's logic
   */
  abstract handleTask(task: string, params: Record<string, any>): Promise<TaskResult>;

  /**
   * Setup standard Relay routes
   */
  private setupRoutes(): void {
    // Health check
    this.app.get('/status', (req, res) => {
      res.json({
        agentId: this.config.agentId,
        agentName: this.config.agentName,
        status: 'healthy',
        capabilities: this.config.capabilities,
      });
    });

    // Execute task (called by other agents)
    this.app.post('/execute', async (req, res) => {
      const { taskId, escrowId, task, params, payment } = req.body;

      console.log(`📨 Task received: ${taskId}`);
      console.log(`   Task: ${task}`);
      console.log(`   Payment: ${payment} credits`);

      try {
        // Call the agent's implementation
        const result = await this.handleTask(task, params);

        console.log(`   ✓ Task completed`);
        res.json(result);
      } catch (error: any) {
        console.log(`   ✗ Task failed: ${error.message}`);
        res.json({
          success: false,
          error: error.message,
        });
      }
    });

    // Contract signing endpoint (production mode)
    this.app.post('/contract/sign', async (req, res) => {
      try {
        const { contract } = req.body;

        if (!contract) {
          res.status(400).json({ error: 'contract is required' });
          return;
        }

        // Check if this agent has keypair for signing
        if (!this.config.keyPair) {
          res.status(400).json({
            error: 'Agent not configured for production mode (no keypair)',
            hint: 'Add keyPair to AdapterConfig to support contract signing',
          });
          return;
        }

        const typedContract = contract as TaskContract;

        // Verify this agent is the performer
        if (typedContract.performerId !== this.config.agentId) {
          res.status(400).json({
            error: `Contract performer mismatch. Expected ${this.config.agentId}, got ${typedContract.performerId}`,
          });
          return;
        }

        if (!typedContract.delegatorSignature) {
          res.status(400).json({ error: 'Contract missing delegator signature' });
          return;
        }

        const delegatorAgentId = req.headers[RELAY_AUTH_HEADERS.agentId];
        const delegatorPublicKeyEncoded = req.headers[RELAY_AUTH_HEADERS.publicKey];

        const normalizedDelegatorAgentId = Array.isArray(delegatorAgentId)
          ? delegatorAgentId[0]
          : delegatorAgentId;
        const normalizedPublicKeyEncoded = Array.isArray(delegatorPublicKeyEncoded)
          ? delegatorPublicKeyEncoded[0]
          : delegatorPublicKeyEncoded;

        if (!normalizedDelegatorAgentId || normalizedDelegatorAgentId !== typedContract.delegatorId) {
          res.status(401).json({ error: 'Delegator identity mismatch for contract signing request' });
          return;
        }

        if (!normalizedPublicKeyEncoded) {
          res.status(401).json({ error: 'Missing delegator public key header' });
          return;
        }

        const delegatorPublicKey = Buffer.from(normalizedPublicKeyEncoded, 'base64').toString('utf-8');
        const helper = new TaskContractHelper(typedContract);
        const signable = helper.toSignable();
        const delegatorSignatureValid = RelaySign.verify(
          signable,
          typedContract.delegatorSignature,
          delegatorPublicKey
        );
        if (!delegatorSignatureValid) {
          res.status(401).json({ error: 'Invalid delegator contract signature' });
          return;
        }

        // Sign the validated contract as performer
        const signatureResult = RelaySign.sign(signable, this.config.keyPair.privateKey);

        const signedContract: TaskContract = {
          ...typedContract,
          performerSignature: signatureResult.signature,
        };

        console.log(`✓ Signed contract: ${typedContract.contractId}`);
        res.json({ success: true, contract: signedContract });
      } catch (error: any) {
        console.error(`✗ Contract signing failed: ${error.message}`);
        res.status(500).json({ error: error.message });
      }
    });
  }

  /**
   * Register with Relay
   */
  async register(): Promise<void> {
    const manifest: CapabilityManifest = {
      agentId: this.config.agentId,
      agentName: this.config.agentName,
      capabilities: this.config.capabilities.map(name => ({
        name,
        description: `${this.config.agentName} can ${name}`,
        inputSchema: {},
        outputSchema: {},
        baseCost: 100,
        estimatedDurationSeconds: 30,
      })),
      version: '1.0.0',
      sandboxLevel: SandboxLevel.ISOLATED,
      verificationMode: VerificationMode.AUTOMATED,
      maxConcurrentTasks: 5,
      minReputationRequired: 0,
      acceptsDisputes: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (this.config.keyPair) {
      const signableManifest = new CapabilityManifestHelper(manifest).toSignable();
      manifest.signature = RelaySign.sign(signableManifest, this.config.keyPair.privateKey).signature;
    }

    const body = {
      agentId: this.config.agentId,
      agentName: this.config.agentName,
      endpoint: `http://127.0.0.1:${this.config.port}`,
      manifest,
    };

    try {
      // Create signed headers if keypair is available
      let headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (this.config.keyPair) {
        const signedHeaders = createSignedHeaders({
          agentId: this.config.agentId,
          privateKey: this.config.keyPair.privateKey,
          publicKey: this.config.keyPair.publicKey,
          method: 'POST',
          path: '/register',
          rawBody: JSON.stringify(body),
        });
        headers = { ...headers, ...signedHeaders };
      }

      await axios.post(`${this.registryUrl}/register`, body, { headers });

      const authStatus = this.config.keyPair ? '(signed)' : '(unsigned)';
      console.log(`✓ Registered with Relay ${authStatus}: ${this.config.capabilities.join(', ')}`);
    } catch (error) {
      console.error('Failed to register:', error);
    }
  }

  /**
   * Start the adapter server
   */
  async start(): Promise<void> {
    // Register with registry (if available)
    await this.register();

    // Start mDNS broadcasting (enabled by default)
    const enableMdns = this.config.enableMdns !== false;
    if (enableMdns) {
      const agentInfo: AgentServiceInfo = {
        agentId: this.config.agentId,
        agentName: this.config.agentName,
        endpoint: `http://127.0.0.1:${this.config.port}`,
        port: this.config.port,
        capabilities: this.config.capabilities,
        version: '1.0.0',
        discoveredAt: new Date(),
      };

      this.mdnsBroadcaster = new MdnsAgentBroadcaster(agentInfo);
      this.mdnsBroadcaster.start();
    }

    this.app.listen(this.config.port, () => {
      console.log('');
      console.log('┌─────────────────────────────────────────┐');
      console.log(`│  ${this.config.agentName.padEnd(39)} │`);
      console.log('└─────────────────────────────────────────┘');
      console.log('');
      console.log(`Endpoint: http://127.0.0.1:${this.config.port}`);
      console.log(`Capabilities: ${this.config.capabilities.join(', ')}`);
      if (enableMdns) {
        console.log(`Auto-discovery: Enabled (mDNS)`);
      }
      console.log('');
      console.log('Waiting for tasks...');
      console.log('');
    });

    // Graceful shutdown
    process.on('SIGINT', () => this.stop());
    process.on('SIGTERM', () => this.stop());
  }

  /**
   * Stop the adapter server
   */
  stop(): void {
    if (this.mdnsBroadcaster) {
      this.mdnsBroadcaster.stop();
    }
    process.exit(0);
  }
}

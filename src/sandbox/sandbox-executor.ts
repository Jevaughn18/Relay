/**
 * Sandbox Execution System
 *
 * Provides isolated, verifiable task execution with cryptographic attestation
 */

import { createHash, randomBytes } from 'crypto';
import { RelaySign, KeyPair } from '../crypto/signer';

/**
 * Sandbox attestation - cryptographic proof of execution
 */
export interface SandboxAttestation {
  sandboxId: string;
  executionId: string;
  timestamp: Date;
  codeHash: string;
  inputHash: string;
  outputHash: string;
  environmentSignature: string;
  providerPublicKey: string;
  resourceUsage: ResourceMetrics;
  sandboxType: 'docker' | 'vm' | 'wasm' | 'native';
}

/**
 * Resource usage metrics
 */
export interface ResourceMetrics {
  cpuPercent: number;
  memoryMB: number;
  durationMs: number;
  networkBytesIn?: number;
  networkBytesOut?: number;
  diskReadMB?: number;
  diskWriteMB?: number;
}

/**
 * Execution result with attestation
 */
export interface SandboxExecutionResult {
  success: boolean;
  output: any;
  error?: string;
  logs: string[];
  attestation: SandboxAttestation;
  exitCode: number;
}

/**
 * Sandbox configuration
 */
export interface SandboxConfig {
  cpuLimit?: number;        // CPU cores
  memoryLimitMB?: number;   // Memory in MB
  timeoutMs?: number;       // Execution timeout
  networkAccess?: boolean;  // Allow network
  diskAccess?: boolean;     // Allow disk access
  environmentVars?: Record<string, string>;
  dockerImage?: string;     // Container image for Docker execution
  containerRuntime?: 'docker' | 'podman';
}

/**
 * Abstract base class for sandbox executors
 */
export abstract class SandboxExecutor {
  protected sandboxKeyPair?: KeyPair;

  constructor(protected config: SandboxConfig = {}) {
    // Default limits
    this.config = {
      cpuLimit: 1,
      memoryLimitMB: 512,
      timeoutMs: 60000, // 1 minute
      networkAccess: false,
      diskAccess: false,
      ...config,
    };
  }

  /**
   * Initialize sandbox with keypair for signing
   */
  async initialize(keyPair?: KeyPair): Promise<void> {
    if (keyPair) {
      this.sandboxKeyPair = keyPair;
    } else {
      // Generate keypair for sandbox
      this.sandboxKeyPair = await RelaySign.generateKeyPair();
    }
  }

  /**
   * Execute code in sandbox
   */
  abstract execute(
    code: string,
    input: any,
    config?: Partial<SandboxConfig>
  ): Promise<SandboxExecutionResult>;

  /**
   * Verify an attestation
   */
  static verifyAttestation(
    attestation: SandboxAttestation,
    code: string,
    input: any,
    output: any
  ): boolean {
    // Verify hashes
    const codeHash = this.hashData(code);
    const inputHash = this.hashData(input);
    const outputHash = this.hashData(output);

    if (attestation.codeHash !== codeHash) {
      console.error('Code hash mismatch');
      return false;
    }

    if (attestation.inputHash !== inputHash) {
      console.error('Input hash mismatch');
      return false;
    }

    if (attestation.outputHash !== outputHash) {
      console.error('Output hash mismatch');
      return false;
    }

    // Verify signature
    const attestationData = {
      sandboxId: attestation.sandboxId,
      executionId: attestation.executionId,
      timestamp: attestation.timestamp,
      codeHash: attestation.codeHash,
      inputHash: attestation.inputHash,
      outputHash: attestation.outputHash,
    };

    return RelaySign.verify(
      attestationData,
      attestation.environmentSignature,
      attestation.providerPublicKey
    );
  }

  /**
   * Hash data for attestation
   */
  protected static hashData(data: any): string {
    const dataString = typeof data === 'string' ? data : JSON.stringify(data);
    return createHash('sha256').update(dataString).digest('hex');
  }

  /**
   * Create attestation for execution
   */
  protected async createAttestation(
    sandboxId: string,
    code: string,
    input: any,
    output: any,
    resourceUsage: ResourceMetrics,
    sandboxType: SandboxAttestation['sandboxType']
  ): Promise<SandboxAttestation> {
    if (!this.sandboxKeyPair) {
      throw new Error('Sandbox not initialized with keypair');
    }

    const executionId = randomBytes(16).toString('hex');
    const codeHash = SandboxExecutor.hashData(code);
    const inputHash = SandboxExecutor.hashData(input);
    const outputHash = SandboxExecutor.hashData(output);

    const attestationData = {
      sandboxId,
      executionId,
      timestamp: new Date(),
      codeHash,
      inputHash,
      outputHash,
    };

    const signature = RelaySign.sign(attestationData, this.sandboxKeyPair.privateKey);

    return {
      ...attestationData,
      environmentSignature: signature.signature,
      providerPublicKey: this.sandboxKeyPair.publicKey,
      resourceUsage,
      sandboxType,
    };
  }
}

/**
 * Native (in-process) executor - INSECURE, for testing only
 */
export class NativeSandboxExecutor extends SandboxExecutor {
  async execute(
    code: string,
    input: any,
    config?: Partial<SandboxConfig>
  ): Promise<SandboxExecutionResult> {
    const effectiveConfig = { ...this.config, ...config };
    const startTime = Date.now();
    const logs: string[] = [];

    try {
      // WARNING: This is NOT sandboxed - executes in same process
      // Only use for testing!

      // Create isolated context
      const sandbox = {
        input,
        output: null,
        console: {
          log: (...args: any[]) => logs.push(args.map(String).join(' ')),
        },
      };

      // Execute code with timeout
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Execution timeout')), effectiveConfig.timeoutMs)
      );

      const executePromise = new Promise((resolve) => {
        const func = new Function('sandbox', `
          with (sandbox) {
            ${code}
            return output;
          }
        `);
        sandbox.output = func(sandbox);
        resolve(sandbox.output);
      });

      const output = await Promise.race([executePromise, timeoutPromise]);

      const durationMs = Date.now() - startTime;
      const resourceUsage: ResourceMetrics = {
        cpuPercent: 0, // Not measurable in native
        memoryMB: 0,
        durationMs,
      };

      const attestation = await this.createAttestation(
        'native',
        code,
        input,
        output,
        resourceUsage,
        'native'
      );

      return {
        success: true,
        output,
        logs,
        attestation,
        exitCode: 0,
      };
    } catch (error: any) {
      const durationMs = Date.now() - startTime;
      const resourceUsage: ResourceMetrics = {
        cpuPercent: 0,
        memoryMB: 0,
        durationMs,
      };

      const attestation = await this.createAttestation(
        'native',
        code,
        input,
        null,
        resourceUsage,
        'native'
      );

      return {
        success: false,
        output: null,
        error: error.message,
        logs,
        attestation,
        exitCode: 1,
      };
    }
  }
}

/**
 * Process-based executor - basic isolation
 */
export class ProcessSandboxExecutor extends SandboxExecutor {
  async execute(
    code: string,
    input: any,
    config?: Partial<SandboxConfig>
  ): Promise<SandboxExecutionResult> {
    const { spawn } = await import('child_process');
    const effectiveConfig = { ...this.config, ...config };
    const startTime = Date.now();
    const logs: string[] = [];

    return new Promise((resolve) => {
      // Execute in separate Node process
      const proc = spawn('node', ['-e', `
        const input = ${JSON.stringify(input)};
        let output = null;
        try {
          ${code}
          process.stdout.write(JSON.stringify({ success: true, output }));
        } catch (error) {
          process.stdout.write(JSON.stringify({ success: false, error: error.message }));
        }
      `], {
        timeout: effectiveConfig.timeoutMs,
        env: effectiveConfig.environmentVars,
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
        logs.push(data.toString());
      });

      proc.on('close', async (exitCode) => {
        const durationMs = Date.now() - startTime;
        const resourceUsage: ResourceMetrics = {
          cpuPercent: 0, // Not easily measurable
          memoryMB: 0,
          durationMs,
        };

        try {
          const result = JSON.parse(stdout);
          const attestation = await this.createAttestation(
            `process_${proc.pid}`,
            code,
            input,
            result.output,
            resourceUsage,
            'native'
          );

          resolve({
            success: result.success,
            output: result.output,
            error: result.error,
            logs,
            attestation,
            exitCode: exitCode || 0,
          });
        } catch (error: any) {
          const attestation = await this.createAttestation(
            `process_${proc.pid}`,
            code,
            input,
            null,
            resourceUsage,
            'native'
          );

          resolve({
            success: false,
            output: null,
            error: error.message,
            logs,
            attestation,
            exitCode: exitCode || 1,
          });
        }
      });

      proc.on('error', async (error) => {
        const durationMs = Date.now() - startTime;
        const resourceUsage: ResourceMetrics = {
          cpuPercent: 0,
          memoryMB: 0,
          durationMs,
        };

        const attestation = await this.createAttestation(
          'process_error',
          code,
          input,
          null,
          resourceUsage,
          'native'
        );

        resolve({
          success: false,
          output: null,
          error: error.message,
          logs,
          attestation,
          exitCode: 1,
        });
      });
    });
  }
}

/**
 * Docker-based executor with real process isolation.
 */
export class DockerSandboxExecutor extends SandboxExecutor {
  async execute(
    code: string,
    input: any,
    config?: Partial<SandboxConfig>
  ): Promise<SandboxExecutionResult> {
    const { spawn } = await import('child_process');
    const effectiveConfig = { ...this.config, ...config };
    const runtime = effectiveConfig.containerRuntime || 'docker';
    const image = effectiveConfig.dockerImage || 'node:20-alpine';
    const startTime = Date.now();
    const logs: string[] = [];
    const sandboxId = randomBytes(12).toString('hex');

    const encodedCode = Buffer.from(code, 'utf8').toString('base64');
    const encodedInput = Buffer.from(JSON.stringify(input), 'utf8').toString('base64');
    const timeoutSeconds = Math.max(1, Math.floor((effectiveConfig.timeoutMs || 60000) / 1000));
    const cpuLimit = Math.max(0.1, effectiveConfig.cpuLimit || 1);
    const memoryMB = Math.max(64, effectiveConfig.memoryLimitMB || 512);

    const script = `
const input = JSON.parse(Buffer.from(process.env.RELAY_INPUT_B64 || "", "base64").toString("utf8"));
const code = Buffer.from(process.env.RELAY_CODE_B64 || "", "base64").toString("utf8");
const logs = [];
const consoleShim = {
  log: (...args) => logs.push(args.map(String).join(" ")),
};
let output = null;
try {
  const fn = new Function("input", "console", "let output = null;\\n" + code + "\\nreturn output;");
  output = fn(input, consoleShim);
  process.stdout.write(JSON.stringify({ success: true, output, logs }));
} catch (error) {
  process.stdout.write(JSON.stringify({
    success: false,
    error: error instanceof Error ? error.message : String(error),
    logs
  }));
}`;

    const args = [
      'run',
      '--rm',
      '--name',
      `relay-sbx-${sandboxId}`,
      '--cpus',
      `${cpuLimit}`,
      '--memory',
      `${memoryMB}m`,
      '--network',
      effectiveConfig.networkAccess ? 'bridge' : 'none',
      '--pids-limit',
      '128',
      '--read-only',
      '--tmpfs',
      '/tmp:size=16m',
      '--security-opt',
      'no-new-privileges:true',
      '--cap-drop',
      'ALL',
      '--user',
      '1000:1000',
      '--env',
      `RELAY_CODE_B64=${encodedCode}`,
      '--env',
      `RELAY_INPUT_B64=${encodedInput}`,
      image,
      'node',
      '-e',
      script,
    ];

    return new Promise((resolve) => {
      const proc = spawn(runtime, args, {
        timeout: timeoutSeconds * 1000,
        env: {
          ...process.env,
          ...effectiveConfig.environmentVars,
        },
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data) => {
        const text = data.toString();
        stderr += text;
        logs.push(text.trim());
      });

      proc.on('close', async (exitCode) => {
        const durationMs = Date.now() - startTime;
        const resourceUsage: ResourceMetrics = {
          cpuPercent: 0,
          memoryMB,
          durationMs,
        };

        let parsed: any;
        try {
          parsed = JSON.parse(stdout);
        } catch {
          parsed = {
            success: false,
            output: null,
            error: stderr || 'Failed to parse sandbox output',
            logs,
          };
        }

        const attestation = await this.createAttestation(
          `docker_${sandboxId}`,
          code,
          input,
          parsed.output ?? null,
          resourceUsage,
          'docker'
        );

        resolve({
          success: Boolean(parsed.success) && (exitCode || 0) === 0,
          output: parsed.output ?? null,
          error: parsed.error || ((exitCode || 0) === 0 ? undefined : `Container exited with code ${exitCode}`),
          logs: Array.isArray(parsed.logs) ? parsed.logs : logs,
          attestation,
          exitCode: exitCode || 0,
        });
      });

      proc.on('error', async (error) => {
        const durationMs = Date.now() - startTime;
        const resourceUsage: ResourceMetrics = {
          cpuPercent: 0,
          memoryMB,
          durationMs,
        };

        const attestation = await this.createAttestation(
          `docker_${sandboxId}`,
          code,
          input,
          null,
          resourceUsage,
          'docker'
        );

        resolve({
          success: false,
          output: null,
          error: error.message,
          logs,
          attestation,
          exitCode: 1,
        });
      });
    });
  }
}

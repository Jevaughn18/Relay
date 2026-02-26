/**
 * Execution Logger
 *
 * Detailed logging system for task execution tracking
 */

import fs from 'fs/promises';
import path from 'path';

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  contractId?: string;
  agentId?: string;
  message: string;
  metadata?: Record<string, any>;
}

export interface ExecutionLoggerConfig {
  agentId: string;
  logDir?: string;
  logToFile?: boolean;
  logToConsole?: boolean;
}

/**
 * Execution logger for tracking agent task execution
 */
export class ExecutionLogger {
  private config: ExecutionLoggerConfig;
  private logs: LogEntry[] = [];
  private contractLogs: Map<string, LogEntry[]> = new Map();

  constructor(config: ExecutionLoggerConfig) {
    this.config = {
      logDir: config.logDir || '.relay/logs',
      logToFile: config.logToFile ?? true,
      logToConsole: config.logToConsole ?? true,
      ...config,
    };
  }

  /**
   * Log a message
   */
  async log(
    level: LogLevel,
    message: string,
    metadata?: Record<string, any>,
    contractId?: string
  ): Promise<void> {
    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      contractId,
      agentId: this.config.agentId,
      message,
      metadata,
    };

    // Add to general logs
    this.logs.push(entry);

    // Add to contract-specific logs
    if (contractId) {
      if (!this.contractLogs.has(contractId)) {
        this.contractLogs.set(contractId, []);
      }
      this.contractLogs.get(contractId)!.push(entry);
    }

    // Console output
    if (this.config.logToConsole) {
      this.logToConsole(entry);
    }

    // File output
    if (this.config.logToFile) {
      await this.logToFile(entry);
    }
  }

  /**
   * Log to console
   */
  private logToConsole(entry: LogEntry): void {
    const prefix = entry.contractId ? `[${entry.contractId.substring(0, 8)}]` : '';
    const timestamp = entry.timestamp.toISOString();
    const level = entry.level.toUpperCase().padEnd(5);

    let color = '\x1b[0m'; // Reset
    switch (entry.level) {
      case LogLevel.ERROR:
        color = '\x1b[31m'; // Red
        break;
      case LogLevel.WARN:
        color = '\x1b[33m'; // Yellow
        break;
      case LogLevel.INFO:
        color = '\x1b[36m'; // Cyan
        break;
      case LogLevel.DEBUG:
        color = '\x1b[90m'; // Gray
        break;
    }

    console.log(`${color}[${timestamp}] ${level} ${prefix} ${entry.message}\x1b[0m`);

    if (entry.metadata && Object.keys(entry.metadata).length > 0) {
      console.log(`  ${JSON.stringify(entry.metadata, null, 2)}`);
    }
  }

  /**
   * Log to file
   */
  private async logToFile(entry: LogEntry): Promise<void> {
    try {
      const logDir = this.config.logDir!;
      await fs.mkdir(logDir, { recursive: true });

      // General log file
      const generalLogPath = path.join(logDir, `${this.config.agentId}.log`);
      const logLine =
        JSON.stringify({
          ...entry,
          timestamp: entry.timestamp.toISOString(),
        }) + '\n';

      await fs.appendFile(generalLogPath, logLine);

      // Contract-specific log file
      if (entry.contractId) {
        const contractLogPath = path.join(logDir, `${entry.contractId}.log`);
        await fs.appendFile(contractLogPath, logLine);
      }
    } catch (error) {
      console.error('Failed to write log to file:', error);
    }
  }

  /**
   * Get logs for a contract
   */
  getContractLogs(contractId: string): LogEntry[] {
    return this.contractLogs.get(contractId) || [];
  }

  /**
   * Get all logs
   */
  getAllLogs(): LogEntry[] {
    return this.logs;
  }

  /**
   * Get recent logs
   */
  getRecentLogs(limit: number = 100): LogEntry[] {
    return this.logs.slice(-limit);
  }

  /**
   * Filter logs by level
   */
  getLogsByLevel(level: LogLevel): LogEntry[] {
    return this.logs.filter((log) => log.level === level);
  }

  /**
   * Clear logs
   */
  clear(): void {
    this.logs = [];
    this.contractLogs.clear();
  }

  /**
   * Convenience methods
   */
  async debug(message: string, metadata?: Record<string, any>, contractId?: string): Promise<void> {
    return this.log(LogLevel.DEBUG, message, metadata, contractId);
  }

  async info(message: string, metadata?: Record<string, any>, contractId?: string): Promise<void> {
    return this.log(LogLevel.INFO, message, metadata, contractId);
  }

  async warn(message: string, metadata?: Record<string, any>, contractId?: string): Promise<void> {
    return this.log(LogLevel.WARN, message, metadata, contractId);
  }

  async error(message: string, metadata?: Record<string, any>, contractId?: string): Promise<void> {
    return this.log(LogLevel.ERROR, message, metadata, contractId);
  }
}

/**
 * Dashboard Token Authentication
 *
 * Manages secure token generation and validation for dashboard access
 */

import { randomBytes } from 'crypto';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import os from 'os';

const CONFIG_DIR = join(os.homedir(), '.relay');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

export interface DashboardConfig {
  dashboardToken?: string;
  dashboardPort?: number;
  theme?: 'dark' | 'light';
  autoRefresh?: boolean;
}

/**
 * Generate a cryptographically secure random token
 */
export function generateToken(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Get the stored dashboard token from config
 */
export function getStoredToken(): string | null {
  try {
    if (!existsSync(CONFIG_FILE)) {
      return null;
    }

    const configData = readFileSync(CONFIG_FILE, 'utf-8');
    const config: DashboardConfig = JSON.parse(configData);
    return config.dashboardToken || null;
  } catch (error) {
    console.error('Failed to read dashboard token:', error);
    return null;
  }
}

/**
 * Save dashboard token to config file
 */
export function saveToken(token: string): void {
  try {
    let config: DashboardConfig = {};

    if (existsSync(CONFIG_FILE)) {
      const configData = readFileSync(CONFIG_FILE, 'utf-8');
      config = JSON.parse(configData);
    }

    config.dashboardToken = token;

    writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
  } catch (error) {
    console.error('Failed to save dashboard token:', error);
    throw error;
  }
}

/**
 * Validate a token against the stored token
 */
export function validateToken(token: string | undefined): boolean {
  if (!token) {
    return false;
  }

  const storedToken = getStoredToken();
  if (!storedToken) {
    return false;
  }

  // Constant-time comparison to prevent timing attacks
  return timingSafeEqual(Buffer.from(token), Buffer.from(storedToken));
}

/**
 * Timing-safe string comparison
 */
function timingSafeEqual(a: Buffer, b: Buffer): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a[i] ^ b[i];
  }

  return result === 0;
}

/**
 * Ensure a dashboard token exists, generate if not
 */
export function ensureToken(): string {
  let token = getStoredToken();

  if (!token) {
    token = generateToken();
    saveToken(token);
  }

  return token;
}

/**
 * Regenerate the dashboard token
 */
export function regenerateToken(): string {
  const newToken = generateToken();
  saveToken(newToken);
  return newToken;
}

/**
 * Get full dashboard config
 */
export function getDashboardConfig(): DashboardConfig {
  try {
    if (!existsSync(CONFIG_FILE)) {
      return {};
    }

    const configData = readFileSync(CONFIG_FILE, 'utf-8');
    return JSON.parse(configData);
  } catch (error) {
    console.error('Failed to read dashboard config:', error);
    return {};
  }
}

/**
 * Update dashboard config
 */
export function updateDashboardConfig(updates: Partial<DashboardConfig>): void {
  try {
    const config = getDashboardConfig();
    const newConfig = { ...config, ...updates };
    writeFileSync(CONFIG_FILE, JSON.stringify(newConfig, null, 2), 'utf-8');
  } catch (error) {
    console.error('Failed to update dashboard config:', error);
    throw error;
  }
}

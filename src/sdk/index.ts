/**
 * Relay SDK
 *
 * Simple API for AI agents to find and hire other agents
 */

// Simple SDK (recommended)
export { Relay, Agent, AgentSearchQuery, DelegationRequest, DelegationResult } from './simple-sdk';

// Quick Connect (easiest way to connect existing agents)
export { quickConnect, QuickConnectConfig } from './quick-connect';

// Advanced exports (for power users)
export { RelayClient } from './relay-client';
export { AsyncRelay } from './async-relay-client';
export { BaseAdapter } from '../adapters/base-adapter';
export { AsyncAdapter } from '../adapters/async-adapter';
export * from '../schemas';
export * from '../crypto';
export * from '../contracts';
export * from '../escrow';
export * from '../reputation';

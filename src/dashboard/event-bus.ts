/**
 * Event Bus for Real-Time Updates
 *
 * Central event coordination system for dashboard updates
 */

import { EventEmitter } from 'events';

export type DashboardEvent =
  | 'agent:registered'
  | 'agent:unregistered'
  | 'agent:status_change'
  | 'agent:discovered'
  | 'agent:left'
  | 'task:created'
  | 'task:updated'
  | 'task:completed'
  | 'task:failed'
  | 'escrow:created'
  | 'escrow:released'
  | 'escrow:refunded'
  | 'config:updated';

export interface EventPayload {
  timestamp: number;
  source: string;
  data: any;
}

/**
 * Global event bus for dashboard updates
 */
class DashboardEventBus extends EventEmitter {
  private static instance: DashboardEventBus;

  private constructor() {
    super();
    this.setMaxListeners(100); // Support many listeners
  }

  /**
   * Get singleton instance
   */
  static getInstance(): DashboardEventBus {
    if (!DashboardEventBus.instance) {
      DashboardEventBus.instance = new DashboardEventBus();
    }
    return DashboardEventBus.instance;
  }

  /**
   * Emit dashboard event
   */
  emitEvent(event: DashboardEvent, data: any, source: string = 'system'): void {
    const payload: EventPayload = {
      timestamp: Date.now(),
      source,
      data,
    };

    this.emit(event, payload);

    // Also emit generic 'event' for logging
    this.emit('*', { event, ...payload });
  }

  /**
   * Listen for specific event
   */
  onEvent(event: DashboardEvent, handler: (payload: EventPayload) => void): void {
    this.on(event, handler);
  }

  /**
   * Listen for all events
   */
  onAnyEvent(handler: (event: string, payload: EventPayload) => void): void {
    this.on('*', ({ event, ...payload }: any) => handler(event, payload));
  }

  /**
   * Remove event listener
   */
  offEvent(event: DashboardEvent, handler: (payload: EventPayload) => void): void {
    this.off(event, handler);
  }
}

// Export singleton instance
export const eventBus = DashboardEventBus.getInstance();

/**
 * Helper functions for common events
 */

export function emitAgentRegistered(agentId: string, agentName: string, endpoint: string): void {
  eventBus.emitEvent('agent:registered', { agentId, agentName, endpoint }, 'registry');
}

export function emitAgentUnregistered(agentId: string): void {
  eventBus.emitEvent('agent:unregistered', { agentId }, 'registry');
}

export function emitAgentStatusChange(agentId: string, status: 'online' | 'offline' | 'busy'): void {
  eventBus.emitEvent('agent:status_change', { agentId, status }, 'registry');
}

export function emitAgentDiscovered(agentId: string, agentName: string, capabilities: string[]): void {
  eventBus.emitEvent('agent:discovered', { agentId, agentName, capabilities }, 'mdns');
}

export function emitAgentLeft(agentId: string): void {
  eventBus.emitEvent('agent:left', { agentId }, 'mdns');
}

export function emitTaskCreated(taskId: string, delegator: string, performer: string, capability: string, amount: number): void {
  eventBus.emitEvent('task:created', { taskId, delegator, performer, capability, amount }, 'escrow');
}

export function emitTaskCompleted(taskId: string, result: any): void {
  eventBus.emitEvent('task:completed', { taskId, result }, 'escrow');
}

export function emitTaskFailed(taskId: string, error: string): void {
  eventBus.emitEvent('task:failed', { taskId, error }, 'escrow');
}

export function emitEscrowCreated(escrowId: string, amount: number, delegator: string, performer: string): void {
  eventBus.emitEvent('escrow:created', { escrowId, amount, delegator, performer }, 'escrow');
}

export function emitEscrowReleased(escrowId: string, amount: number): void {
  eventBus.emitEvent('escrow:released', { escrowId, amount }, 'escrow');
}

export function emitEscrowRefunded(escrowId: string, amount: number): void {
  eventBus.emitEvent('escrow:refunded', { escrowId, amount }, 'escrow');
}

export function emitConfigUpdated(config: any): void {
  eventBus.emitEvent('config:updated', config, 'dashboard');
}

/**
 * Relay Event Bus → AG-UI Protocol Adapter
 *
 * Bridges Relay's event bus to AG-UI compatible event streams
 */

import { eventBus, DashboardEvent, EventPayload } from '../event-bus';
import {
  AGUI_EVENT_TYPES,
  RelayAGUIEvent,
  RelayAGUIEventType,
  createAGUIEvent,
  RelayAGUIState,
} from './event-types';

export type AGUIEventHandler = (event: RelayAGUIEvent) => void;

/**
 * Maps Relay internal events to AG-UI protocol events
 */
const EVENT_MAPPING: Record<DashboardEvent, RelayAGUIEventType | null> = {
  'agent:registered': AGUI_EVENT_TYPES['relay.agent.registered'],
  'agent:unregistered': AGUI_EVENT_TYPES['relay.agent.unregistered'],
  'agent:status_change': AGUI_EVENT_TYPES['relay.agent.status_changed'],
  'agent:discovered': AGUI_EVENT_TYPES['relay.agent.discovered'],
  'agent:left': AGUI_EVENT_TYPES['relay.agent.unregistered'],
  'task:created': AGUI_EVENT_TYPES['relay.contract.created'],
  'task:updated': null, // Not mapped to AG-UI
  'task:completed': AGUI_EVENT_TYPES['relay.contract.completed'],
  'task:failed': AGUI_EVENT_TYPES['relay.contract.failed'],
  'escrow:created': AGUI_EVENT_TYPES['relay.payment.locked'],
  'escrow:released': AGUI_EVENT_TYPES['relay.payment.released'],
  'escrow:refunded': AGUI_EVENT_TYPES['relay.payment.refunded'],
  'config:updated': AGUI_EVENT_TYPES['relay.system.config_updated'],
};

/**
 * Relay Event Bus to AG-UI Adapter
 *
 * Listens to Relay events and transforms them into AG-UI compatible events
 */
export class RelayAGUIEventAdapter {
  private handlers: Set<AGUIEventHandler> = new Set();
  private state: RelayAGUIState = this.createInitialState();
  private initialized: boolean = false;

  constructor() {
    this.setupEventListeners();
  }

  /**
   * Subscribe to AG-UI events
   */
  subscribe(handler: AGUIEventHandler): () => void {
    this.handlers.add(handler);

    // Return unsubscribe function
    return () => {
      this.handlers.delete(handler);
    };
  }

  /**
   * Get current AG-UI state
   */
  getState(): Readonly<RelayAGUIState> {
    return { ...this.state };
  }

  /**
   * Emit AG-UI event to all subscribers
   */
  private emit(event: RelayAGUIEvent): void {
    // Update internal state based on event
    this.updateState(event);

    // Notify all handlers
    this.handlers.forEach((handler) => {
      try {
        handler(event);
      } catch (error) {
        console.error('AG-UI event handler error:', error);
      }
    });
  }

  /**
   * Setup listeners on Relay event bus
   */
  private setupEventListeners(): void {
    // Listen to all Relay events
    eventBus.onAnyEvent((event, payload) => {
      const aguiEventType = EVENT_MAPPING[event as DashboardEvent];

      if (!aguiEventType) {
        // Event not mapped to AG-UI
        return;
      }

      // Transform Relay event to AG-UI event
      const aguiEvent = this.transformEvent(aguiEventType, payload);

      if (aguiEvent) {
        this.emit(aguiEvent);
      }
    });

    if (!this.initialized) {
      // Emit initialization event
      this.emit(
        createAGUIEvent(AGUI_EVENT_TYPES['relay.system.initialized'], {
          message: 'Relay AG-UI adapter initialized',
        })
      );
      this.initialized = true;
    }
  }

  /**
   * Transform Relay event payload to AG-UI event
   */
  private transformEvent(
    type: RelayAGUIEventType,
    payload: EventPayload
  ): RelayAGUIEvent | null {
    const { data, timestamp, source } = payload;

    // Transform based on event type
    switch (type) {
      case AGUI_EVENT_TYPES['relay.agent.registered']:
      case AGUI_EVENT_TYPES['relay.agent.discovered']:
        return createAGUIEvent(type, {
          agentId: data.agentId || data.id,
          name: data.name,
          capabilities: data.capabilities || [],
          endpoint: data.endpoint || `http://localhost:${data.port || 8500}`,
          port: data.port,
          timestamp,
        });

      case AGUI_EVENT_TYPES['relay.agent.unregistered']:
        return createAGUIEvent(type, {
          agentId: data.agentId || data.id,
          timestamp,
        });

      case AGUI_EVENT_TYPES['relay.contract.created']:
        return createAGUIEvent(type, {
          taskId: data.taskId || data.id,
          clientId: data.clientId || data.client,
          providerId: data.providerId || data.provider,
          capability: data.capability,
          params: data.params || {},
          price: data.price || 0,
          timestamp,
        });

      case AGUI_EVENT_TYPES['relay.contract.completed']:
      case AGUI_EVENT_TYPES['relay.contract.failed']:
        return createAGUIEvent(type, {
          taskId: data.taskId || data.id,
          result: data.result,
          timestamp,
        });

      case AGUI_EVENT_TYPES['relay.payment.locked']:
      case AGUI_EVENT_TYPES['relay.payment.released']:
      case AGUI_EVENT_TYPES['relay.payment.refunded']:
        return createAGUIEvent(type, {
          taskId: data.taskId || data.id,
          agentId: data.agentId,
          amount: data.amount || 0,
          timestamp,
        });

      default:
        // Generic transformation
        return createAGUIEvent(type, {
          ...data,
          timestamp,
        });
    }
  }

  /**
   * Update internal state based on event
   */
  private updateState(event: RelayAGUIEvent): void {
    switch (event.type) {
      case AGUI_EVENT_TYPES['relay.agent.registered']:
      case AGUI_EVENT_TYPES['relay.agent.discovered']:
        this.upsertAgent({
          agentId: event.data.agentId,
          name: event.data.name,
          capabilities: event.data.capabilities,
          endpoint: event.data.endpoint,
          status: 'online',
          lastSeen: event.data.timestamp,
        });
        break;

      case AGUI_EVENT_TYPES['relay.agent.unregistered']:
        this.removeAgent(event.data.agentId);
        break;

      case AGUI_EVENT_TYPES['relay.contract.created']:
        this.state.contracts.push({
          taskId: event.data.taskId,
          clientId: event.data.clientId,
          providerId: event.data.providerId,
          capability: event.data.capability,
          status: 'created',
          price: event.data.price,
          timestamp: event.data.timestamp,
        });
        this.updateNetworkStats();
        break;

      case AGUI_EVENT_TYPES['relay.contract.signed']:
        this.updateContract(event.data.taskId, { status: 'signed' });
        break;

      case AGUI_EVENT_TYPES['relay.contract.funded']:
        this.updateContract(event.data.taskId, { status: 'funded' });
        break;

      case AGUI_EVENT_TYPES['relay.contract.completed']:
        this.updateContract(event.data.taskId, { status: 'completed' });
        this.updateNetworkStats();
        break;

      case AGUI_EVENT_TYPES['relay.contract.failed']:
        this.updateContract(event.data.taskId, { status: 'failed' });
        this.updateNetworkStats();
        break;

      case AGUI_EVENT_TYPES['relay.payment.locked']:
        this.state.payments.push({
          taskId: event.data.taskId,
          agentId: event.data.agentId,
          amount: event.data.amount,
          status: 'locked',
          timestamp: event.data.timestamp,
        });
        this.updateNetworkStats();
        break;

      case AGUI_EVENT_TYPES['relay.payment.released']:
        this.updatePayment(event.data.taskId, { status: 'released' });
        this.updateNetworkStats();
        break;

      case AGUI_EVENT_TYPES['relay.payment.refunded']:
        this.updatePayment(event.data.taskId, { status: 'refunded' });
        this.updateNetworkStats();
        break;
    }
  }

  private upsertAgent(agent: RelayAGUIState['agents'][0]): void {
    const index = this.state.agents.findIndex((a) => a.agentId === agent.agentId);
    if (index >= 0) {
      this.state.agents[index] = agent;
    } else {
      this.state.agents.push(agent);
    }
    this.updateNetworkStats();
  }

  private removeAgent(agentId: string): void {
    this.state.agents = this.state.agents.filter((a) => a.agentId !== agentId);
    this.updateNetworkStats();
  }

  private updateContract(taskId: string, updates: Partial<RelayAGUIState['contracts'][0]>): void {
    const contract = this.state.contracts.find((c) => c.taskId === taskId);
    if (contract) {
      Object.assign(contract, updates);
    }
  }

  private updatePayment(taskId: string, updates: Partial<RelayAGUIState['payments'][0]>): void {
    const payment = this.state.payments.find((p) => p.taskId === taskId);
    if (payment) {
      Object.assign(payment, updates);
    }
  }

  private updateNetworkStats(): void {
    this.state.network = {
      totalAgents: this.state.agents.filter((a) => a.status === 'online').length,
      activeContracts: this.state.contracts.filter(
        (c) => c.status === 'created' || c.status === 'signed' || c.status === 'funded'
      ).length,
      totalPaymentsLocked: this.state.payments
        .filter((p) => p.status === 'locked')
        .reduce((sum, p) => sum + p.amount, 0),
      health: this.state.agents.length > 0 ? 'healthy' : 'offline',
    };
  }

  private createInitialState(): RelayAGUIState {
    return {
      agents: [],
      contracts: [],
      payments: [],
      network: {
        totalAgents: 0,
        activeContracts: 0,
        totalPaymentsLocked: 0,
        health: 'offline',
      },
    };
  }
}

// Export singleton instance
export const aguiAdapter = new RelayAGUIEventAdapter();

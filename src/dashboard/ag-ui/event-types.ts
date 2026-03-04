/**
 * Relay-Specific AG-UI Event Types
 *
 * Defines custom event types that map Relay domain events to AG-UI protocol.
 * These events enable real-time streaming updates in the dashboard.
 */

export const AGUI_EVENT_TYPES = {
  // Agent discovery events
  'relay.agent.discovered': 'relay.agent.discovered',
  'relay.agent.registered': 'relay.agent.registered',
  'relay.agent.unregistered': 'relay.agent.unregistered',
  'relay.agent.status_changed': 'relay.agent.status_changed',

  // Contract/task events
  'relay.contract.created': 'relay.contract.created',
  'relay.contract.signed': 'relay.contract.signed',
  'relay.contract.funded': 'relay.contract.funded',
  'relay.contract.completed': 'relay.contract.completed',
  'relay.contract.failed': 'relay.contract.failed',

  // Payment/escrow events
  'relay.payment.locked': 'relay.payment.locked',
  'relay.payment.released': 'relay.payment.released',
  'relay.payment.refunded': 'relay.payment.refunded',
  'relay.escrow.deposit': 'relay.escrow.deposit',
  'relay.escrow.withdraw': 'relay.escrow.withdraw',

  // Network events
  'relay.network.peer_connected': 'relay.network.peer_connected',
  'relay.network.peer_disconnected': 'relay.network.peer_disconnected',
  'relay.network.topology_updated': 'relay.network.topology_updated',

  // System events
  'relay.system.config_updated': 'relay.system.config_updated',
  'relay.system.health_check': 'relay.system.health_check',
  'relay.system.initialized': 'relay.system.initialized',
} as const;

export type RelayAGUIEventType = typeof AGUI_EVENT_TYPES[keyof typeof AGUI_EVENT_TYPES];

/**
 * AG-UI Event Payload Interfaces
 */

export interface RelayAgentDiscoveredEvent {
  type: 'relay.agent.discovered';
  data: {
    agentId: string;
    name: string;
    capabilities: string[];
    endpoint: string;
    timestamp: number;
  };
}

export interface RelayAgentRegisteredEvent {
  type: 'relay.agent.registered';
  data: {
    agentId: string;
    name: string;
    capabilities: string[];
    port: number;
    timestamp: number;
  };
}

export interface RelayContractCreatedEvent {
  type: 'relay.contract.created';
  data: {
    taskId: string;
    clientId: string;
    providerId: string;
    capability: string;
    params: any;
    price: number;
    timestamp: number;
  };
}

export interface RelayPaymentLockedEvent {
  type: 'relay.payment.locked';
  data: {
    taskId: string;
    agentId: string;
    amount: number;
    timestamp: number;
  };
}

export interface RelayNetworkTopologyEvent {
  type: 'relay.network.topology_updated';
  data: {
    totalAgents: number;
    activeContracts: number;
    networkHealth: 'healthy' | 'degraded' | 'offline';
    timestamp: number;
  };
}

export type RelayAGUIEvent =
  | RelayAgentDiscoveredEvent
  | RelayAgentRegisteredEvent
  | RelayContractCreatedEvent
  | RelayPaymentLockedEvent
  | RelayNetworkTopologyEvent;

/**
 * AG-UI State Shape for Relay Dashboard
 */
export interface RelayAGUIState {
  agents: Array<{
    agentId: string;
    name: string;
    capabilities: string[];
    endpoint: string;
    status: 'online' | 'offline';
    lastSeen: number;
  }>;
  contracts: Array<{
    taskId: string;
    clientId: string;
    providerId: string;
    capability: string;
    status: 'created' | 'signed' | 'funded' | 'completed' | 'failed';
    price: number;
    timestamp: number;
  }>;
  payments: Array<{
    taskId: string;
    agentId: string;
    amount: number;
    status: 'locked' | 'released' | 'refunded';
    timestamp: number;
  }>;
  network: {
    totalAgents: number;
    activeContracts: number;
    totalPaymentsLocked: number;
    health: 'healthy' | 'degraded' | 'offline';
  };
}

/**
 * Helper to create AG-UI compatible event from Relay event
 */
export function createAGUIEvent<T extends RelayAGUIEventType>(
  type: T,
  data: any
): RelayAGUIEvent {
  return {
    type,
    data: {
      ...data,
      timestamp: data.timestamp || Date.now(),
    },
  } as RelayAGUIEvent;
}

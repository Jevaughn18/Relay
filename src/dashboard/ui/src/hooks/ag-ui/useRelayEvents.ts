/**
 * useRelayEvents Hook
 *
 * React hook for subscribing to Relay AG-UI events via Server-Sent Events
 */

import { useEffect, useState } from 'react';

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

const INITIAL_STATE: RelayAGUIState = {
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

/**
 * Hook to subscribe to real-time Relay events via AG-UI
 */
export function useRelayEvents(runtimeUrl: string = 'http://127.0.0.1:8789') {
  const [state, setState] = useState<RelayAGUIState>(INITIAL_STATE);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let eventSource: EventSource | null = null;
    let reconnectTimeout: NodeJS.Timeout;

    const connect = () => {
      try {
        // Connect to SSE endpoint
        eventSource = new EventSource(`${runtimeUrl}/api/events`);

        eventSource.onopen = () => {
          console.log('✓ Connected to Relay AG-UI events');
          setConnected(true);
          setError(null);
        };

        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);

            // Handle initial state
            if (data.type === 'init') {
              setState(data.state);
              return;
            }

            // Handle event updates
            // The state is updated by the event adapter on the server
            // But we can also update locally for immediate UI updates
            setState((prevState) => updateStateFromEvent(prevState, data));
          } catch (err) {
            console.error('Error parsing event:', err);
          }
        };

        eventSource.onerror = (err) => {
          console.error('EventSource error:', err);
          setConnected(false);
          setError(new Error('Connection lost'));

          // Reconnect after 5 seconds
          reconnectTimeout = setTimeout(connect, 5000);
        };
      } catch (err) {
        console.error('Error connecting to AG-UI runtime:', err);
        setError(err as Error);
        setConnected(false);

        // Retry connection
        reconnectTimeout = setTimeout(connect, 5000);
      }
    };

    connect();

    // Cleanup
    return () => {
      if (eventSource) {
        eventSource.close();
      }
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
    };
  }, [runtimeUrl]);

  return { state, connected, error };
}

/**
 * Update local state based on event
 * (This mirrors the logic in event-adapter.ts for client-side updates)
 */
function updateStateFromEvent(state: RelayAGUIState, event: any): RelayAGUIState {
  const newState = { ...state };

  switch (event.type) {
    case 'relay.agent.registered':
    case 'relay.agent.discovered':
      // Add or update agent
      const agentIndex = newState.agents.findIndex((a) => a.agentId === event.data.agentId);
      const newAgent = {
        agentId: event.data.agentId,
        name: event.data.name,
        capabilities: event.data.capabilities,
        endpoint: event.data.endpoint,
        status: 'online' as const,
        lastSeen: event.data.timestamp,
      };

      if (agentIndex >= 0) {
        newState.agents[agentIndex] = newAgent;
      } else {
        newState.agents.push(newAgent);
      }
      break;

    case 'relay.agent.unregistered':
      // Remove agent
      newState.agents = newState.agents.filter((a) => a.agentId !== event.data.agentId);
      break;

    case 'relay.contract.created':
      // Add new contract
      newState.contracts.push({
        taskId: event.data.taskId,
        clientId: event.data.clientId,
        providerId: event.data.providerId,
        capability: event.data.capability,
        status: 'created',
        price: event.data.price,
        timestamp: event.data.timestamp,
      });
      break;

    case 'relay.contract.completed':
      // Update contract status
      const contract = newState.contracts.find((c) => c.taskId === event.data.taskId);
      if (contract) {
        contract.status = 'completed';
      }
      break;

    case 'relay.payment.locked':
      // Add payment
      newState.payments.push({
        taskId: event.data.taskId,
        agentId: event.data.agentId,
        amount: event.data.amount,
        status: 'locked',
        timestamp: event.data.timestamp,
      });
      break;

    case 'relay.payment.released':
      // Update payment status
      const payment = newState.payments.find((p) => p.taskId === event.data.taskId);
      if (payment) {
        payment.status = 'released';
      }
      break;
  }

  // Recalculate network stats
  newState.network = {
    totalAgents: newState.agents.filter((a) => a.status === 'online').length,
    activeContracts: newState.contracts.filter(
      (c) => c.status === 'created' || c.status === 'signed' || c.status === 'funded'
    ).length,
    totalPaymentsLocked: newState.payments
      .filter((p) => p.status === 'locked')
      .reduce((sum, p) => sum + p.amount, 0),
    health: newState.agents.length > 0 ? 'healthy' : 'offline',
  };

  return newState;
}

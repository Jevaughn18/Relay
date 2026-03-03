import { useState, useEffect, useRef, useCallback } from 'react';

interface Agent {
  agentId: string;
  agentName: string;
  endpoint: string;
  capabilities: string[];
  status: 'online' | 'offline' | 'busy';
  lastSeen: string;
}

interface Stats {
  totalAgents: number;
  onlineAgents: number;
  totalTasks: number;
}

export function useWebSocket(token: string | null, isAuthenticated: boolean) {
  const [connected, setConnected] = useState(false);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalAgents: 0,
    onlineAgents: 0,
    totalTasks: 0,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    if (!token || !isAuthenticated) return;

    const wsUrl = `ws://127.0.0.1:8788`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('[WebSocket] Connected');

      // Send authentication message
      ws.send(JSON.stringify({
        type: 'AUTH',
        data: { token }
      }));
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);

        switch (message.type) {
          case 'AUTH_SUCCESS':
            setConnected(true);
            console.log('[WebSocket] Authenticated');
            // Request initial data
            fetchAgents();
            break;

          case 'AUTH_FAILED':
            console.error('[WebSocket] Authentication failed');
            setConnected(false);
            ws.close();
            break;

          case 'AGENT_UPDATE':
            // Update agents list
            fetchAgents();
            break;

          case 'TASK_UPDATE':
            // Update stats
            fetchAgents();
            break;

          case 'PONG':
            // Heartbeat response
            break;

          default:
            console.log('[WebSocket] Unknown message type:', message.type);
        }
      } catch (error) {
        console.error('[WebSocket] Failed to parse message:', error);
      }
    };

    ws.onclose = () => {
      console.log('[WebSocket] Disconnected');
      setConnected(false);

      // Attempt to reconnect after 3 seconds
      reconnectTimeoutRef.current = setTimeout(() => {
        console.log('[WebSocket] Reconnecting...');
        connect();
      }, 3000);
    };

    ws.onerror = (error) => {
      console.error('[WebSocket] Error:', error);
    };

    wsRef.current = ws;
  }, [token, isAuthenticated]);

  const fetchAgents = async () => {
    try {
      const response = await fetch('/api/overview');
      const data = await response.json();

      setAgents(data.agents || []);
      setStats({
        totalAgents: data.agents?.length || 0,
        onlineAgents: data.agents?.filter((a: any) => a.healthy).length || 0,
        totalTasks: 0, // TODO: Add task tracking
      });
    } catch (error) {
      console.error('Failed to fetch agents:', error);
    }
  };

  useEffect(() => {
    if (isAuthenticated && token) {
      connect();
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [isAuthenticated, token, connect]);

  // Heartbeat ping every 30 seconds
  useEffect(() => {
    if (!connected || !wsRef.current) return;

    const interval = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'PING' }));
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [connected]);

  return {
    connected,
    agents,
    stats,
  };
}

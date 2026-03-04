/**
 * AG-UI Provider for Relay Dashboard
 *
 * Provides AG-UI context and connection management
 * CopilotKit integration will be added when AI features are needed
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
// import { CopilotKit } from '@copilotkit/react-core';
// import '@copilotkit/react-ui/styles.css';

interface AGUIContextValue {
  enabled: boolean;
  runtimeUrl: string;
  connected: boolean;
}

const AGUIContext = createContext<AGUIContextValue>({
  enabled: false,
  runtimeUrl: '',
  connected: false,
});

export const useAGUI = () => useContext(AGUIContext);

interface AGUIProviderProps {
  children: React.ReactNode;
  enabled?: boolean;
  runtimeUrl?: string;
}

/**
 * AG-UI Provider Component
 *
 * Provides CopilotKit integration and AG-UI context to the dashboard
 */
export function AGUIProvider({
  children,
  enabled = true,
  runtimeUrl = 'http://127.0.0.1:8789/api/copilotkit'
}: AGUIProviderProps) {
  const [connected, setConnected] = useState(false);

  // Check if AG-UI runtime is available
  useEffect(() => {
    if (!enabled) {
      setConnected(false);
      return;
    }

    // Ping runtime health endpoint
    const checkConnection = async () => {
      try {
        const response = await fetch('http://127.0.0.1:8789/health');
        if (response.ok) {
          setConnected(true);
          console.log('✓ AG-UI runtime connected');
        } else {
          setConnected(false);
          console.warn('⚠ AG-UI runtime unhealthy');
        }
      } catch (error) {
        setConnected(false);
        console.warn('⚠ AG-UI runtime not available. Using legacy dashboard mode.');
      }
    };

    checkConnection();

    // Check connection every 30 seconds
    const interval = setInterval(checkConnection, 30000);

    return () => clearInterval(interval);
  }, [enabled]);

  const contextValue: AGUIContextValue = {
    enabled,
    runtimeUrl,
    connected,
  };

  // For now, we're using AG-UI for event streaming only (not AI agents)
  // CopilotKit integration will be added later when we need AI features
  // Our components use direct event streaming via useRelayEvents hook
  return (
    <AGUIContext.Provider value={contextValue}>
      {children}
    </AGUIContext.Provider>
  );
}

/**
 * Hook to check if AG-UI features are available
 */
export function useAGUIEnabled(): boolean {
  const { enabled, connected } = useAGUI();
  return enabled && connected;
}

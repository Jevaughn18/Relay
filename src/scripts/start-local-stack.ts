#!/usr/bin/env node
/**
 * Start local Relay stack:
 * - Discovery registry
 * - Shared escrow
 * - Dashboard UI
 */

import express from 'express';
import os from 'os';
import path from 'path';
import { RegistryServer } from '../discovery/registry-server';
import { SharedEscrowServer } from '../escrow/shared-escrow-server';
import { DashboardWebSocketServer } from '../dashboard/websocket-server';
import { eventBus } from '../dashboard/event-bus';
import { RelayAGUIRuntime } from '../dashboard/ag-ui/runtime-server';

function normalizeEndpoint(endpoint: string): string {
  return endpoint.replace('0.0.0.0', '127.0.0.1');
}

async function safeFetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  const host = process.env.RELAY_HOST || '127.0.0.1';
  const registryPort = parseInt(process.env.RELAY_REGISTRY_PORT || '9001', 10);
  const escrowPort = parseInt(process.env.RELAY_ESCROW_PORT || '9010', 10);
  const dashboardPort = parseInt(process.env.RELAY_DASHBOARD_PORT || '8787', 10);
  const websocketPort = parseInt(process.env.RELAY_WEBSOCKET_PORT || '8788', 10);
  const aguiPort = parseInt(process.env.RELAY_AGUI_PORT || '8789', 10);
  const stateFile =
    process.env.RELAY_ESCROW_STATE_FILE ||
    path.join(os.homedir(), '.relay', 'shared-escrow-state.json');

  // Start servers
  const registry = new RegistryServer({
    host,
    port: registryPort,
    staleCheckInterval: 5,
    requireSignedRequests: true,
  });

  const escrow = new SharedEscrowServer({
    host,
    port: escrowPort,
    stateFile,
    requireSignedRequests: true,
  });

  const wsServer = new DashboardWebSocketServer(websocketPort);

  // AG-UI Runtime Server (optional - only if enabled)
  const aguiEnabled = process.env.RELAY_AGUI_ENABLED !== 'false'; // enabled by default
  let aguiRuntime: RelayAGUIRuntime | null = null;

  if (aguiEnabled) {
    aguiRuntime = new RelayAGUIRuntime({
      port: aguiPort,
      enableCors: true,
      corsOrigin: `http://${host}:${dashboardPort}`,
    });
  }

  await registry.start();
  await escrow.start();

  if (aguiRuntime) {
    await aguiRuntime.start();
  }

  // Connect event bus to WebSocket broadcasts
  eventBus.onEvent('agent:registered', (payload) => {
    wsServer.broadcastAgentUpdate(payload.data.agentId, { event: 'registered', ...payload.data });
  });

  eventBus.onEvent('agent:unregistered', (payload) => {
    wsServer.broadcastAgentUpdate(payload.data.agentId, { event: 'unregistered' });
  });

  eventBus.onEvent('agent:status_change', (payload) => {
    wsServer.broadcastAgentUpdate(payload.data.agentId, { event: 'status_change', status: payload.data.status });
  });

  eventBus.onEvent('agent:discovered', (payload) => {
    wsServer.broadcastAgentUpdate(payload.data.agentId, { event: 'discovered', ...payload.data });
  });

  eventBus.onEvent('task:created', (payload) => {
    wsServer.broadcastTaskUpdate(payload.data.taskId, { event: 'created', ...payload.data });
  });

  eventBus.onEvent('task:completed', (payload) => {
    wsServer.broadcastTaskUpdate(payload.data.taskId, { event: 'completed', ...payload.data });
  });

  eventBus.onEvent('task:failed', (payload) => {
    wsServer.broadcastTaskUpdate(payload.data.taskId, { event: 'failed', ...payload.data });
  });

  const dashboard = express();
  dashboard.use(express.json());

  dashboard.get('/api/overview', async (_req, res) => {
    const registryBase = `http://${host}:${registryPort}`;
    const escrowBase = `http://${host}:${escrowPort}`;

    const [stats, agentsPayload, escrowHealth] = await Promise.all([
      safeFetchJson<Record<string, unknown>>(`${registryBase}/stats`),
      safeFetchJson<{ agents: any[]; totalAgents: number }>(`${registryBase}/agents`),
      safeFetchJson<Record<string, unknown>>(`${escrowBase}/health`),
    ]);

    const agents = agentsPayload?.agents || [];
    const statuses = await Promise.all(
      agents.map(async (agent) => {
        const endpoint = normalizeEndpoint(agent.endpoint);
        const status = await safeFetchJson<Record<string, unknown>>(`${endpoint}/status`);
        return {
          ...agent,
          endpoint,
          status,
          healthy: !!status,
        };
      })
    );

    res.json({
      host,
      ports: {
        registry: registryPort,
        escrow: escrowPort,
        dashboard: dashboardPort,
      },
      registryStats: stats,
      escrowHealth,
      agents: statuses,
    });
  });

  // Serve React dashboard (built static files)
  const dashboardPath = path.join(__dirname, '../../dist/dashboard');
  dashboard.use(express.static(dashboardPath));

  // Fallback to index.html for client-side routing (SPA)
  dashboard.use((req, res, next) => {
    // Skip API routes
    if (req.path.startsWith('/api/')) {
      return next();
    }
    // Serve index.html for all non-API routes (SPA routing)
    res.sendFile(path.join(dashboardPath, 'index.html'));
  });

  const appServer = dashboard.listen(dashboardPort, host, () => {
    console.log('');
    console.log(`✅ Dashboard started: http://${host}:${dashboardPort}`);
    console.log(`✅ Local stack ready`);
    console.log(`   Registry:   http://${host}:${registryPort}`);
    console.log(`   Escrow:     http://${host}:${escrowPort}`);
    console.log(`   Dashboard:  http://${host}:${dashboardPort}`);
    console.log(`   WebSocket:  ws://${host}:${websocketPort}`);
    if (aguiRuntime) {
      console.log(`   AG-UI:      http://${host}:${aguiPort}/api/events`);
    }
    console.log('');
  });

  const shutdown = async () => {
    appServer.close();
    const shutdownPromises = [
      registry.stop(),
      escrow.stop(),
      wsServer.close()
    ];

    if (aguiRuntime) {
      shutdownPromises.push(aguiRuntime.stop());
    }

    await Promise.all(shutdownPromises);
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((error) => {
  console.error('❌ Failed to start local stack:', error);
  process.exit(1);
});

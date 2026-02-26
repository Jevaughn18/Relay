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
  const stateFile =
    process.env.RELAY_ESCROW_STATE_FILE ||
    path.join(os.homedir(), '.relay', 'shared-escrow-state.json');

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

  await registry.start();
  await escrow.start();

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

  dashboard.get('/', (_req, res) => {
    res.type('html').send(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Relay Dashboard</title>
    <style>
      :root { --bg:#0f172a; --card:#111827; --text:#e5e7eb; --muted:#9ca3af; --ok:#10b981; --bad:#ef4444; --line:#1f2937; }
      * { box-sizing:border-box; }
      body { margin:0; font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial; background:linear-gradient(120deg,#0b1226,#101828); color:var(--text); }
      .wrap { max-width:1100px; margin:0 auto; padding:24px; }
      .row { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px; margin-bottom:12px; }
      .card { background:var(--card); border:1px solid var(--line); border-radius:12px; padding:14px; }
      .label { color:var(--muted); font-size:12px; }
      .value { font-size:22px; font-weight:700; margin-top:4px; }
      .ok { color:var(--ok); } .bad { color:var(--bad); }
      table { width:100%; border-collapse:collapse; background:var(--card); border:1px solid var(--line); border-radius:12px; overflow:hidden; }
      th,td { text-align:left; padding:10px; border-bottom:1px solid var(--line); font-size:14px; }
      th { color:var(--muted); font-weight:600; }
      .mono { font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; font-size:12px; }
      @media (max-width:860px){ .row { grid-template-columns:1fr; } }
    </style>
  </head>
  <body>
    <div class="wrap">
      <h1>Relay Dashboard</h1>
      <div class="row">
        <div class="card"><div class="label">Registry</div><div id="registry" class="value">...</div></div>
        <div class="card"><div class="label">Escrow</div><div id="escrow" class="value">...</div></div>
        <div class="card"><div class="label">Total Agents</div><div id="count" class="value">...</div></div>
      </div>
      <table>
        <thead>
          <tr><th>Name</th><th>Agent ID</th><th>Endpoint</th><th>Capabilities</th><th>Status</th><th>Balance</th></tr>
        </thead>
        <tbody id="agents"></tbody>
      </table>
      <p class="label">Refreshes every 3s</p>
    </div>
    <script>
      function capList(manifest){ return (manifest?.capabilities||[]).map(c=>c.name).join(', ') || '-'; }
      async function refresh(){
        const r = await fetch('/api/overview');
        const data = await r.json();
        document.getElementById('registry').innerHTML = data.registryStats ? '<span class="ok">online</span>' : '<span class="bad">offline</span>';
        document.getElementById('escrow').innerHTML = data.escrowHealth ? '<span class="ok">online</span>' : '<span class="bad">offline</span>';
        document.getElementById('count').textContent = String((data.agents||[]).length);
        const rows = (data.agents||[]).map(a => {
          const s = a.healthy ? '<span class="ok">healthy</span>' : '<span class="bad">down</span>';
          const bal = a.status?.balance ?? '-';
          return '<tr>'
            + '<td>' + (a.agentName || '-') + '</td>'
            + '<td class="mono">' + (a.agentId || '-') + '</td>'
            + '<td class="mono">' + (a.endpoint || '-') + '</td>'
            + '<td>' + capList(a.manifest) + '</td>'
            + '<td>' + s + '</td>'
            + '<td>' + bal + '</td>'
            + '</tr>';
        }).join('');
        document.getElementById('agents').innerHTML = rows || '<tr><td colspan="6" class="label">No agents registered yet</td></tr>';
      }
      refresh();
      setInterval(refresh, 3000);
    </script>
  </body>
</html>`);
  });

  const appServer = dashboard.listen(dashboardPort, host, () => {
    console.log('');
    console.log(`✅ Dashboard started: http://${host}:${dashboardPort}`);
    console.log(`✅ Local stack ready`);
    console.log(`   Registry:  http://${host}:${registryPort}`);
    console.log(`   Escrow:    http://${host}:${escrowPort}`);
    console.log(`   Dashboard: http://${host}:${dashboardPort}`);
    console.log('');
  });

  const shutdown = async () => {
    appServer.close();
    await Promise.all([registry.stop(), escrow.stop()]);
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((error) => {
  console.error('❌ Failed to start local stack:', error);
  process.exit(1);
});

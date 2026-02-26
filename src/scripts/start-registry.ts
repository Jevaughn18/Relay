#!/usr/bin/env node
/**
 * Start a Relay discovery registry server
 */

import { RegistryServer } from '../discovery/registry-server';

async function main() {
  const port = parseInt(process.env.PORT || '9001', 10);
  const host = process.env.HOST || 'localhost';

  const server = new RegistryServer({
    port,
    host,
    staleCheckInterval: 5, // 5 minutes
  });

  await server.start();

  // Handle shutdown
  process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down registry...');
    await server.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\n🛑 Shutting down registry...');
    await server.stop();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error('❌ Registry failed to start:', err);
  process.exit(1);
});

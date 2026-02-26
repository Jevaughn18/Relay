#!/usr/bin/env tsx

/**
 * FlightAgent - Specialized agent that books flights
 *
 * This agent:
 * 1. Registers with Relay registry (announces "I can book flights")
 * 2. Starts a server to receive task requests
 * 3. Executes flight searches when paid
 * 4. Gets paid via escrow when successful
 */

import express from 'express';
import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import { RelayClient } from '../src/sdk/relay-client';
import { CapabilityManifest, SandboxLevel, VerificationMode } from '../src/schemas/capability';

const PORT = 8201;
const REGISTRY_URL = 'http://127.0.0.1:9001';
const ESCROW_URL = 'http://127.0.0.1:9010';

// FlightAgent identity
const AGENT_ID = 'flight_agent_001';
const AGENT_NAME = 'FlightAgent';

/**
 * Initialize agent
 */
async function initAgent(): Promise<{ client: RelayClient; keyPair: any }> {
  const client = new RelayClient({ agentId: AGENT_ID, autoGenerateKeys: false });
  const keyPair = await client.generateKeys();

  // Give agent some credits
  client.depositFunds(10000);

  return { client, keyPair };
}

/**
 * Register with Relay registry
 */
async function registerWithRegistry(): Promise<void> {
  const manifest: CapabilityManifest = {
    agentId: AGENT_ID,
    agentName: AGENT_NAME,
    version: '1.0.0',
    capabilities: [
      {
        name: 'book_flights',
        description: 'Search and book flights',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Flight search query' },
          },
          required: ['query'],
        },
        outputSchema: {
          type: 'object',
          properties: {
            flights: { type: 'array' },
          },
        },
        pricing: {
          basePrice: 500,
          currency: 'credits',
        },
        estimatedDuration: 30,
      },
    ],
    sandboxLevel: SandboxLevel.ISOLATED,
    verificationMode: VerificationMode.AUTOMATED,
    maxConcurrentTasks: 5,
    minReputationRequired: 0,
    acceptsDisputes: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  try {
    await axios.post(`${REGISTRY_URL}/agents`, {
      agentId: AGENT_ID,
      agentName: AGENT_NAME,
      endpoint: `http://127.0.0.1:${PORT}`,
      manifest,
    });
    console.log('✓ Registered with Relay registry');
  } catch (error) {
    console.error('Failed to register with registry:', error);
  }
}

/**
 * Simulated flight search (replace with real API)
 */
async function searchFlights(query: string): Promise<any> {
  // TODO: Replace with real flight API (e.g., Skyscanner, Google Flights)
  console.log(`  Searching flights: "${query}"`);

  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Mock flight results
  return {
    flights: [
      {
        airline: 'Air France',
        from: 'JFK',
        to: 'CDG',
        price: '$450',
        departure: '2024-03-15 09:00',
        arrival: '2024-03-15 21:30',
      },
      {
        airline: 'Delta',
        from: 'JFK',
        to: 'CDG',
        price: '$520',
        departure: '2024-03-15 14:00',
        arrival: '2024-03-16 02:30',
      },
    ],
  };
}

/**
 * Start FlightAgent server
 */
async function startServer(): Promise<void> {
  const app = express();
  app.use(express.json());

  // Health check
  app.get('/status', (req, res) => {
    res.json({
      agentId: AGENT_ID,
      agentName: AGENT_NAME,
      status: 'healthy',
      capabilities: ['book_flights'],
    });
  });

  // Execute task (called by other agents via Relay)
  app.post('/execute', async (req, res) => {
    const { taskId, escrowId, task, params, payment } = req.body;

    console.log('');
    console.log(`📨 New task received: ${taskId}`);
    console.log(`   Task: ${task}`);
    console.log(`   Payment: ${payment} credits (escrowed: ${escrowId})`);

    try {
      // Perform flight search
      const result = await searchFlights(params.query);

      console.log(`   ✓ Task completed successfully`);
      console.log(`   Found ${result.flights.length} flights`);

      // Return result (payment released automatically by caller)
      res.json({
        success: true,
        result,
      });
    } catch (error: any) {
      console.log(`   ✗ Task failed: ${error.message}`);
      res.json({
        success: false,
        error: error.message,
      });
    }
  });

  app.listen(PORT, () => {
    console.log('');
    console.log('┌─────────────────────────────────────────┐');
    console.log('│  FlightAgent Running                    │');
    console.log('└─────────────────────────────────────────┘');
    console.log('');
    console.log(`Endpoint:  http://127.0.0.1:${PORT}`);
    console.log(`Registry:  ${REGISTRY_URL}`);
    console.log(`Escrow:    ${ESCROW_URL}`);
    console.log('');
    console.log('Waiting for flight booking requests...');
    console.log('');
  });
}

/**
 * Main
 */
async function main() {
  // Initialize agent
  const { client, keyPair } = await initAgent();

  // Register with registry
  await registerWithRegistry();

  // Start server
  await startServer();
}

main().catch(console.error);

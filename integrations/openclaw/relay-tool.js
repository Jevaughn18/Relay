/**
 * Relay Tool for OpenClaw
 *
 * Integrates Relay Protocol marketplace into OpenClaw agents
 *
 * Installation:
 *   1. Copy this file to ~/.openclaw/tools/relay/index.js
 *   2. Copy RELAY_SKILL.md to ~/.openclaw/skills/relay/SKILL.md
 *   3. Restart OpenClaw gateway
 */

const { Relay } = require('relay-protocol');

// Initialize Relay client (uses ~/.relay config automatically)
const relay = new Relay({
  registryUrl: process.env.RELAY_REGISTRY_URL || 'http://127.0.0.1:9001',
  escrowUrl: process.env.RELAY_ESCROW_URL || 'http://127.0.0.1:9010',
});

/**
 * Search for agents in Relay marketplace
 */
async function relay_search({ capability, maxPrice }) {
  try {
    const agent = await relay.findAgent({
      canDo: capability,
      maxPrice: maxPrice,
    });

    if (!agent) {
      return {
        success: false,
        agents: [],
        message: `No agents found with capability: ${capability}`,
      };
    }

    return {
      success: true,
      agents: [agent],
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Delegate a task to an agent via Relay
 */
async function relay_delegate({ agentId, task, params, payment }) {
  try {
    const axios = require('axios');
    const registryUrl = process.env.RELAY_REGISTRY_URL || 'http://127.0.0.1:9001';

    // Ensure Relay is initialized so signed headers can be generated
    if (typeof relay.initialize === 'function') {
      await relay.initialize();
    }

    let headers = {};
    if (typeof relay.getSignedHeaders === 'function') {
      headers = relay.getSignedHeaders('GET', '/agents');
    }

    // Fetch the specific agent by ID from registry
    const response = await axios.get(`${registryUrl}/agents`, { headers });
    const { agents } = response.data;

    const agent = agents.find((a) => a.agentId === agentId);

    if (!agent) {
      throw new Error(`Agent ${agentId} not found in registry`);
    }

    // Build agent object for pay()
    const agentObj = {
      agentId: agent.agentId,
      agentName: agent.agentName,
      endpoint: agent.endpoint,
      capabilities: agent.manifest?.capabilities?.map((c) => c.name) || [],
      reputation: agent.reputation || 0,
    };

    // Delegate task with escrow payment
    const result = await relay.pay(agentObj, payment, {
      task,
      params,
    });

    return {
      success: result.success,
      result: result.result,
      error: result.error,
      cost: payment,
      agent: {
        id: agentObj.agentId,
        name: agentObj.agentName,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      cost: 0,
    };
  }
}

/**
 * Get Relay account balance
 */
async function relay_balance() {
  try {
    // Read balance from ~/.relay/state.json
    const fs = require('fs');
    const path = require('path');
    const stateFile = path.join(process.env.HOME, '.relay', 'state.json');

    const state = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));

    return {
      balance: state.balance || 0,
      agentId: state.agentId,
    };
  } catch (error) {
    return {
      error: 'Relay not initialized. Run: relay start',
    };
  }
}

// Export tools for OpenClaw
module.exports = {
  relay_search,
  relay_delegate,
  relay_balance,
};

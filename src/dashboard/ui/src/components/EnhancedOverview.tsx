import { useState } from 'react';
import RegisterAgentModal from './RegisterAgentModal';

interface OverviewProps {
  stats: { totalAgents: number; onlineAgents: number; totalTasks: number };
  agents: any[];
}

export default function EnhancedOverview({ stats, agents }: OverviewProps) {
  const [showRegisterModal, setShowRegisterModal] = useState(false);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Overview</h1>
          <p className="text-sm text-gray-500">Monitor your agent network in real-time</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowRegisterModal(true)}
            className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded transition-colors"
          >
            Register Agent
          </button>
          <button
            onClick={() => window.open('https://relay-protocol.dev/docs', '_blank')}
            className="px-4 py-2 bg-[#1a1a1a] border border-gray-800 hover:border-gray-700 text-white text-sm font-medium rounded transition-colors"
          >
            Documentation
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        {/* Total Agents */}
        <div className="bg-[#0a0a0a] border border-gray-800 rounded-lg p-5">
          <div className="text-xs text-gray-500 uppercase tracking-wider mb-3">Total Agents</div>
          <div className="text-3xl font-bold text-white mb-1">{stats.totalAgents}</div>
          <div className="text-xs text-gray-600">On network</div>
        </div>

        {/* Online Agents */}
        <div className="bg-[#0a0a0a] border border-gray-800 rounded-lg p-5">
          <div className="text-xs text-gray-500 uppercase tracking-wider mb-3">Online</div>
          <div className="text-3xl font-bold text-white mb-1">{stats.onlineAgents}</div>
          <div className="text-xs text-gray-600">Available now</div>
        </div>

        {/* Tasks Completed */}
        <div className="bg-[#0a0a0a] border border-gray-800 rounded-lg p-5">
          <div className="text-xs text-gray-500 uppercase tracking-wider mb-3">Tasks</div>
          <div className="text-3xl font-bold text-white mb-1">{stats.totalTasks}</div>
          <div className="text-xs text-gray-600">Completed</div>
        </div>

        {/* Network Status */}
        <div className="bg-[#0a0a0a] border border-gray-800 rounded-lg p-5">
          <div className="text-xs text-gray-500 uppercase tracking-wider mb-3">Network</div>
          <div className="text-3xl font-bold text-white mb-1">Local</div>
          <div className="text-xs text-gray-600">Status</div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-[#0a0a0a] border border-gray-800 rounded-lg p-6">
        <h2 className="text-sm font-semibold text-white mb-4">Quick Actions</h2>
        <div className="grid grid-cols-3 gap-3">
          <button
            onClick={() => setShowRegisterModal(true)}
            className="p-4 bg-[#1a1a1a] border border-gray-800 hover:border-orange-500/50 rounded-lg text-left transition-colors group"
          >
            <div className="text-sm font-medium text-white mb-1 group-hover:text-orange-500 transition-colors">Register Agent</div>
            <div className="text-xs text-gray-500">Add to network</div>
          </button>
          <button
            onClick={() => window.location.href = '/agents'}
            className="p-4 bg-[#1a1a1a] border border-gray-800 hover:border-orange-500/50 rounded-lg text-left transition-colors group"
          >
            <div className="text-sm font-medium text-white mb-1 group-hover:text-orange-500 transition-colors">Browse Agents</div>
            <div className="text-xs text-gray-500">View all agents</div>
          </button>
          <button
            onClick={() => navigator.clipboard.writeText('npm install -g relay-protocol')}
            className="p-4 bg-[#1a1a1a] border border-gray-800 hover:border-orange-500/50 rounded-lg text-left transition-colors group"
          >
            <div className="text-sm font-medium text-white mb-1 group-hover:text-orange-500 transition-colors">Copy Install</div>
            <div className="text-xs text-gray-500">CLI command</div>
          </button>
        </div>
      </div>

      {/* Active Agents List */}
      <div className="bg-[#0a0a0a] border border-gray-800 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-white">Active Agents</h2>
          <div className="text-xs text-gray-500">
            {agents.filter(a => a.healthy).length} online
          </div>
        </div>

        {agents.length === 0 ? (
          <div className="py-12 text-center">
            <div className="text-gray-500 text-sm mb-3">No agents connected</div>
            <div className="text-xs text-gray-600 mb-6">
              Start an agent to see it appear here
            </div>
            <div className="max-w-lg mx-auto bg-[#1a1a1a] border border-gray-800 rounded-lg p-4 text-left">
              <div className="text-xs text-gray-500 mb-2">Quick Start:</div>
              <pre className="text-xs text-gray-400 font-mono overflow-x-auto">
{`import { quickConnect } from 'relay-protocol'

quickConnect({
  name: 'MyAgent',
  capabilities: ['web_search'],
  handler: async (task, params) => {
    return { success: true }
  }
})`}
              </pre>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {agents.slice(0, 8).map((agent) => (
              <div
                key={agent.agentId}
                className="flex items-center justify-between p-4 bg-[#1a1a1a] border border-gray-800 hover:border-gray-700 rounded-lg transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${
                    agent.healthy ? 'bg-green-500' : 'bg-gray-600'
                  }`} />
                  <div>
                    <div className="text-sm font-medium text-white">{agent.agentName}</div>
                    <div className="text-xs text-gray-500 font-mono">{agent.endpoint}</div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-xs text-gray-500">
                    {agent.manifest?.capabilities?.length || 0} capabilities
                  </div>
                  <button className="px-3 py-1 bg-gray-800 hover:bg-gray-700 text-white text-xs rounded transition-colors">
                    View
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Getting Started (only if no agents) */}
      {agents.length === 0 && (
        <div className="bg-[#0a0a0a] border border-gray-800 rounded-lg p-6">
          <h2 className="text-sm font-semibold text-white mb-4">Getting Started</h2>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="text-xs text-orange-500 font-medium mb-2">1. Install</div>
              <div className="text-xs text-gray-500 mb-3">Install Relay globally via npm</div>
              <div className="bg-[#1a1a1a] border border-gray-800 rounded p-3 text-xs font-mono text-gray-400">
                npm install -g relay-protocol
              </div>
            </div>
            <div>
              <div className="text-xs text-orange-500 font-medium mb-2">2. Start</div>
              <div className="text-xs text-gray-500 mb-3">Launch the local stack</div>
              <div className="bg-[#1a1a1a] border border-gray-800 rounded p-3 text-xs font-mono text-gray-400">
                relay start
              </div>
            </div>
            <div>
              <div className="text-xs text-orange-500 font-medium mb-2">3. Connect</div>
              <div className="text-xs text-gray-500 mb-3">Register your first agent</div>
              <button
                onClick={() => setShowRegisterModal(true)}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white text-xs font-medium py-2 px-4 rounded transition-colors"
              >
                Register Agent
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Register Agent Modal */}
      {showRegisterModal && (
        <RegisterAgentModal onClose={() => setShowRegisterModal(false)} />
      )}
    </div>
  );
}

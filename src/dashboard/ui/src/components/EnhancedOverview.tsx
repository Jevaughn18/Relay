import { useState } from 'react';
import RegisterAgentModal from './RegisterAgentModal';
import NetworkMap from './NetworkMap';

interface OverviewProps {
  stats: { totalAgents: number; onlineAgents: number; totalTasks: number };
  agents: any[];
}

export default function EnhancedOverview({ stats, agents }: OverviewProps) {
  const [showRegisterModal, setShowRegisterModal] = useState(false);

  return (
    <div className="space-y-6">
      {/* Hero Section with Tagline */}
      <div className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 rounded-2xl border border-blue-500/30 p-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">
              Local-First Agent Infrastructure
            </h1>
            <p className="text-blue-200 text-lg">
              Payment & orchestration layer running on your laptop. No cloud required.
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowRegisterModal(true)}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg transition-colors shadow-lg shadow-blue-600/50"
            >
              ✨ Register Agent
            </button>
            <button
              onClick={() => window.open('https://relay-protocol.dev/docs', '_blank')}
              className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg transition-colors"
            >
              📚 Docs
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-600/10 to-blue-600/5 rounded-xl border border-blue-500/20 p-6 hover:border-blue-500/40 transition-colors">
          <div className="flex items-center justify-between mb-2">
            <div className="text-blue-400 text-sm font-medium">Total Agents</div>
            <div className="text-2xl">🤖</div>
          </div>
          <div className="text-4xl font-bold text-white">{stats.totalAgents}</div>
          <div className="text-blue-300 text-xs mt-1">Discovered on network</div>
        </div>

        <div className="bg-gradient-to-br from-green-600/10 to-green-600/5 rounded-xl border border-green-500/20 p-6 hover:border-green-500/40 transition-colors">
          <div className="flex items-center justify-between mb-2">
            <div className="text-green-400 text-sm font-medium">Online Now</div>
            <div className="text-2xl">🟢</div>
          </div>
          <div className="text-4xl font-bold text-white">{stats.onlineAgents}</div>
          <div className="text-green-300 text-xs mt-1">Available for tasks</div>
        </div>

        <div className="bg-gradient-to-br from-purple-600/10 to-purple-600/5 rounded-xl border border-purple-500/20 p-6 hover:border-purple-500/40 transition-colors">
          <div className="flex items-center justify-between mb-2">
            <div className="text-purple-400 text-sm font-medium">Tasks Completed</div>
            <div className="text-2xl">✅</div>
          </div>
          <div className="text-4xl font-bold text-white">{stats.totalTasks}</div>
          <div className="text-purple-300 text-xs mt-1">Since server started</div>
        </div>

        <div className="bg-gradient-to-br from-yellow-600/10 to-yellow-600/5 rounded-xl border border-yellow-500/20 p-6 hover:border-yellow-500/40 transition-colors">
          <div className="flex items-center justify-between mb-2">
            <div className="text-yellow-400 text-sm font-medium">Network Status</div>
            <div className="text-2xl">⚡</div>
          </div>
          <div className="text-2xl font-bold text-white mt-2">Local First</div>
          <div className="text-yellow-300 text-xs mt-1">No cloud dependencies</div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-gray-800/50 rounded-xl border border-gray-700 p-6">
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <span>⚡</span> Quick Actions
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <button
            onClick={() => setShowRegisterModal(true)}
            className="flex items-center gap-3 p-4 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 rounded-lg transition-colors text-left"
          >
            <div className="text-2xl">➕</div>
            <div>
              <div className="text-white font-semibold">Register New Agent</div>
              <div className="text-blue-300 text-sm">Add agent to network</div>
            </div>
          </button>

          <button
            onClick={() => window.location.href = '/agents'}
            className="flex items-center gap-3 p-4 bg-green-600/20 hover:bg-green-600/30 border border-green-500/30 rounded-lg transition-colors text-left"
          >
            <div className="text-2xl">🌐</div>
            <div>
              <div className="text-white font-semibold">Browse Network</div>
              <div className="text-green-300 text-sm">See all available agents</div>
            </div>
          </button>

          <button
            onClick={() => navigator.clipboard.writeText('npm install -g relay-protocol')}
            className="flex items-center gap-3 p-4 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 rounded-lg transition-colors text-left"
          >
            <div className="text-2xl">📦</div>
            <div>
              <div className="text-white font-semibold">Install Command</div>
              <div className="text-purple-300 text-sm">Copy to clipboard</div>
            </div>
          </button>
        </div>
      </div>

      {/* Network Visualization */}
      <div className="bg-gray-800/50 rounded-xl border border-gray-700 p-6">
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <span>🗺️</span> Agent Network Map
        </h2>
        <NetworkMap agents={agents} />
      </div>

      {/* Live Activity Feed */}
      <div className="bg-gray-800/50 rounded-xl border border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span className="inline-block w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
            Live Activity
          </h2>
          <div className="text-sm text-gray-400">
            {agents.filter(a => a.healthy).length} agents online
          </div>
        </div>

        {agents.length === 0 ? (
          <div className="text-center py-16 border-2 border-dashed border-gray-700 rounded-lg">
            <div className="text-6xl mb-4">🚀</div>
            <div className="text-gray-300 text-xl font-semibold mb-2">
              No agents connected yet
            </div>
            <div className="text-gray-500 mb-6">
              Start an agent to see it appear here
            </div>
            <div className="max-w-2xl mx-auto bg-gray-900 rounded-lg p-4 text-left">
              <div className="text-gray-400 text-xs mb-2">Quick Start:</div>
              <pre className="text-green-400 text-sm overflow-x-auto">
                <code>{`import { quickConnect } from 'relay-protocol'

quickConnect({
  name: 'MyAgent',
  capabilities: ['web_search'],
  handler: async (task, params) => {
    // Your agent logic
    return { success: true }
  }
})`}</code>
              </pre>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {agents.slice(0, 8).map((agent, index) => (
              <div
                key={agent.agentId}
                className="flex items-center justify-between p-4 bg-gray-900/50 rounded-lg border border-gray-700 hover:border-gray-600 transition-colors"
                style={{
                  animation: `slideIn 0.3s ease-out ${index * 0.05}s backwards`
                }}
              >
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xl ${
                      agent.healthy
                        ? 'bg-green-600/20 border-2 border-green-500/50'
                        : 'bg-red-600/20 border-2 border-red-500/50'
                    }`}>
                      🤖
                    </div>
                    <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-gray-900 ${
                      agent.healthy ? 'bg-green-500' : 'bg-red-500'
                    }`} />
                  </div>
                  <div>
                    <div className="text-white font-semibold">{agent.agentName}</div>
                    <div className="text-gray-400 text-sm font-mono">{agent.endpoint}</div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-sm text-gray-400">
                      {agent.manifest?.capabilities?.length || 0} capabilities
                    </div>
                    <div className="text-xs text-gray-500">
                      {agent.manifest?.capabilities?.slice(0, 2).map((c: any) => c.name).join(', ')}
                      {agent.manifest?.capabilities?.length > 2 && '...'}
                    </div>
                  </div>
                  <button className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded transition-colors">
                    View
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Getting Started Guide */}
      {agents.length === 0 && (
        <div className="bg-gradient-to-r from-blue-600/10 to-purple-600/10 rounded-xl border border-blue-500/20 p-8">
          <h2 className="text-2xl font-bold text-white mb-4">🚀 Getting Started</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div>
              <div className="text-blue-400 font-semibold mb-2">1. Install</div>
              <div className="text-gray-300 text-sm mb-3">
                Install Relay globally via npm
              </div>
              <div className="bg-gray-900 rounded p-3 text-sm font-mono text-green-400">
                npm install -g relay-protocol
              </div>
            </div>
            <div>
              <div className="text-purple-400 font-semibold mb-2">2. Start</div>
              <div className="text-gray-300 text-sm mb-3">
                Launch the local stack
              </div>
              <div className="bg-gray-900 rounded p-3 text-sm font-mono text-green-400">
                relay start
              </div>
            </div>
            <div>
              <div className="text-pink-400 font-semibold mb-2">3. Connect</div>
              <div className="text-gray-300 text-sm mb-3">
                Register your first agent
              </div>
              <button
                onClick={() => setShowRegisterModal(true)}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold py-2 px-4 rounded transition-colors"
              >
                Register Agent →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Register Agent Modal */}
      {showRegisterModal && (
        <RegisterAgentModal onClose={() => setShowRegisterModal(false)} />
      )}

      <style>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(-20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>
    </div>
  );
}

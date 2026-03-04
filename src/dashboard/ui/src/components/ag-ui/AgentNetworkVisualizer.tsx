/**
 * Agent Network Visualizer (AG-UI Version)
 *
 * Real-time network visualization using AG-UI streaming events
 */

import React from 'react';
import { useRelayEvents } from '../../hooks/ag-ui/useRelayEvents';

export function AgentNetworkVisualizer() {
  const { state, connected } = useRelayEvents();
  const { agents, network } = state;

  if (!connected) {
    return (
      <div className="relative bg-gradient-to-br from-gray-900/50 to-gray-800/30 rounded-xl border border-gray-800 p-8">
        <div className="text-center text-gray-400">
          <div className="text-2xl mb-2">🔌</div>
          <div>Connecting to AG-UI runtime...</div>
        </div>
      </div>
    );
  }

  if (agents.length === 0) {
    return (
      <div className="relative bg-gradient-to-br from-gray-900/50 to-gray-800/30 rounded-xl border border-gray-800 p-8">
        <div className="text-center text-gray-400">
          <div className="text-4xl mb-4">🌐</div>
          <div className="text-lg font-semibold mb-2">Network Ready</div>
          <div className="text-sm">No agents connected yet. Register your first agent to see the network.</div>
        </div>
      </div>
    );
  }

  const displayedAgents = agents.slice(0, 8);
  const additionalCount = Math.max(0, agents.length - 8);

  return (
    <div className="relative bg-gradient-to-br from-gray-900/50 to-gray-800/30 rounded-xl border border-gray-800 p-8">
      {/* Header with live indicator */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            <span className="text-sm text-green-400 font-medium">LIVE</span>
          </div>
          <span className="text-gray-500">|</span>
          <span className="text-sm text-gray-400">
            {network.totalAgents} {network.totalAgents === 1 ? 'agent' : 'agents'} online
          </span>
        </div>
        <div className="text-xs text-gray-500">Health: {network.health}</div>
      </div>

      {/* Network Visualization */}
      <svg
        viewBox="0 0 400 400"
        className="w-full h-auto"
        style={{ maxHeight: '400px' }}
      >
        {/* Connection lines */}
        {displayedAgents.map((agent, index) => {
          const angle = (index / displayedAgents.length) * 2 * Math.PI - Math.PI / 2;
          const x = 200 + Math.cos(angle) * 120;
          const y = 200 + Math.sin(angle) * 120;

          return (
            <line
              key={`line-${agent.agentId}`}
              x1="200"
              y1="200"
              x2={x}
              y2={y}
              stroke="url(#gradient)"
              strokeWidth="2"
              opacity="0.4"
              className="transition-all duration-500"
            />
          );
        })}

        {/* Gradient definition */}
        <defs>
          <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#a8ff78" />
            <stop offset="100%" stopColor="#78ffd6" />
          </linearGradient>
        </defs>

        {/* Central hub */}
        <g>
          <circle
            cx="200"
            cy="200"
            r="30"
            fill="url(#gradient)"
            opacity="0.2"
            className="animate-pulse"
          />
          <circle cx="200" cy="200" r="20" fill="url(#gradient)" opacity="0.3" />
          <circle cx="200" cy="200" r="12" fill="url(#gradient)" />
          <text
            x="200"
            y="205"
            textAnchor="middle"
            fill="black"
            fontSize="12"
            fontWeight="bold"
          >
            HUB
          </text>
        </g>

        {/* Agent nodes */}
        {displayedAgents.map((agent, index) => {
          const angle = (index / displayedAgents.length) * 2 * Math.PI - Math.PI / 2;
          const x = 200 + Math.cos(angle) * 120;
          const y = 200 + Math.sin(angle) * 120;
          const isOnline = agent.status === 'online';

          return (
            <g
              key={agent.agentId}
              className="transition-all duration-500 cursor-pointer hover:opacity-80"
            >
              {/* Agent circle */}
              <circle
                cx={x}
                cy={y}
                r="16"
                fill={isOnline ? '#10b981' : '#ef4444'}
                stroke="white"
                strokeWidth="2"
              />

              {/* Agent label */}
              <text
                x={x}
                y={y + 32}
                textAnchor="middle"
                fill="#9ca3af"
                fontSize="10"
                className="pointer-events-none"
              >
                {agent.name.length > 10 ? `${agent.name.substring(0, 10)}...` : agent.name}
              </text>

              {/* Tooltip on hover (SVG title) */}
              <title>
                {agent.name} - {isOnline ? 'Online' : 'Offline'}
                {'\n'}Capabilities: {agent.capabilities.join(', ')}
                {'\n'}Endpoint: {agent.endpoint}
              </title>
            </g>
          );
        })}

        {/* Additional agents indicator */}
        {additionalCount > 0 && (
          <g>
            <circle cx="350" cy="50" r="20" fill="#374151" stroke="#4b5563" strokeWidth="2" />
            <text
              x="350"
              y="55"
              textAnchor="middle"
              fill="#9ca3af"
              fontSize="12"
              fontWeight="bold"
            >
              +{additionalCount}
            </text>
          </g>
        )}
      </svg>

      {/* Legend */}
      <div className="mt-6 flex items-center justify-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-500"></div>
          <span className="text-gray-400">Online</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500"></div>
          <span className="text-gray-400">Offline</span>
        </div>
      </div>
    </div>
  );
}

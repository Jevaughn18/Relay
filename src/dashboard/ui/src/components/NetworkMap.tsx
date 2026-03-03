interface NetworkMapProps {
  agents: any[];
}

export default function NetworkMap({ agents }: NetworkMapProps) {
  if (agents.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <div className="text-4xl mb-2">🗺️</div>
        <div>No agents discovered yet</div>
        <div className="text-sm mt-1">Agents will appear here when they connect</div>
      </div>
    );
  }

  return (
    <div className="relative bg-gray-900/50 rounded-lg p-8 min-h-[300px]">
      {/* Central Hub */}
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
        <div className="relative">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-600/50 animate-pulse">
            <div className="text-2xl">🔷</div>
          </div>
          <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 text-white font-semibold text-sm whitespace-nowrap">
            Relay Network
          </div>
        </div>
      </div>

      {/* Agent Nodes in Circle */}
      {agents.slice(0, 8).map((agent, index) => {
        const angle = (index / Math.min(agents.length, 8)) * 2 * Math.PI - Math.PI / 2;
        const radius = 120;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;

        return (
          <div
            key={agent.agentId}
            className="absolute top-1/2 left-1/2 transform"
            style={{
              transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
              animation: `fadeIn 0.5s ease-out ${index * 0.1}s backwards`
            }}
          >
            {/* Connection Line */}
            <svg
              className="absolute top-0 left-0 pointer-events-none"
              style={{
                width: '200px',
                height: '200px',
                transform: 'translate(-50%, -50%)'
              }}
            >
              <line
                x1="100"
                y1="100"
                x2={100 - x}
                y2={100 - y}
                stroke={agent.healthy ? '#10b981' : '#ef4444'}
                strokeWidth="2"
                strokeDasharray="4 4"
                opacity="0.3"
              />
            </svg>

            {/* Agent Node */}
            <div className="relative group">
              <div className={`w-14 h-14 rounded-full flex items-center justify-center text-xl shadow-lg ${
                agent.healthy
                  ? 'bg-green-600/20 border-2 border-green-500/50'
                  : 'bg-red-600/20 border-2 border-red-500/50'
              }`}>
                🤖
              </div>

              {/* Status Indicator */}
              <div className={`absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-gray-900 ${
                agent.healthy ? 'bg-green-500' : 'bg-red-500'
              }`} />

              {/* Tooltip */}
              <div className="absolute top-full mt-2 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 shadow-xl whitespace-nowrap">
                  <div className="text-white font-semibold text-sm">{agent.agentName}</div>
                  <div className="text-gray-400 text-xs font-mono mt-1">{agent.agentId}</div>
                  <div className="text-gray-500 text-xs mt-1">
                    {agent.manifest?.capabilities?.length || 0} capabilities
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {/* Legend */}
      <div className="absolute bottom-4 right-4 bg-gray-800/90 border border-gray-700 rounded-lg p-3 text-xs">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-2 h-2 rounded-full bg-green-500"></div>
          <span className="text-gray-300">Online</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-red-500"></div>
          <span className="text-gray-300">Offline</span>
        </div>
      </div>

      {agents.length > 8 && (
        <div className="absolute bottom-4 left-4 bg-yellow-600/20 border border-yellow-500/30 rounded-lg px-3 py-2 text-xs text-yellow-300">
          +{agents.length - 8} more agents not shown
        </div>
      )}

      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translate(calc(-50% + ${0}px), calc(-50% + ${0}px)) scale(0);
          }
          to {
            opacity: 1;
            transform: translate(calc(-50% + var(--x)), calc(-50% + var(--y))) scale(1);
          }
        }
      `}</style>
    </div>
  );
}

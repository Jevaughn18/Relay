interface AgentsTableProps {
  agents: any[];
}

export default function AgentsTable({ agents }: AgentsTableProps) {
  return (
    <div className="bg-card rounded-xl border border-line overflow-hidden">
      <div className="p-6 border-b border-line">
        <h2 className="text-xl font-bold text-text">Connected Agents</h2>
      </div>

      {agents.length === 0 ? (
        <div className="text-center py-12 text-muted">
          <div className="text-lg">No agents connected</div>
          <div className="text-sm mt-2">Agents will appear here when they join the network</div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-bg">
              <tr className="text-left">
                <th className="px-6 py-3 text-sm font-semibold text-muted">Name</th>
                <th className="px-6 py-3 text-sm font-semibold text-muted">Agent ID</th>
                <th className="px-6 py-3 text-sm font-semibold text-muted">Endpoint</th>
                <th className="px-6 py-3 text-sm font-semibold text-muted">Capabilities</th>
                <th className="px-6 py-3 text-sm font-semibold text-muted">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {agents.map((agent) => (
                <tr key={agent.agentId} className="hover-bg-bg-50 transition-colors">
                  <td className="px-6 py-4 text-text font-medium">{agent.agentName}</td>
                  <td className="px-6 py-4 text-muted font-mono text-sm">
                    {agent.agentId.slice(0, 16)}...
                  </td>
                  <td className="px-6 py-4 text-muted font-mono text-sm">{agent.endpoint}</td>
                  <td className="px-6 py-4 text-sm">
                    <div className="flex flex-wrap gap-1">
                      {agent.manifest?.capabilities?.slice(0, 3).map((cap: any, i: number) => (
                        <span
                          key={i}
                          className="px-2 py-1 bg-ok-10 text-ok rounded text-xs"
                        >
                          {cap.name}
                        </span>
                      ))}
                      {agent.manifest?.capabilities?.length > 3 && (
                        <span className="px-2 py-1 bg-line text-muted rounded text-xs">
                          +{agent.manifest.capabilities.length - 3}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                        agent.healthy
                          ? 'bg-ok-10 text-ok'
                          : 'bg-bad-10 text-bad'
                      }`}
                    >
                      <div className={`w-1-5 h-1-5 rounded-full ${agent.healthy ? 'bg-ok' : 'bg-bad'}`} />
                      {agent.healthy ? 'Online' : 'Offline'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

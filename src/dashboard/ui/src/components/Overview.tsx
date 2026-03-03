interface OverviewProps {
  stats: { totalAgents: number; onlineAgents: number; totalTasks: number };
  agents: any[];
}

export default function Overview({ stats, agents }: OverviewProps) {
  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md-grid-cols-3 gap-4">
        <div className="bg-card rounded-xl border border-line p-6">
          <div className="text-muted text-sm">Total Agents</div>
          <div className="text-4xl font-bold text-text mt-2">{stats.totalAgents}</div>
        </div>
        <div className="bg-card rounded-xl border border-line p-6">
          <div className="text-muted text-sm">Online Now</div>
          <div className="text-4xl font-bold text-ok mt-2">{stats.onlineAgents}</div>
        </div>
        <div className="bg-card rounded-xl border border-line p-6">
          <div className="text-muted text-sm">Total Tasks</div>
          <div className="text-4xl font-bold text-text mt-2">{stats.totalTasks}</div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-card rounded-xl border border-line p-6">
        <h2 className="text-xl font-bold text-text mb-4">Recent Activity</h2>
        {agents.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-muted text-lg">No agents connected yet</div>
            <div className="text-sm text-muted mt-2">
              Start an agent with <code className="bg-line px-2 py-1 rounded">quickConnect()</code>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {agents.slice(0, 5).map((agent) => (
              <div key={agent.agentId} className="flex items-center justify-between p-3 bg-bg rounded-lg">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${agent.healthy ? 'bg-ok' : 'bg-bad'}`} />
                  <div>
                    <div className="text-text font-medium">{agent.agentName}</div>
                    <div className="text-muted text-sm">{agent.endpoint}</div>
                  </div>
                </div>
                <div className="text-sm text-muted">
                  {agent.manifest?.capabilities?.slice(0, 3).map((c: any) => c.name).join(', ')}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

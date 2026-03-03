interface HeaderProps {
  activeTab: string;
  onTabChange: (tab: 'overview' | 'agents' | 'settings') => void;
  connected: boolean;
  onLogout: () => void;
}

export default function Header({ activeTab, onTabChange, connected }: HeaderProps) {
  const tabs = [
    { id: 'overview', label: '🏠 Overview' },
    { id: 'agents', label: '🤖 Agents' },
    { id: 'settings', label: '⚙️ Settings' },
  ];

  return (
    <div className="bg-card rounded-xl border border-line p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-text">Relay Dashboard</h1>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${connected ? 'bg-ok animate-pulse' : 'bg-bad'}`} />
            <span className="text-sm text-muted">
              {connected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>

        <div className="flex gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id as any)}
              className={`px-4 py-2 rounded-lg transition-colors ${
                activeTab === tab.id
                  ? 'bg-ok-20 text-ok border border-ok-30'
                  : 'bg-card-50 text-muted hover-text-text border border-line'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

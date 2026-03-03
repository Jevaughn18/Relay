import { useState } from 'react';

interface SettingsProps {
  token: string | null;
  onLogout: () => void;
}

export default function Settings({ token, onLogout }: SettingsProps) {
  const [copied, setCopied] = useState(false);

  const copyToken = () => {
    if (token) {
      navigator.clipboard.writeText(token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Authentication */}
      <div className="bg-card rounded-xl border border-line p-6">
        <h2 className="text-xl font-bold text-text mb-4">🔐 Authentication</h2>

        <div className="space-y-4">
          <div>
            <label className="text-sm text-muted block mb-2">Dashboard Token</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={token || ''}
                readOnly
                className="flex-1 bg-bg border border-line rounded-lg px-4 py-2 text-text font-mono text-sm"
              />
              <button
                onClick={copyToken}
                className="px-4 py-2 bg-ok-20 text-ok border border-ok-30 rounded-lg hover-bg-ok-30 transition-colors"
              >
                {copied ? '✓ Copied!' : 'Copy'}
              </button>
            </div>
            <p className="text-xs text-muted mt-2">
              Use this token to authenticate dashboard connections
            </p>
          </div>

          <div>
            <button
              onClick={onLogout}
              className="px-4 py-2 bg-bad-20 text-bad border border-bad-30 rounded-lg hover-bg-bad-30 transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </div>

      {/* System Info */}
      <div className="bg-card rounded-xl border border-line p-6">
        <h2 className="text-xl font-bold text-text mb-4">📡 System Info</h2>

        <div className="space-y-3">
          <div className="flex justify-between py-2 border-b border-line">
            <span className="text-muted">Registry</span>
            <span className="text-text font-mono text-sm">http://127.0.0.1:9001</span>
          </div>
          <div className="flex justify-between py-2 border-b border-line">
            <span className="text-muted">Escrow</span>
            <span className="text-text font-mono text-sm">http://127.0.0.1:9010</span>
          </div>
          <div className="flex justify-between py-2 border-b border-line">
            <span className="text-muted">Dashboard</span>
            <span className="text-text font-mono text-sm">http://127.0.0.1:8787</span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-muted">WebSocket</span>
            <span className="text-text font-mono text-sm">ws://127.0.0.1:8788</span>
          </div>
        </div>
      </div>

      {/* About */}
      <div className="bg-card rounded-xl border border-line p-6">
        <h2 className="text-xl font-bold text-text mb-4">ℹ️ About</h2>
        <div className="space-y-2 text-sm">
          <p className="text-muted">
            <span className="text-text font-semibold">Relay Protocol</span> v0.1.0
          </p>
          <p className="text-muted">
            AI Agent Marketplace - Gateway for agents to communicate and delegate tasks
          </p>
          <a
            href="https://github.com/Jevaughn18/Relay"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block text-ok hover-underline"
          >
            View on GitHub →
          </a>
        </div>
      </div>
    </div>
  );
}

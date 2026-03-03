import { useState } from 'react';

interface AuthModalProps {
  onAuth: (token: string) => void;
}

export default function AuthModal({ onAuth }: AuthModalProps) {
  const [token, setToken] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!token.trim()) {
      setError('Token is required');
      return;
    }

    onAuth(token.trim());
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="bg-card rounded-xl border border-line p-8 max-w-md w-full">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-text mb-2">Relay Dashboard</h1>
          <p className="text-muted">Enter your authentication token to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm text-muted block mb-2">Dashboard Token</label>
            <input
              type="text"
              value={token}
              onChange={(e) => {
                setToken(e.target.value);
                setError('');
              }}
              placeholder="Enter your token..."
              className="w-full bg-bg border border-line rounded-lg px-4 py-3 text-text font-mono text-sm focus-outline-none focus-border-ok"
              autoFocus
            />
            {error && <p className="text-bad text-sm mt-2">{error}</p>}
          </div>

          <button
            type="submit"
            className="w-full bg-ok-20 text-ok border border-ok-30 rounded-lg px-4 py-3 font-medium hover-bg-ok-30 transition-colors"
          >
            Connect
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-line">
          <p className="text-sm text-muted text-center">
            Get your token by running:{' '}
            <code className="bg-line px-2 py-1 rounded text-text">relay token</code>
          </p>
        </div>
      </div>
    </div>
  );
}

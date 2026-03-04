import { useState, useEffect } from 'react';
import { useWebSocket } from './hooks/useWebSocket';
import Header from './components/Header';
import EnhancedOverview from './components/EnhancedOverview';
import AgentsTable from './components/AgentsTable';
import Settings from './components/Settings';
import AuthModal from './components/AuthModal';
import { AGUIProvider } from './providers/AGUIProvider';

type Tab = 'overview' | 'agents' | 'settings';

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  const { connected, agents, stats } = useWebSocket(token, isAuthenticated);

  // Check for stored token on mount
  useEffect(() => {
    const storedToken = localStorage.getItem('relay_dashboard_token');
    if (storedToken) {
      setToken(storedToken);
      setIsAuthenticated(true);
    }
  }, []);

  const handleAuth = (authToken: string) => {
    localStorage.setItem('relay_dashboard_token', authToken);
    setToken(authToken);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('relay_dashboard_token');
    setToken(null);
    setIsAuthenticated(false);
  };

  // Show auth modal if not authenticated
  if (!isAuthenticated) {
    return <AuthModal onAuth={handleAuth} />;
  }

  return (
    <AGUIProvider enabled={true}>
      <div className="min-h-screen bg-black">
        <div className="px-8 py-6">
          <Header
            activeTab={activeTab}
            onTabChange={setActiveTab}
            connected={connected}
            onLogout={handleLogout}
          />

          <div className="mt-6">
            {activeTab === 'overview' && <EnhancedOverview stats={stats} agents={agents} />}
            {activeTab === 'agents' && <AgentsTable agents={agents} />}
            {activeTab === 'settings' && <Settings token={token} onLogout={handleLogout} />}
          </div>
        </div>
      </div>
    </AGUIProvider>
  );
}

export default App;

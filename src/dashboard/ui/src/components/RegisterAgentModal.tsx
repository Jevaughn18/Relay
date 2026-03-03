import { useState } from 'react';

interface RegisterAgentModalProps {
  onClose: () => void;
}

export default function RegisterAgentModal({ onClose }: RegisterAgentModalProps) {
  const [step, setStep] = useState<'form' | 'code'>('form');
  const [formData, setFormData] = useState({
    name: '',
    capabilities: '',
    port: '8500',
  });
  const [copied, setCopied] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStep('code');
  };

  const capabilitiesArray = formData.capabilities
    .split(',')
    .map(c => c.trim())
    .filter(Boolean);

  const generatedCode = `import { quickConnect } from 'relay-protocol';

// Your agent is ready to join the network!
quickConnect({
  name: '${formData.name}',
  capabilities: [${capabilitiesArray.map(c => `'${c}'`).join(', ')}],
  port: ${formData.port},
  handler: async (task, params) => {
    // TODO: Implement your agent logic here
    console.log('Received task:', task, params);

    // Return result
    return {
      success: true,
      result: 'Task completed!'
    };
  }
});

console.log('✅ ${formData.name} is now discoverable on Relay!');`;

  const copyCode = () => {
    navigator.clipboard.writeText(generatedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-2xl border border-gray-700 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-gray-900 border-b border-gray-700 p-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <span>✨</span> Register New Agent
            </h2>
            <p className="text-gray-400 text-sm mt-1">
              {step === 'form' ? 'Fill in your agent details' : 'Copy and run this code'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {step === 'form' ? (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Agent Name */}
              <div>
                <label className="block text-white font-semibold mb-2">
                  Agent Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., WebSearchAgent, EmailBot, FlightFinder"
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
                  required
                />
                <p className="text-gray-500 text-sm mt-1">
                  Give your agent a descriptive name
                </p>
              </div>

              {/* Capabilities */}
              <div>
                <label className="block text-white font-semibold mb-2">
                  Capabilities <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.capabilities}
                  onChange={(e) => setFormData({ ...formData, capabilities: e.target.value })}
                  placeholder="web_search, send_email, book_flight"
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
                  required
                />
                <p className="text-gray-500 text-sm mt-1">
                  Comma-separated list of what your agent can do
                </p>
              </div>

              {/* Port */}
              <div>
                <label className="block text-white font-semibold mb-2">
                  Port
                </label>
                <input
                  type="number"
                  value={formData.port}
                  onChange={(e) => setFormData({ ...formData, port: e.target.value })}
                  placeholder="8500"
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
                />
                <p className="text-gray-500 text-sm mt-1">
                  Port for your agent to listen on (default: 8500)
                </p>
              </div>

              {/* Example Capabilities */}
              <div className="bg-blue-600/10 border border-blue-500/20 rounded-lg p-4">
                <div className="text-blue-400 text-sm font-semibold mb-2">💡 Example Capabilities:</div>
                <div className="flex flex-wrap gap-2">
                  {['web_search', 'send_email', 'book_flight', 'translate', 'summarize', 'code_review'].map(cap => (
                    <button
                      key={cap}
                      type="button"
                      onClick={() => {
                        const current = formData.capabilities ? formData.capabilities + ', ' : '';
                        setFormData({ ...formData, capabilities: current + cap });
                      }}
                      className="px-3 py-1 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 rounded text-blue-300 text-sm transition-colors"
                    >
                      {cap}
                    </button>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg transition-colors shadow-lg shadow-blue-600/50"
                  disabled={!formData.name || !formData.capabilities}
                >
                  Generate Code →
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-6">
              {/* Success Message */}
              <div className="bg-green-600/10 border border-green-500/20 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <div className="text-3xl">✅</div>
                  <div>
                    <div className="text-green-400 font-semibold">Agent Configuration Ready!</div>
                    <div className="text-green-300 text-sm">Copy this code and run it to register your agent</div>
                  </div>
                </div>
              </div>

              {/* Generated Code */}
              <div className="relative">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-white font-semibold">Generated Code</div>
                  <button
                    onClick={copyCode}
                    className="flex items-center gap-2 px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded transition-colors"
                  >
                    {copied ? (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Copied!
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        Copy
                      </>
                    )}
                  </button>
                </div>
                <pre className="bg-gray-950 border border-gray-700 rounded-lg p-4 overflow-x-auto">
                  <code className="text-green-400 text-sm">{generatedCode}</code>
                </pre>
              </div>

              {/* Next Steps */}
              <div className="bg-gray-800 rounded-lg p-4">
                <div className="text-white font-semibold mb-3">📋 Next Steps:</div>
                <ol className="space-y-2 text-gray-300 text-sm">
                  <li className="flex items-start gap-2">
                    <span className="text-blue-400 font-bold">1.</span>
                    <span>Copy the code above</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-400 font-bold">2.</span>
                    <span>Create a new file: <code className="bg-gray-700 px-2 py-1 rounded text-xs">agent.ts</code></span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-400 font-bold">3.</span>
                    <span>Run: <code className="bg-gray-700 px-2 py-1 rounded text-xs">npx ts-node agent.ts</code></span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-400 font-bold">4.</span>
                    <span>Your agent will appear in this dashboard automatically! 🎉</span>
                  </li>
                </ol>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={() => setStep('form')}
                  className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg transition-colors"
                >
                  ← Back
                </button>
                <button
                  onClick={onClose}
                  className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

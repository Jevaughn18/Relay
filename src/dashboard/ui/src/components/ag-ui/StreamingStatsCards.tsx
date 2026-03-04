/**
 * Streaming Stats Cards (AG-UI Version)
 * Clean professional design with mini charts
 */

import React from 'react';
import { useRelayEvents } from '../../hooks/ag-ui/useRelayEvents';

// Mini sparkline chart component
function MiniChart({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data, 1);
  const points = data.map((val, i) => {
    const x = (i / (data.length - 1)) * 100;
    const y = 100 - ((val / max) * 80) + 10;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg viewBox="0 0 100 100" className="w-full h-16" preserveAspectRatio="none">
      <defs>
        <linearGradient id={`gradient-${color.replace('#', '')}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="0.2" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon
        points={`0,100 ${points} 100,100`}
        fill={`url(#gradient-${color.replace('#', '')})`}
      />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function StreamingStatsCards() {
  const { state, connected } = useRelayEvents();
  const { network, agents, contracts, payments } = state;

  // Generate trend data
  const generateTrend = (value: number) => {
    return Array.from({ length: 20 }, (_, i) => {
      const base = Math.max(1, value);
      const variation = base * 0.2;
      return Math.max(0, base - variation + (Math.random() * variation * 2));
    });
  };

  const stats = [
    {
      label: 'Total Agents',
      value: network.totalAgents,
      change: '+12%',
      changePositive: true,
      chart: generateTrend(network.totalAgents || 5),
      chartColor: '#fb923c',
      topItems: agents.slice(0, 3).map(a => ({ name: a.name, value: String(a.capabilities.length) })),
    },
    {
      label: 'Active Contracts',
      value: network.activeContracts,
      change: '+8%',
      changePositive: true,
      chart: generateTrend(network.activeContracts || 3),
      chartColor: '#fb923c',
      topItems: contracts.slice(0, 3).map(c => ({ name: c.contractId.slice(0, 8), value: '...' })),
    },
    {
      label: 'Payments Locked',
      value: network.totalPaymentsLocked,
      change: '+24%',
      changePositive: true,
      chart: generateTrend(network.totalPaymentsLocked || 10),
      chartColor: '#fb923c',
      topItems: payments.slice(0, 3).map(p => ({ name: 'Payment', value: String(p.amount) })),
    },
    {
      label: 'Network Uptime',
      value: '99.9%',
      change: connected ? 'Live' : 'Offline',
      changePositive: connected,
      chart: generateTrend(100),
      chartColor: connected ? '#10b981' : '#ef4444',
      topItems: [
        { name: 'Last 24h', value: '100%' },
        { name: 'Last 7d', value: '99.9%' },
        { name: 'Last 30d', value: '99.8%' },
      ],
    },
  ];

  return (
    <div className="grid grid-cols-4 gap-4">
      {stats.map((stat, index) => (
        <div
          key={index}
          className="bg-[#0a0a0a] border border-gray-800 rounded-lg p-4 hover:border-orange-500/30 transition-colors"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-gray-500 text-[10px] font-medium uppercase tracking-wider">
              {stat.label}
            </span>
            {connected && index === 0 && (
              <div className="flex items-center gap-1">
                <div className="w-1 h-1 bg-orange-500 rounded-full animate-pulse"></div>
                <span className="text-[9px] text-orange-500 uppercase font-medium">Live</span>
              </div>
            )}
          </div>

          {/* Value and Change */}
          <div className="flex items-baseline gap-2 mb-4">
            <div className="text-2xl font-bold text-white">
              {stat.value}
            </div>
            <div className={`text-[10px] font-medium ${stat.changePositive ? 'text-green-500' : 'text-red-500'}`}>
              {stat.change}
            </div>
          </div>

          {/* Mini Chart */}
          <div className="mb-3">
            <MiniChart data={stat.chart} color={stat.chartColor} />
          </div>

          {/* Top Items */}
          {stat.topItems.length > 0 && (
            <div className="space-y-1 border-t border-gray-800 pt-3">
              <div className="text-[9px] text-gray-600 uppercase tracking-wider mb-1.5">
                Top Items
              </div>
              {stat.topItems.map((item, i) => (
                <div key={i} className="flex items-center justify-between text-[10px]">
                  <span className="text-gray-500 truncate">{item.name}</span>
                  <span className="text-gray-600 font-mono">{item.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

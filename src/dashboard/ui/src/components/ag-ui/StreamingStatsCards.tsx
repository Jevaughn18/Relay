/**
 * Streaming Stats Cards (AG-UI Version)
 *
 * Real-time statistics using AG-UI streaming events
 */

import React from 'react';
import { useRelayEvents } from '../../hooks/ag-ui/useRelayEvents';

export function StreamingStatsCards() {
  const { state, connected } = useRelayEvents();
  const { network, agents, contracts, payments } = state;

  const stats = [
    {
      label: 'Agents Connected',
      value: network.totalAgents.toString(),
      gradient: 'from-purple-600/20 to-purple-600/5',
      borderColor: 'border-purple-600/30',
      iconBg: 'bg-purple-600/20',
      icon: '🤖',
      detail: `${agents.filter(a => a.status === 'online').length} online`,
    },
    {
      label: 'Active Contracts',
      value: network.activeContracts.toString(),
      gradient: 'from-blue-600/20 to-blue-600/5',
      borderColor: 'border-blue-600/30',
      iconBg: 'bg-blue-600/20',
      icon: '📜',
      detail: `${contracts.length} total`,
    },
    {
      label: 'Payments Locked',
      value: network.totalPaymentsLocked.toString(),
      gradient: 'from-green-600/20 to-green-600/5',
      borderColor: 'border-green-600/30',
      iconBg: 'bg-green-600/20',
      icon: '💰',
      detail: `${payments.filter(p => p.status === 'locked').length} pending`,
    },
    {
      label: 'Network Health',
      value: network.health.toUpperCase(),
      gradient: network.health === 'healthy'
        ? 'from-green-600/20 to-green-600/5'
        : network.health === 'degraded'
        ? 'from-yellow-600/20 to-yellow-600/5'
        : 'from-red-600/20 to-red-600/5',
      borderColor: network.health === 'healthy'
        ? 'border-green-600/30'
        : network.health === 'degraded'
        ? 'border-yellow-600/30'
        : 'border-red-600/30',
      iconBg: network.health === 'healthy'
        ? 'bg-green-600/20'
        : network.health === 'degraded'
        ? 'bg-yellow-600/20'
        : 'bg-red-600/20',
      icon: network.health === 'healthy' ? '✓' : network.health === 'degraded' ? '⚠' : '✗',
      detail: connected ? 'Live updates' : 'Reconnecting...',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {stats.map((stat, index) => (
        <div
          key={index}
          className={`relative overflow-hidden rounded-xl border ${stat.borderColor} bg-gradient-to-br ${stat.gradient} p-6 transition-all duration-300 hover:scale-105`}
        >
          {/* Live indicator */}
          {connected && (
            <div className="absolute top-3 right-3">
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></div>
              </div>
            </div>
          )}

          {/* Icon */}
          <div className={`${stat.iconBg} w-12 h-12 rounded-lg flex items-center justify-center mb-4`}>
            <span className="text-2xl">{stat.icon}</span>
          </div>

          {/* Value */}
          <div className="text-3xl font-black mb-2 transition-all duration-500">
            {stat.value}
          </div>

          {/* Label */}
          <div className="text-sm text-gray-400 mb-1">{stat.label}</div>

          {/* Detail */}
          <div className="text-xs text-gray-500">{stat.detail}</div>

          {/* Animated background */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
        </div>
      ))}
    </div>
  );
}

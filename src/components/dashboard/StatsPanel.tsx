import React from 'react';
import { motion } from 'framer-motion';
import {
  LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { useNetworkStore } from '../../stores/networkStore';
import { formatMs } from '../../utils/helpers';

export const StatsPanel: React.FC = () => {
  const metrics = useNetworkStore(s => s.metrics);
  const metricsHistory = useNetworkStore(s => s.metricsHistory);

  // Prepare chart data (last 30 snapshots)
  const chartData = metricsHistory.slice(-30).map((snap, i) => ({
    idx: i,
    rtt: snap.metrics.avgRTT,
    loss: snap.metrics.errorRate,
    throughput: snap.metrics.throughput,
    delivery: snap.metrics.deliveryRate,
  }));

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      style={{ padding: '16px', overflowY: 'auto', maxHeight: '100%' }}
    >
      <div style={{
        fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)',
        textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '16px',
      }}>
        Network Statistics
      </div>

      {/* ─── Metric Cards Grid ─── */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr',
        gap: '8px', marginBottom: '20px',
      }}>
        <MetricCard label="Packets Sent" value={String(metrics.sent)} color="#3b82f6" />
        <MetricCard label="Delivered" value={String(metrics.delivered)} color="#10b981" />
        <MetricCard label="Lost" value={String(metrics.lost)} color="#ef4444" />
        <MetricCard label="Corrupted" value={String(metrics.corrupted)} color="#f59e0b" />
        <MetricCard label="Retransmit" value={String(metrics.retransmissions)} color="#8b5cf6" />
        <MetricCard label="Avg RTT" value={formatMs(metrics.avgRTT)} color="#06b6d4" />
        <MetricCard label="Delivery %" value={`${metrics.deliveryRate.toFixed(1)}%`} color="#10b981" />
        <MetricCard label="Error %" value={`${metrics.errorRate.toFixed(1)}%`} color="#ef4444" />
      </div>

      {/* ─── Latency Chart ─── */}
      {chartData.length > 1 && (
        <>
          <ChartSection title="Latency (RTT)">
            <ResponsiveContainer width="100%" height={100}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis hide />
                <YAxis hide />
                <Tooltip
                  contentStyle={{
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-glass)',
                    borderRadius: '8px',
                    fontSize: '11px',
                  }}
                  formatter={(v: any) => [typeof v === 'number' ? `${v.toFixed(1)} ms` : String(v), 'RTT']}
                />
                <Line
                  type="monotone" dataKey="rtt" stroke="#06b6d4"
                  strokeWidth={2} dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartSection>

          {/* ─── Error Rate Chart ─── */}
          <ChartSection title="Error Rate">
            <ResponsiveContainer width="100%" height={100}>
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis hide />
                <YAxis hide />
                <Tooltip
                  contentStyle={{
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-glass)',
                    borderRadius: '8px',
                    fontSize: '11px',
                  }}
                  formatter={(v: any) => [typeof v === 'number' ? `${v.toFixed(1)}%` : String(v), 'Error Rate']}
                />
                <Area
                  type="monotone" dataKey="loss" stroke="#ef4444"
                  fill="rgba(239,68,68,0.15)" strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </ChartSection>

          {/* ─── Throughput Chart ─── */}
          <ChartSection title="Throughput">
            <ResponsiveContainer width="100%" height={100}>
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis hide />
                <YAxis hide />
                <Tooltip
                  contentStyle={{
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-glass)',
                    borderRadius: '8px',
                    fontSize: '11px',
                  }}
                  formatter={(v: any) => [typeof v === 'number' ? `${v.toFixed(2)} Mbps` : String(v), 'Throughput']}
                />
                <Area
                  type="monotone" dataKey="throughput" stroke="#10b981"
                  fill="rgba(16,185,129,0.15)" strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </ChartSection>
        </>
      )}

      {chartData.length <= 1 && (
        <div style={{
          fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center',
          padding: '24px', background: 'var(--bg-tertiary)', borderRadius: '10px',
        }}>
          Send packets to see charts
        </div>
      )}
    </motion.div>
  );
};

const MetricCard: React.FC<{
  label: string; value: string; color: string;
}> = ({ label, value, color }) => (
  <div style={{
    background: 'var(--bg-tertiary)',
    borderRadius: '10px',
    padding: '12px',
    borderLeft: `3px solid ${color}`,
  }}>
    <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px' }}>
      {label}
    </div>
    <div style={{
      fontSize: '18px', fontWeight: 800, color,
      fontFamily: 'monospace',
    }}>
      {value}
    </div>
  </div>
);

const ChartSection: React.FC<{
  title: string; children: React.ReactNode;
}> = ({ title, children }) => (
  <div style={{ marginBottom: '16px' }}>
    <div style={{
      fontSize: '11px', color: 'var(--text-muted)',
      marginBottom: '8px', fontWeight: 500,
    }}>
      {title}
    </div>
    <div style={{
      background: 'var(--bg-tertiary)',
      borderRadius: '10px',
      padding: '8px 4px',
    }}>
      {children}
    </div>
  </div>
);

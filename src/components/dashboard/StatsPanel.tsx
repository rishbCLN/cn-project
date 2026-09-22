import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useNetworkStore } from '../../stores/networkStore';
import { formatMs } from '../../utils/helpers';
import { MiniChart } from '../ui/MiniChart';

export const StatsPanel: React.FC = () => {
  const metrics = useNetworkStore(s => s.metrics);
  const metricsHistory = useNetworkStore(s => s.metricsHistory);
  const links = useNetworkStore(s => s.links);
  const packetHistory = useNetworkStore(s => s.packetHistory);
  const simConfig = useNetworkStore(s => s.simConfig);

  // Prepare chart data series (last 30 snapshots)
  const recent = metricsHistory.slice(-30);
  const rttSeries = recent.map(s => s.metrics.avgRTT);
  const lossSeries = recent.map(s => s.metrics.errorRate);
  const throughputSeries = recent.map(s => s.metrics.throughput);
  const hasChartData = recent.length > 1;

  // ─── Real network-theory telemetry, derived from the actual topology and
  // delivered traffic (NOT hardcoded). Uses the same formulas as the engine's
  // per-hop model so the numbers here reconcile with the event log. ───
  const theory = useMemo(() => {
    const activeLinks = links.filter(l => l.status === 'active');
    const mean = (xs: number[], fb: number) =>
      xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : fb;

    const avgBwMbps = mean(activeLinks.map(l => l.bandwidth), 100);
    const avgLatMs = mean(activeLinks.map(l => l.latency), 10);
    const delivered = packetHistory.filter(p => p.status === 'delivered' && !p.isAck);
    const avgSize = mean(delivered.map(p => p.size), 512);

    const bwBps = avgBwMbps * 1_000_000;
    // T_trans = L / R
    const transMs = (avgSize * 8) / bwBps * 1000;
    // T_prop = link latency × global multiplier
    const propMs = Math.max(0.1, avgLatMs * simConfig.latencyMultiplier);
    // T_queue = congestion share of a 15 ms queue budget (engine model)
    const queueMs = (simConfig.congestion / 100) * 15;
    // BDP = R × RTT (bits); RTT approximated as 2×(T_trans+T_prop+T_queue)
    const rttSec = (2 * (transMs + propMs + queueMs)) / 1000;
    const bdpKbits = (bwBps * rttSec) / 1000;
    // Stop-and-wait channel efficiency η = T_trans / (T_trans + 2·T_prop)
    const efficiency = (transMs / (transMs + 2 * propMs)) * 100;

    return {
      avgBwMbps, avgLatMs, avgSize,
      transMs, propMs, queueMs, bdpKbits, efficiency,
      sampled: delivered.length,
    };
  }, [links, packetHistory, simConfig.latencyMultiplier, simConfig.congestion]);

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
        gap: '8px', marginBottom: '16px',
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

      {/* ─── Live Telemetry Formulas & Calculated Proofs ─── */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{
          fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)',
          textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px',
        }}>
          Live Network Theory Telemetry
        </div>
        {/* Basis line — makes clear these are derived from real state */}
        <div style={{
          fontSize: '9.5px', color: 'var(--text-muted)', fontFamily: 'monospace',
          marginBottom: '8px', lineHeight: 1.5,
        }}>
          Basis: avg link {theory.avgBwMbps.toFixed(0)} Mbps · {theory.avgLatMs.toFixed(0)} ms · avg packet{' '}
          {theory.avgSize.toFixed(0)} B{theory.sampled > 0 ? ` · ${theory.sampled} delivered` : ' (defaults)'}
        </div>
        <div style={{
          background: 'rgba(10, 14, 26, 0.95)',
          border: '1px solid var(--border-glass)',
          borderRadius: '10px',
          padding: '12px',
          fontSize: '11px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}>
          <FormulaRow
            name="Transmission Delay (T_trans)"
            formula="L / R (Packet Size / Bandwidth)"
            value={`${theory.transMs.toFixed(3)} ms`}
            color="#3b82f6"
          />
          <FormulaRow
            name="Propagation Delay (T_prop)"
            formula="Latency × multiplier"
            value={formatMs(theory.propMs)}
            color="#f59e0b"
          />
          <FormulaRow
            name="Queueing Delay (T_queue)"
            formula="(Congestion %) × 15 ms budget"
            value={formatMs(theory.queueMs)}
            color="#8b5cf6"
          />
          <FormulaRow
            name="Bandwidth-Delay Product (BDP)"
            formula="Bandwidth × RTT"
            value={`${theory.bdpKbits.toFixed(2)} Kbits`}
            color="#06b6d4"
          />
          <FormulaRow
            name="Channel Efficiency (η)"
            formula="T_trans / (T_trans + 2·T_prop)"
            value={`${theory.efficiency.toFixed(2)}%`}
            color="#10b981"
          />
        </div>
      </div>

      {/* ─── Latency Chart ─── */}
      {hasChartData && (
        <>
          <ChartSection title="Latency (RTT)">
            <MiniChart
              data={rttSeries}
              color="#06b6d4"
              variant="line"
              format={(v) => `${v.toFixed(1)} ms`}
            />
          </ChartSection>

          {/* ─── Error Rate Chart ─── */}
          <ChartSection title="Error Rate">
            <MiniChart
              data={lossSeries}
              color="#ef4444"
              variant="area"
              min={0}
              format={(v) => `${v.toFixed(1)}%`}
            />
          </ChartSection>

          {/* ─── Throughput Chart ─── */}
          <ChartSection title="Throughput">
            <MiniChart
              data={throughputSeries}
              color="#10b981"
              variant="area"
              min={0}
              format={(v) => `${v.toFixed(2)} Mbps`}
            />
          </ChartSection>
        </>
      )}

      {!hasChartData && (
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

const FormulaRow: React.FC<{
  name: string; formula: string; value: string; color: string;
}> = ({ name, formula, value, color }) => (
  <div style={{
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '6px 8px', borderRadius: '6px',
    background: 'rgba(255,255,255,0.02)',
    borderLeft: `2.5px solid ${color}`,
  }}>
    <div>
      <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-primary)' }}>
        {name}
      </div>
      <div style={{ fontSize: '9px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
        {formula}
      </div>
    </div>
    <div style={{
      fontSize: '12px', fontWeight: 700, color,
      fontFamily: 'monospace',
    }}>
      {value}
    </div>
  </div>
);

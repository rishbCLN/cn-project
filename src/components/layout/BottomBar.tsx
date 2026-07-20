import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useNetworkStore } from '../../stores/networkStore';
import { useUIStore } from '../../stores/uiStore';
import { formatMs } from '../../utils/helpers';

export const BottomBar: React.FC = () => {
  const simState = useNetworkStore(s => s.simState);
  const simConfig = useNetworkStore(s => s.simConfig);
  const metrics = useNetworkStore(s => s.metrics);
  const activePackets = useNetworkStore(s => s.activePackets);
  const startSim = useNetworkStore(s => s.startSim);
  const pauseSim = useNetworkStore(s => s.pauseSim);
  const stopSim = useNetworkStore(s => s.stopSim);
  const resetSim = useNetworkStore(s => s.resetSim);
  const setSpeed = useNetworkStore(s => s.setSpeed);
  const pushNotification = useUIStore(s => s.pushNotification);

  const intervalRef = useRef<number | null>(null);

  // Auto-advance packets when simulation is running
  useEffect(() => {
    if (simState !== 'running') {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Base demo speed: 2500ms per step (with speed multipliers: 0.5x, 1x, 2x, 4x)
    const delay = 2500 / simConfig.speed;
    intervalRef.current = window.setInterval(() => {
      const state = useNetworkStore.getState();
      const packets = state.activePackets;

      if (packets.length === 0) {
        if (state.lastPacketConfig) {
          state.sendPacket(
            state.lastPacketConfig.srcId,
            state.lastPacketConfig.dstId,
            state.lastPacketConfig.protocol,
            state.lastPacketConfig.size
          );
        } else {
          state.pauseSim();
        }
        return;
      }

      // Advance active packets sequentially with slight stagger for demo clarity
      packets.forEach((p, index) => {
        if (p.status === 'in-transit' || p.status === 'created') {
          setTimeout(() => {
            const currentState = useNetworkStore.getState();
            if (currentState.simState === 'running') {
              currentState.advancePacket(p.id);

              // Push notifications for important events
              const latestEvents = useNetworkStore.getState().events;
              const last = latestEvents[latestEvents.length - 1];
              if (last && (
                last.type === 'packet_dropped' ||
                last.type === 'packet_corrupted' ||
                last.type === 'crc_fail' ||
                last.type === 'packet_delivered' ||
                last.type === 'retransmission'
              )) {
                pushNotification(last.description, last.type);
              }
            }
          }, index * 250); // 250ms stagger per concurrent packet
        }
      });
    }, delay);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [simState, simConfig.speed]);

  const handleStep = () => {
    const { activePackets: packets, advancePacket } = useNetworkStore.getState();
    for (const p of packets) {
      if (p.status === 'in-transit' || p.status === 'created') {
        advancePacket(p.id);
        break; // Only advance one packet per step
      }
    }
  };

  const speeds = [0.5, 1, 2, 4];

  return (
    <div style={{
      height: '44px',
      background: 'var(--bg-secondary)',
      borderTop: '1px solid var(--border-glass)',
      display: 'flex',
      alignItems: 'center',
      padding: '0 16px',
      gap: '12px',
      fontSize: '12px',
    }}>
      {/* ─── Playback Controls ─── */}
      <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
        {simState === 'running' ? (
          <ControlBtn icon="⏸" label="Pause" onClick={pauseSim} />
        ) : (
          <ControlBtn icon="▶" label="Play" onClick={startSim} accent />
        )}
        <ControlBtn icon="⏹" label="Stop" onClick={stopSim} />
        <ControlBtn icon="⏭" label="Step" onClick={handleStep} />
        <ControlBtn icon="↺" label="Reset" onClick={resetSim} />
      </div>

      {/* ─── Speed Selector ─── */}
      <div style={{
        display: 'flex', gap: '2px', alignItems: 'center',
        background: 'var(--bg-tertiary)', borderRadius: '8px', padding: '2px',
      }}>
        {speeds.map(s => (
          <motion.button
            key={s}
            onClick={() => setSpeed(s)}
            whileTap={{ scale: 0.9 }}
            style={{
              padding: '3px 8px',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: 600,
              fontFamily: 'monospace',
              cursor: 'pointer',
              border: 'none',
              background: simConfig.speed === s ? 'var(--accent-cyan)' : 'transparent',
              color: simConfig.speed === s ? 'white' : 'var(--text-muted)',
              transition: 'all 0.2s',
            }}
          >
            ×{s}
          </motion.button>
        ))}
      </div>

      {/* ─── Divider ─── */}
      <div style={{ width: '1px', height: '20px', background: 'var(--border-glass)' }} />

      {/* ─── Status Indicator ─── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '6px',
        color: simState === 'running' ? '#10b981' : 'var(--text-muted)',
      }}>
        <div style={{
          width: '6px', height: '6px', borderRadius: '50%',
          background: simState === 'running' ? '#10b981' : simState === 'paused' ? '#f59e0b' : '#64748b',
          boxShadow: simState === 'running' ? '0 0 8px #10b981' : 'none',
          animation: simState === 'running' ? 'pulse-glow 1.5s infinite' : 'none',
        }} />
        <span style={{ fontWeight: 500, textTransform: 'uppercase', fontSize: '10px', letterSpacing: '0.05em' }}>
          {simState}
        </span>
      </div>

      <div style={{ width: '1px', height: '20px', background: 'var(--border-glass)' }} />

      {/* ─── Quick Stats ─── */}
      <div style={{ display: 'flex', gap: '16px', color: 'var(--text-secondary)', flex: 1 }}>
        <QuickStat label="Sent" value={String(metrics.sent)} color="#3b82f6" />
        <QuickStat label="Delivered" value={String(metrics.delivered)} color="#10b981" />
        <QuickStat label="Lost" value={String(metrics.lost)} color="#ef4444" />
        <QuickStat label="RTT" value={formatMs(metrics.avgRTT)} color="#f59e0b" />
        <QuickStat label="Delivery" value={`${metrics.deliveryRate.toFixed(0)}%`} color="#06b6d4" />
        <QuickStat label="Active" value={String(activePackets.length)} color="#8b5cf6" />
      </div>
    </div>
  );
};

const ControlBtn: React.FC<{
  icon: string; label: string; onClick: () => void; accent?: boolean;
}> = ({ icon, label, onClick, accent }) => (
  <motion.button
    onClick={onClick}
    whileHover={{ scale: 1.1 }}
    whileTap={{ scale: 0.9 }}
    title={label}
    style={{
      width: '30px', height: '30px',
      borderRadius: '8px',
      border: 'none',
      background: accent ? 'var(--accent-cyan)' : 'var(--bg-tertiary)',
      color: accent ? 'white' : 'var(--text-secondary)',
      fontSize: '14px',
      cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      transition: 'background 0.2s',
    }}
  >
    {icon}
  </motion.button>
);

const QuickStat: React.FC<{
  label: string; value: string; color: string;
}> = ({ label, value, color }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{label}</span>
    <span style={{ fontSize: '12px', fontWeight: 700, color, fontFamily: 'monospace' }}>{value}</span>
  </div>
);

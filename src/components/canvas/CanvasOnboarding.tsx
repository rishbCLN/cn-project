import React from 'react';
import { motion } from 'framer-motion';
import { useNetworkStore, PresetKey } from '../../stores/networkStore';
import { DeviceType } from '../../types';
import { DEVICE_COLORS } from '../../utils/colors';

/**
 * CanvasOnboarding — a welcoming empty-state shown when the canvas has no
 * devices. Gives first-time users a clear, low-friction path to their first
 * simulation: drop a starter device, or load a guided preset scenario.
 */

const STARTERS: { type: DeviceType; label: string; icon: string }[] = [
  { type: 'router', label: 'Router', icon: '⬡' },
  { type: 'switch', label: 'Switch', icon: '⬢' },
  { type: 'server', label: 'Server', icon: '▣' },
  { type: 'pc', label: 'PC', icon: '▢' },
];

const QUICK_PRESETS: { key: PresetKey; label: string; blurb: string }[] = [
  { key: 'mesh_routing', label: 'Dijkstra Multi-Hop', blurb: 'Watch shortest-path routing pick the cheapest route' },
  { key: 'retransmission', label: 'TCP Retransmission', blurb: 'See loss, CRC failure & automatic recovery' },
  { key: 'congestion', label: 'Bottleneck & Queueing', blurb: 'Fill a router buffer until packets tail-drop' },
];

export const CanvasOnboarding: React.FC = () => {
  const addDevice = useNetworkStore(s => s.addDevice);
  const loadPresetScenario = useNetworkStore(s => s.loadPresetScenario);

  const seedDevice = (type: DeviceType) => {
    // Drop near the center-left so there's room to grow rightward.
    addDevice(type, { x: 240 + Math.random() * 80, y: 200 + Math.random() * 80 });
  };

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
        zIndex: 4,
        padding: '24px',
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', damping: 24, stiffness: 260 }}
        style={{
          pointerEvents: 'auto',
          maxWidth: '560px',
          width: '100%',
          background: 'rgba(13, 18, 32, 0.86)',
          backdropFilter: 'blur(18px)',
          border: '1px solid rgba(255, 255, 255, 0.09)',
          borderRadius: '20px',
          padding: '30px 32px',
          boxShadow: '0 24px 70px rgba(0, 0, 0, 0.55), 0 0 40px rgba(6, 182, 212, 0.08)',
          textAlign: 'center',
        }}
      >
        {/* Brand mark */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.05 }}
          style={{
            width: '52px',
            height: '52px',
            borderRadius: '15px',
            background: 'linear-gradient(135deg, #06b6d4, #3b82f6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
            fontSize: '26px',
            fontWeight: 900,
            color: 'white',
            boxShadow: '0 8px 28px rgba(6, 182, 212, 0.4)',
          }}
        >
          P
        </motion.div>

        <div style={{ fontSize: '21px', fontWeight: 800, color: '#f8fafc', letterSpacing: '-0.02em', marginBottom: '6px' }}>
          Welcome to PacketFlow Studio
        </div>
        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.55, marginBottom: '24px' }}>
          Build a network, connect the nodes, and send packets to watch routing,
          congestion, and error recovery play out hop-by-hop.
        </div>

        {/* Add a starter device */}
        <div style={{
          fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)',
          textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '10px',
        }}>
          Start by adding a device
        </div>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginBottom: '24px' }}>
          {STARTERS.map(s => (
            <motion.button
              key={s.type}
              onClick={() => seedDevice(s.type)}
              whileHover={{ scale: 1.06, y: -2 }}
              whileTap={{ scale: 0.96 }}
              style={{
                flex: 1,
                maxWidth: '104px',
                background: 'var(--bg-tertiary)',
                border: `1px solid ${DEVICE_COLORS[s.type]}44`,
                borderRadius: '12px',
                padding: '14px 8px',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <span style={{ fontSize: '24px', color: DEVICE_COLORS[s.type] }}>{s.icon}</span>
              <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)', fontWeight: 600 }}>{s.label}</span>
            </motion.button>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '0 0 18px' }}>
          <div style={{ flex: 1, height: '1px', background: 'var(--border-glass)' }} />
          <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600 }}>OR TRY A GUIDED SCENARIO</span>
          <div style={{ flex: 1, height: '1px', background: 'var(--border-glass)' }} />
        </div>

        {/* Quick presets */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {QUICK_PRESETS.map(p => (
            <motion.button
              key={p.key}
              onClick={() => loadPresetScenario(p.key)}
              whileHover={{ scale: 1.02, x: 2 }}
              whileTap={{ scale: 0.98 }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                background: 'rgba(16, 185, 129, 0.08)',
                border: '1px solid rgba(16, 185, 129, 0.25)',
                borderRadius: '10px',
                padding: '11px 14px',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#34d399' }}>{p.label}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '1px' }}>{p.blurb}</div>
              </div>
              <span style={{ fontSize: '15px', color: '#34d399', flexShrink: 0 }}>→</span>
            </motion.button>
          ))}
        </div>

        <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginTop: '20px', display: 'flex', gap: '14px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <span>Drag from the left palette onto the canvas</span>
          <span style={{ opacity: 0.4 }}>•</span>
          <span>Press <kbd style={kbd}>?</kbd> for keyboard shortcuts</span>
        </div>
      </motion.div>
    </div>
  );
};

const kbd: React.CSSProperties = {
  background: 'rgba(255,255,255,0.08)',
  border: '1px solid rgba(255,255,255,0.15)',
  borderRadius: '4px',
  padding: '0 5px',
  fontFamily: 'monospace',
  fontSize: '10px',
  color: 'var(--text-secondary)',
};

import React from 'react';
import { motion } from 'framer-motion';
import { useNetworkStore } from '../../stores/networkStore';
import { DeviceType } from '../../types';
import { DEVICE_COLORS } from '../../utils/colors';

import { PresetInfoCard } from '../dashboard/PresetInfoCard';

const DEVICE_LIST: { type: DeviceType; label: string; icon: string }[] = [
  { type: 'router', label: 'Router', icon: '⬡' },
  { type: 'switch', label: 'Switch', icon: '⬢' },
  { type: 'server', label: 'Server', icon: '▣' },
  { type: 'pc', label: 'PC', icon: '▢' },
];

/**
 * Real-world link-condition profiles — one click sets loss/latency/jitter/
 * congestion/corruption to model a representative link. Inspired by netem
 * traffic-control profiles and tools like NetHang (3G/4G/Wi-Fi/Starlink).
 * Values are the tunable SimConfig fields only (topology is untouched).
 */
type ConditionProfile = Pick<
  ReturnType<typeof useNetworkStore.getState>['simConfig'],
  'packetLoss' | 'latencyMultiplier' | 'jitter' | 'corruptionRate' | 'congestion'
>;

const CONDITION_PROFILES: { key: string; label: string; icon: string; color: string; desc: string; config: ConditionProfile }[] = [
  { key: 'fiber', label: 'Fiber', icon: '🟢', color: '#10b981', desc: 'Pristine low-latency link',
    config: { packetLoss: 0, latencyMultiplier: 0.5, jitter: 1, corruptionRate: 0, congestion: 5 } },
  { key: 'broadband', label: 'Broadband', icon: '🔵', color: '#06b6d4', desc: 'Typical home cable/DSL',
    config: { packetLoss: 1, latencyMultiplier: 1, jitter: 8, corruptionRate: 0.5, congestion: 20 } },
  { key: '4g', label: '4G LTE', icon: '📶', color: '#f59e0b', desc: 'Mobile — jittery, some loss',
    config: { packetLoss: 3, latencyMultiplier: 2, jitter: 30, corruptionRate: 1, congestion: 35 } },
  { key: 'wifi', label: 'Public Wi-Fi', icon: '📡', color: '#a855f7', desc: 'Congested shared AP',
    config: { packetLoss: 6, latencyMultiplier: 1.5, jitter: 45, corruptionRate: 3, congestion: 65 } },
  { key: 'satellite', label: 'Satellite', icon: '🛰️', color: '#3b82f6', desc: 'High-latency GEO hop',
    config: { packetLoss: 4, latencyMultiplier: 8, jitter: 60, corruptionRate: 2, congestion: 25 } },
  { key: 'lossy', label: 'Congested', icon: '🔴', color: '#ef4444', desc: 'Overloaded, heavy loss',
    config: { packetLoss: 25, latencyMultiplier: 3, jitter: 90, corruptionRate: 12, congestion: 90 } },
];

const profileMatches = (c: ConditionProfile, p: ConditionProfile) =>
  c.packetLoss === p.packetLoss && c.latencyMultiplier === p.latencyMultiplier &&
  c.jitter === p.jitter && c.corruptionRate === p.corruptionRate && c.congestion === p.congestion;

export const Sidebar: React.FC = () => {
  const simConfig = useNetworkStore(s => s.simConfig);
  const setConditions = useNetworkStore(s => s.setConditions);
  const addDevice = useNetworkStore(s => s.addDevice);

  const onDragStart = (e: React.DragEvent, type: DeviceType) => {
    e.dataTransfer.setData('application/deviceType', type);
    e.dataTransfer.effectAllowed = 'move';
  };

  const onClickAdd = (type: DeviceType) => {
    // Add at a randomized position so devices don't stack
    const x = 200 + Math.random() * 400;
    const y = 100 + Math.random() * 300;
    addDevice(type, { x, y });
  };

  return (
    <div style={{
      width: '220px',
      background: 'var(--bg-secondary)',
      borderRight: '1px solid var(--border-glass)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* ─── Device Palette ─── */}
      <div style={{ padding: '16px', borderBottom: '1px solid var(--border-glass)' }}>
        <div style={{
          fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)',
          textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px',
        }}>
          Devices
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          {DEVICE_LIST.map(item => (
            <motion.div
              key={item.type}
              draggable
              onDragStart={(e) => onDragStart(e as unknown as React.DragEvent, item.type)}
              onClick={() => onClickAdd(item.type)}
              whileHover={{ scale: 1.05, borderColor: DEVICE_COLORS[item.type] }}
              whileTap={{ scale: 0.95 }}
              style={{
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-glass)',
                borderRadius: '10px',
                padding: '12px 8px',
                textAlign: 'center',
                cursor: 'grab',
                transition: 'border-color 0.2s',
              }}
            >
              <div style={{
                fontSize: '22px',
                color: DEVICE_COLORS[item.type],
                marginBottom: '4px',
              }}>
                {item.icon}
              </div>
              <div style={{
                fontSize: '11px',
                color: 'var(--text-secondary)',
                fontWeight: 500,
              }}>
                {item.label}
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* ─── Network Conditions ─── */}
      <div style={{ padding: '16px', flex: 1, overflowY: 'auto' }}>
        <div style={{
          fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)',
          textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '16px',
        }}>
          Network Conditions
        </div>

        <div style={{ marginBottom: '16px' }}>
          <PresetInfoCard compact />
        </div>

        {/* ─── Link Condition Profiles ─── */}
        <div style={{ marginBottom: '18px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
            Link Profile
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
            {CONDITION_PROFILES.map(p => {
              const active = profileMatches(
                {
                  packetLoss: simConfig.packetLoss,
                  latencyMultiplier: simConfig.latencyMultiplier,
                  jitter: simConfig.jitter,
                  corruptionRate: simConfig.corruptionRate,
                  congestion: simConfig.congestion,
                },
                p.config
              );
              return (
                <motion.button
                  key={p.key}
                  onClick={() => setConditions(p.config)}
                  whileTap={{ scale: 0.95 }}
                  title={p.desc}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '7px 8px',
                    borderRadius: '8px',
                    border: `1.5px solid ${active ? p.color : 'var(--border-glass)'}`,
                    background: active ? `${p.color}1e` : 'var(--bg-tertiary)',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    textAlign: 'left',
                  }}
                >
                  <span style={{ fontSize: '13px', lineHeight: 1 }}>{p.icon}</span>
                  <span style={{
                    fontSize: '10.5px', fontWeight: 700,
                    color: active ? p.color : 'var(--text-secondary)',
                  }}>
                    {p.label}
                  </span>
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* ─── Routing Algorithm Toggle ─── */}
        <div style={{ marginBottom: '18px' }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginBottom: '8px',
          }}>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Routing Algorithm</span>
          </div>
          <div style={{
            display: 'flex', gap: '4px',
            background: 'var(--bg-tertiary)', borderRadius: '10px', padding: '3px',
          }}>
            {([
              { value: 'dijkstra' as const, label: 'Dijkstra', color: '#06b6d4', desc: 'OSPF' },
              { value: 'bellman-ford' as const, label: 'Bellman-Ford', color: '#f59e0b', desc: 'RIP' },
            ]).map(algo => {
              const isActive = simConfig.routingAlgorithm === algo.value;
              return (
                <motion.button
                  key={algo.value}
                  onClick={() => setConditions({ routingAlgorithm: algo.value })}
                  whileTap={{ scale: 0.95 }}
                  style={{
                    flex: 1,
                    padding: '8px 6px',
                    borderRadius: '8px',
                    border: 'none',
                    background: isActive
                      ? `${algo.color}22`
                      : 'transparent',
                    cursor: 'pointer',
                    transition: 'all 0.25s ease',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '2px',
                    boxShadow: isActive
                      ? `inset 0 0 0 1.5px ${algo.color}, 0 0 12px ${algo.color}33`
                      : 'none',
                  }}
                >
                  <span style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color: isActive ? algo.color : 'var(--text-muted)',
                    transition: 'color 0.2s',
                  }}>
                    {algo.label}
                  </span>
                  <span style={{
                    fontSize: '9px',
                    fontWeight: 500,
                    color: isActive ? algo.color : 'var(--text-muted)',
                    opacity: isActive ? 0.7 : 0.5,
                    fontFamily: 'monospace',
                    transition: 'all 0.2s',
                  }}>
                    {algo.desc}
                  </span>
                </motion.button>
              );
            })}
          </div>
        </div>

        <ConditionSlider
          label="Congestion"
          value={simConfig.congestion}
          unit="%"
          max={100}
          color="#f97316"
          onChange={(v) => setConditions({ congestion: v })}
        />
        <ConditionSlider
          label="Packet Loss"
          value={simConfig.packetLoss}
          unit="%"
          max={100}
          color="#ef4444"
          onChange={(v) => setConditions({ packetLoss: v })}
        />
        <ConditionSlider
          label="Latency ×"
          value={simConfig.latencyMultiplier}
          unit="×"
          max={10}
          step={0.5}
          color="#f59e0b"
          onChange={(v) => setConditions({ latencyMultiplier: v })}
        />
        <ConditionSlider
          label="Jitter"
          value={simConfig.jitter}
          unit="ms"
          max={200}
          color="#8b5cf6"
          onChange={(v) => setConditions({ jitter: v })}
        />
        <ConditionSlider
          label="Corruption"
          value={simConfig.corruptionRate}
          unit="%"
          max={100}
          color="#ec4899"
          onChange={(v) => setConditions({ corruptionRate: v })}
        />
      </div>
    </div>
  );
};

/* ─── Slider Sub-Component ─── */
const ConditionSlider: React.FC<{
  label: string;
  value: number;
  unit: string;
  max: number;
  step?: number;
  color: string;
  onChange: (value: number) => void;
}> = ({ label, value, unit, max, step = 1, color, onChange }) => (
  <div style={{ marginBottom: '18px' }}>
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      marginBottom: '6px',
    }}>
      <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{label}</span>
      <span style={{
        fontSize: '12px', fontWeight: 600, color,
        fontFamily: 'monospace',
      }}>
        {value}{unit}
      </span>
    </div>
    <input
      type="range"
      min={0}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      style={{
        accentColor: color,
      }}
    />
  </div>
);

import React from 'react';
import { motion } from 'framer-motion';
import { useNetworkStore } from '../../stores/networkStore';
import { useUIStore } from '../../stores/uiStore';
import { DeviceType } from '../../types';
import { DEVICE_COLORS } from '../../utils/colors';

import { PresetInfoCard } from '../dashboard/PresetInfoCard';

const DEVICE_LIST: { type: DeviceType; label: string; icon: string }[] = [
  { type: 'router', label: 'Router', icon: '⬡' },
  { type: 'switch', label: 'Switch', icon: '⬢' },
  { type: 'server', label: 'Server', icon: '▣' },
  { type: 'pc', label: 'PC', icon: '▢' },
];

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

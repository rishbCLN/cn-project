import React from 'react';
import { motion } from 'framer-motion';
import { useNetworkStore } from '../../stores/networkStore';
import { Button } from '../ui/Button';
import { getTrafficColor } from '../../utils/colors';

export const LinkPanel: React.FC = () => {
  const selectedLinkId = useNetworkStore(s => s.selectedLinkId);
  const links = useNetworkStore(s => s.links);
  const devices = useNetworkStore(s => s.devices);
  const updateLink = useNetworkStore(s => s.updateLink);
  const removeLink = useNetworkStore(s => s.removeLink);
  const toggleLinkStatus = useNetworkStore(s => s.toggleLinkStatus);

  const link = links.find(l => l.id === selectedLinkId);
  if (!link) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
        Select a link to edit its properties
      </div>
    );
  }

  const srcDevice = devices.find(d => d.id === link.source);
  const tgtDevice = devices.find(d => d.id === link.target);

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      style={{ padding: '16px' }}
    >
      <div style={{
        fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)',
        textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '16px',
      }}>
        Link Properties
      </div>

      <div style={{
        background: 'var(--bg-tertiary)', borderRadius: '10px', padding: '12px',
        marginBottom: '16px', fontSize: '12px', color: 'var(--text-secondary)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
      }}>
        <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
          {srcDevice?.label ?? '?'}
        </span>
        <span>↔</span>
        <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
          {tgtDevice?.label ?? '?'}
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <SliderField
          label="Bandwidth"
          value={link.bandwidth}
          unit="Mbps"
          min={1}
          max={1000}
          onChange={(v) => updateLink(link.id, { bandwidth: v })}
        />

        <SliderField
          label="Latency"
          value={link.latency}
          unit="ms"
          min={1}
          max={500}
          onChange={(v) => updateLink(link.id, { latency: v })}
        />

        <SliderField
          label="Cost"
          value={link.cost}
          unit=""
          min={1}
          max={100}
          onChange={(v) => updateLink(link.id, { cost: v })}
        />

        {/* Utilization bar */}
        <div>
          <div style={{
            fontSize: '11px', color: 'var(--text-muted)',
            marginBottom: '6px', fontWeight: 500,
          }}>
            Utilization
          </div>
          <div style={{
            height: '6px', borderRadius: '3px',
            background: 'var(--bg-primary)',
            overflow: 'hidden',
          }}>
            <motion.div
              animate={{ width: `${link.utilization * 100}%` }}
              style={{
                height: '100%',
                borderRadius: '3px',
                background: getTrafficColor(link.utilization),
                transition: 'background 0.3s',
              }}
            />
          </div>
          <div style={{
            fontSize: '10px', color: getTrafficColor(link.utilization),
            fontFamily: 'monospace', marginTop: '4px', textAlign: 'right',
          }}>
            {(link.utilization * 100).toFixed(0)}%
          </div>
        </div>

        {/* Live Link Capacity & Delay Calculation */}
        <div style={{
          background: 'rgba(10, 14, 26, 0.95)',
          border: '1px solid var(--border-glass)',
          borderRadius: '10px',
          padding: '10px',
          fontSize: '10px',
          fontFamily: 'monospace',
          color: 'var(--text-secondary)',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
        }}>
          <div style={{ color: '#06b6d4', fontWeight: 700 }}>[Link Telemetry & Delay Calc]</div>
          <div>• T_trans (512B MTU): {((512 * 8) / (link.bandwidth * 1000)).toFixed(3)} ms</div>
          <div>• T_prop (Base): {link.latency} ms</div>
          <div>• BDP (Capacity): {((link.bandwidth * link.latency) / 1000).toFixed(2)} Kbits</div>
          <div>• Link Capacity: {link.bandwidth} Mbps</div>
        </div>

        <motion.button
          onClick={() => toggleLinkStatus(link.id)}
          whileTap={{ scale: 0.95 }}
          style={{
            width: '100%', padding: '8px', borderRadius: '8px',
            border: `1px solid ${link.status === 'active' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
            background: link.status === 'active' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
            color: link.status === 'active' ? '#10b981' : '#ef4444',
            fontSize: '12px', fontWeight: 600, cursor: 'pointer',
            fontFamily: 'Inter, sans-serif',
          }}
        >
          {link.status === 'active' ? '● Active — Click to Sever' : '✕ Down — Click to Restore'}
        </motion.button>

        <Button variant="danger" size="sm" fullWidth onClick={() => removeLink(link.id)}>
          Delete Link
        </Button>
      </div>
    </motion.div>
  );
};

const SliderField: React.FC<{
  label: string; value: number; unit: string;
  min: number; max: number;
  onChange: (v: number) => void;
}> = ({ label, value, unit, min, max, onChange }) => (
  <div>
    <div style={{
      display: 'flex', justifyContent: 'space-between',
      fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px',
    }}>
      <span>{label}</span>
      <span style={{ fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
        {value} {unit}
      </span>
    </div>
    <input
      type="range"
      min={min} max={max}
      value={value}
      onChange={e => onChange(parseInt(e.target.value))}
    />
  </div>
);

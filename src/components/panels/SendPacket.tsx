import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNetworkStore } from '../../stores/networkStore';
import { Button } from '../ui/Button';
import { Protocol } from '../../types';
import { PROTOCOL_COLORS, PROTOCOL_BG_COLORS } from '../../utils/colors';

const PROTOCOLS: Protocol[] = ['TCP', 'UDP', 'ICMP', 'DNS'];

export const SendPacketPanel: React.FC = () => {
  const devices = useNetworkStore(s => s.devices);
  const sendPacket = useNetworkStore(s => s.sendPacket);
  const startSim = useNetworkStore(s => s.startSim);
  const activeDevices = devices.filter(d => d.status === 'active');

  const [srcId, setSrcId] = useState('');
  const [dstId, setDstId] = useState('');
  const [protocol, setProtocol] = useState<Protocol>('TCP');
  const [size, setSize] = useState(512);

  const canSend = srcId && dstId && srcId !== dstId;

  const handleSend = () => {
    if (!canSend) return;
    sendPacket(srcId, dstId, protocol, size);
    startSim();
  };

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
        Send Packet
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {/* Source */}
        <div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>
            Source
          </div>
          <select
            value={srcId}
            onChange={e => setSrcId(e.target.value)}
          >
            <option value="">Select source…</option>
            {activeDevices.map(d => (
              <option key={d.id} value={d.id}>
                {d.label} ({d.ip})
              </option>
            ))}
          </select>
        </div>

        {/* Destination */}
        <div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>
            Destination
          </div>
          <select
            value={dstId}
            onChange={e => setDstId(e.target.value)}
          >
            <option value="">Select destination…</option>
            {activeDevices.filter(d => d.id !== srcId).map(d => (
              <option key={d.id} value={d.id}>
                {d.label} ({d.ip})
              </option>
            ))}
          </select>
        </div>

        {/* Protocol */}
        <div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px' }}>
            Protocol
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
            {PROTOCOLS.map(p => (
              <motion.button
                key={p}
                onClick={() => setProtocol(p)}
                whileTap={{ scale: 0.95 }}
                style={{
                  padding: '8px',
                  borderRadius: '8px',
                  border: `1.5px solid ${protocol === p ? PROTOCOL_COLORS[p] : 'var(--border-glass)'}`,
                  background: protocol === p ? PROTOCOL_BG_COLORS[p] : 'var(--bg-tertiary)',
                  color: protocol === p ? PROTOCOL_COLORS[p] : 'var(--text-muted)',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: 'monospace',
                  transition: 'all 0.2s',
                }}
              >
                {p}
              </motion.button>
            ))}
          </div>
        </div>

        {/* Size */}
        <div>
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px',
          }}>
            <span>Packet Size</span>
            <span style={{ fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
              {size} bytes
            </span>
          </div>
          <input
            type="range"
            min={64}
            max={9000}
            step={64}
            value={size}
            onChange={e => setSize(parseInt(e.target.value))}
          />
        </div>

        {/* Send Button */}
        <Button
          variant="primary"
          size="lg"
          fullWidth
          disabled={!canSend}
          onClick={handleSend}
          icon={<span>🚀</span>}
        >
          Send Packet
        </Button>

        {!canSend && activeDevices.length < 2 && (
          <div style={{
            fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center',
            padding: '8px', background: 'var(--bg-tertiary)', borderRadius: '8px',
          }}>
            Add at least 2 connected devices to send packets
          </div>
        )}
      </div>
    </motion.div>
  );
};

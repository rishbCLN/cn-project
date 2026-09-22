import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useNetworkStore } from '../../stores/networkStore';
import { Button } from '../ui/Button';
import { Protocol } from '../../types';
import { PROTOCOL_COLORS, PROTOCOL_BG_COLORS } from '../../utils/colors';
import { buildGraph, findPath } from '../../engine/routing';

const PROTOCOLS: Protocol[] = ['TCP', 'UDP', 'ICMP', 'DNS'];

export const SendPacketPanel: React.FC = () => {
  const devices = useNetworkStore(s => s.devices);
  const links = useNetworkStore(s => s.links);
  const routingAlgorithm = useNetworkStore(s => s.simConfig.routingAlgorithm);
  const sendPacket = useNetworkStore(s => s.sendPacket);
  const startSim = useNetworkStore(s => s.startSim);
  const activeDevices = devices.filter(d => d.status === 'active');

  const [srcId, setSrcId] = useState('');
  const [dstId, setDstId] = useState('');
  const [protocol, setProtocol] = useState<Protocol>('TCP');
  const [size, setSize] = useState(512);

  // Live route preview: recompute the shortest path whenever the endpoints,
  // topology, or algorithm change — so users see reachability + the exact hop
  // chain before committing to a send.
  const preview = useMemo(() => {
    if (!srcId || !dstId || srcId === dstId) return null;
    const graph = buildGraph(devices, links);
    const result = findPath(graph, srcId, dstId, routingAlgorithm);
    if (!result) return { reachable: false as const };
    const labels = result.path.map(
      id => devices.find(d => d.id === id)?.label ?? '?'
    );
    return {
      reachable: true as const,
      labels,
      hops: result.path.length - 1,
      cost: result.totalCost,
    };
  }, [srcId, dstId, devices, links, routingAlgorithm]);

  const canSend = Boolean(srcId && dstId && srcId !== dstId && preview?.reachable);

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

        {/* Live route preview */}
        {preview && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            style={{
              borderRadius: '8px',
              padding: '10px 12px',
              background: preview.reachable ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
              border: `1px solid ${preview.reachable ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
            }}
          >
            {preview.reachable ? (
              <>
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  marginBottom: '6px',
                }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#34d399' }}>
                    ✓ Reachable
                  </span>
                  <span style={{ fontSize: '10.5px', fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                    {preview.hops} hop{preview.hops === 1 ? '' : 's'} · cost {preview.cost}
                  </span>
                </div>
                <div style={{
                  fontSize: '11px', fontFamily: 'monospace', color: 'var(--text-secondary)',
                  lineHeight: 1.5, wordBreak: 'break-word',
                }}>
                  {preview.labels.map((l, i) => (
                    <React.Fragment key={i}>
                      <span style={{ color: i === 0 || i === preview.labels.length - 1 ? 'var(--accent-cyan)' : 'var(--text-secondary)' }}>
                        {l}
                      </span>
                      {i < preview.labels.length - 1 && <span style={{ color: 'var(--text-muted)' }}> → </span>}
                    </React.Fragment>
                  ))}
                </div>
              </>
            ) : (
              <span style={{ fontSize: '11px', fontWeight: 600, color: '#f87171' }}>
                ✕ No route — these devices aren't connected
              </span>
            )}
          </motion.div>
        )}

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

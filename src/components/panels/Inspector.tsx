import React from 'react';
import { motion } from 'framer-motion';
import { useNetworkStore } from '../../stores/networkStore';
import { useUIStore } from '../../stores/uiStore';
import { PROTOCOL_COLORS } from '../../utils/colors';
import { formatBytes, formatMs } from '../../utils/helpers';

export const Inspector: React.FC = () => {
  const inspectedPacketId = useUIStore(s => s.inspectedPacketId);
  const packetHistory = useNetworkStore(s => s.packetHistory);
  const devices = useNetworkStore(s => s.devices);
  const setInspectedPacket = useUIStore(s => s.setInspectedPacket);

  // If no packet inspected, show packet history list
  if (!inspectedPacketId) {
    return (
      <div style={{ padding: '16px' }}>
        <div style={{
          fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)',
          textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px',
        }}>
          Packet History
        </div>
        <div style={{ maxHeight: '400px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {packetHistory.length === 0 && (
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>
              No packets sent yet
            </div>
          )}
          {packetHistory.filter(p => !p.isAck).slice(-30).reverse().map(p => (
            <motion.div
              key={p.id}
              onClick={() => setInspectedPacket(p.id)}
              whileHover={{ x: 2 }}
              style={{
                padding: '8px 10px',
                background: 'var(--bg-tertiary)',
                borderRadius: '8px',
                cursor: 'pointer',
                borderLeft: `3px solid ${PROTOCOL_COLORS[p.protocol]}`,
                fontSize: '11px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span style={{ color: 'var(--text-primary)' }}>
                #{p.seqNum} {p.protocol}
              </span>
              <span style={{
                fontSize: '10px',
                color: p.status === 'delivered' ? '#10b981'
                     : p.status === 'dropped' ? '#ef4444'
                     : p.status === 'corrupted' ? '#f59e0b'
                     : 'var(--text-muted)',
                fontWeight: 600,
                textTransform: 'uppercase',
              }}>
                {p.status}
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    );
  }

  const packet = packetHistory.find(p => p.id === inspectedPacketId);
  if (!packet) return null;

  const rows = [
    ['Source IP', packet.sourceIP],
    ['Destination IP', packet.destIP],
    ['Protocol', packet.protocol],
    ['Size', formatBytes(packet.size)],
    ['TTL', String(packet.ttl)],
    ['Seq Number', String(packet.seqNum)],
    ['ACK Number', String(packet.ackNum)],
    ['Checksum', packet.checksum],
    ['CRC-32', packet.crc],
    ['CRC Valid', packet.crcValid ? '✓ PASS' : '✕ FAIL'],
    ['Status', packet.status.toUpperCase()],
    ['Hop Count', `${packet.currentHop} / ${packet.path.length - 1}`],
    ['Created', new Date(packet.createdAt).toLocaleTimeString()],
    ['Delivered', packet.deliveredAt ? new Date(packet.deliveredAt).toLocaleTimeString() : '—'],
    ['RTT', packet.deliveredAt ? formatMs(packet.deliveredAt - packet.createdAt) : '—'],
  ];

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      style={{ padding: '16px' }}
    >
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: '16px',
      }}>
        <div style={{
          fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)',
          textTransform: 'uppercase', letterSpacing: '0.1em',
        }}>
          Packet Inspector
        </div>
        <motion.button
          onClick={() => setInspectedPacket(null)}
          whileHover={{ scale: 1.1 }}
          style={{
            background: 'var(--bg-tertiary)', border: 'none', borderRadius: '6px',
            padding: '4px 8px', fontSize: '10px', color: 'var(--text-muted)',
            cursor: 'pointer',
          }}
        >
          ← Back
        </motion.button>
      </div>

      {/* Protocol badge */}
      <div style={{
        textAlign: 'center', marginBottom: '16px',
        padding: '12px', borderRadius: '10px',
        background: `${PROTOCOL_COLORS[packet.protocol]}15`,
        border: `1px solid ${PROTOCOL_COLORS[packet.protocol]}30`,
      }}>
        <div style={{
          fontSize: '20px', fontWeight: 800, color: PROTOCOL_COLORS[packet.protocol],
          fontFamily: 'monospace',
        }}>
          {packet.protocol}
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
          Packet #{packet.seqNum}
        </div>
      </div>

      {/* Path visualization */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px' }}>
          Path
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '4px',
          flexWrap: 'wrap', fontSize: '11px',
        }}>
          {packet.path.map((nodeId, i) => {
            const device = devices.find(d => d.id === nodeId);
            const isCurrent = i === packet.currentHop;
            return (
              <React.Fragment key={nodeId}>
                <span style={{
                  padding: '2px 8px',
                  borderRadius: '6px',
                  background: isCurrent ? 'rgba(6,182,212,0.2)' : 'var(--bg-tertiary)',
                  border: isCurrent ? '1px solid rgba(6,182,212,0.4)' : '1px solid transparent',
                  color: isCurrent ? '#06b6d4' : 'var(--text-secondary)',
                  fontWeight: isCurrent ? 600 : 400,
                }}>
                  {device?.label ?? nodeId}
                </span>
                {i < packet.path.length - 1 && (
                  <span style={{ color: 'var(--text-muted)' }}>→</span>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Detail table */}
      <div style={{
        borderRadius: '10px', overflow: 'hidden',
        border: '1px solid var(--border-glass)',
        marginBottom: '16px',
      }}>
        {rows.map(([label, value], i) => (
          <div
            key={label}
            style={{
              display: 'flex', justifyContent: 'space-between',
              padding: '8px 12px',
              background: i % 2 === 0 ? 'var(--bg-tertiary)' : 'transparent',
              fontSize: '12px',
            }}
          >
            <span style={{ color: 'var(--text-muted)' }}>{label}</span>
            <span style={{
              color: label === 'CRC Valid'
                ? (value === '✓ PASS' ? '#10b981' : '#ef4444')
                : 'var(--text-primary)',
              fontFamily: 'monospace',
              fontWeight: 500,
            }}>
              {value}
            </span>
          </div>
        ))}
      </div>

      {/* ─── Layer-2/3/4 Frame Dump (Hex Telemetry) ─── */}
      <div>
        <div style={{
          fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)',
          textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px',
        }}>
          Layer-2/3/4 Frame Telemetry (Hex Dump)
        </div>
        <div style={{
          background: 'rgba(10, 14, 26, 0.95)',
          border: '1px solid var(--border-glass)',
          borderRadius: '10px',
          padding: '12px',
          fontFamily: 'monospace',
          fontSize: '10px',
          color: '#38bdf8',
          lineHeight: '1.6',
        }}>
          <div style={{ color: '#10b981', fontWeight: 700, marginBottom: '2px' }}>[L2 Ethernet II Frame]</div>
          <div>Dst MAC: 00:1A:2B:3C:4D:02</div>
          <div>Src MAC: 00:1A:2B:3C:4D:01</div>
          <div>EtherType: 0x0800 (IPv4)</div>

          <div style={{ color: '#3b82f6', fontWeight: 700, marginTop: '8px', marginBottom: '2px' }}>[L3 IPv4 Datagram Header]</div>
          <div>Ver/IHL: 0x45 | TOS: 0x00 | Len: {packet.size} Bytes</div>
          <div>ID: 0x{packet.seqNum.toString(16).padStart(4, '0')} | Flags: 0x4000 (DF) | TTL: {packet.ttl}</div>
          <div>Proto: {packet.protocol === 'TCP' ? '0x06 (TCP)' : packet.protocol === 'UDP' ? '0x11 (UDP)' : '0x01 (ICMP)'}</div>
          <div>Header Checksum: {packet.checksum}</div>
          <div>Src IP: {packet.sourceIP} ➔ Dst IP: {packet.destIP}</div>

          <div style={{ color: '#8b5cf6', fontWeight: 700, marginTop: '8px', marginBottom: '2px' }}>[L4 {packet.protocol} Segment Header]</div>
          <div>Seq: 0x{packet.seqNum.toString(16).padStart(8, '0')} | Ack: 0x{packet.ackNum.toString(16).padStart(8, '0')}</div>
          <div>Window Size: 64240 Bytes | Flags: [ACK, PSH]</div>
          <div style={{
            color: packet.crcValid ? '#10b981' : '#ef4444',
            fontWeight: 700, marginTop: '6px',
            padding: '4px 8px', borderRadius: '4px',
            background: packet.crcValid ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
            border: `1px solid ${packet.crcValid ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
            display: 'inline-block',
          }}>
            CRC-32 Checksum: {packet.crc} ({packet.crcValid ? '✓ PASS' : '✕ CORRUPTED'})
          </div>
        </div>
      </div>
    </motion.div>
  );
};
